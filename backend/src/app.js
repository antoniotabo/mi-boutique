import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { loginUser,userRoutes,AccountError } from './users.js';
import { BusinessError } from './core.js';
import { catalogRoutes,inventoryRoutes } from './catalog.js';
import { orderRoutes } from './orders.js';
import { cashRoutes } from './cash.js';
import { reportRoutes,summary,dateRange } from './reports.js';
import { settingsRoutes } from './settings.js';
import { ticketRoutes } from './tickets.js';
import { backupRoutes } from './backups.js';
import { productImportRoutes } from './product-import.js';

export function createApp(db,{backups=true}={}){
  const app=express();app.disable('x-powered-by');
  app.use(helmet({strictTransportSecurity:false,contentSecurityPolicy:{directives:{'upgrade-insecure-requests':null}}}));
  app.use('/api/imports/products',express.json({limit:'1mb'}));
  app.use(express.json({limit:'128kb'}),cookieParser());
  app.use('/api',(req,res,next)=>{
    res.set('Cache-Control','no-store');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)){
      const origins=(process.env.ALLOWED_ORIGINS||'http://localhost:4200,http://127.0.0.1:4200,http://localhost:3000,http://127.0.0.1:3000').split(',').map(s=>s.trim());
      if(req.get('sec-fetch-site')==='cross-site'||(req.get('origin')&&!origins.includes(req.get('origin'))))return res.status(403).json({message:'Origen no permitido.'});
      if(!req.is('application/json'))return res.status(415).json({message:'Se requiere application/json.'});
    }next();
  });
  const cookie={httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',path:'/api',maxAge:8*3600000};
  app.get('/api/health',async(req,res)=>{
    try{const [[v]]=await db.query('SELECT version FROM b_schema_versions WHERE version=1');if(!v)throw Error();res.json({status:'ok',application:'boutique',version:1});}
    catch{res.status(503).json({message:'Revisa MySQL y ejecuta npm run db:migrate.'});}
  });
  app.post('/api/auth/login',rateLimit({windowMs:15*60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res)=>{
    const result=await loginUser(db,req.body,req.cookies.sid);res.cookie('sid',result.token,cookie).json(result.user);
  });
  app.use('/api',async(req,res,next)=>{
    if(!req.cookies.sid)return res.status(401).json({message:'Inicia sesion.'});
    const tokenHash=createHash('sha256').update(req.cookies.sid).digest('hex');
    const [[user]]=await db.execute(`SELECT u.id,u.username,u.role,u.must_change_password AS mustChangePassword
      FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.active=1`,[tokenHash]);
    if(!user)return res.status(401).json({message:'Tu sesion vencio. Vuelve a ingresar.'});
    req.user={...user,mustChangePassword:!!user.mustChangePassword,tokenHash};
    if(req.user.mustChangePassword&&!['/auth/me','/auth/logout','/auth/password'].includes(req.path))return res.status(403).json({message:'Cambia tu clave en Mi cuenta.',code:'PASSWORD_CHANGE_REQUIRED'});
    next();
  });
  app.get('/api/auth/me',(req,res)=>{const {tokenHash,...user}=req.user;res.json(user);});
  app.post('/api/auth/logout',async(req,res)=>{await db.execute('DELETE FROM sessions WHERE token_hash=?',[req.user.tokenHash]);res.clearCookie('sid',{path:'/api',httpOnly:true,sameSite:'strict',secure:cookie.secure}).sendStatus(204);});
  app.use('/api',userRoutes(db));
  app.use('/api/imports/products',productImportRoutes(db));
  app.use('/api',catalogRoutes(db));
  app.use('/api/inventory',inventoryRoutes(db));
  app.use('/api/sales',orderRoutes(db,'sale'));
  app.use('/api/purchases',orderRoutes(db,'purchase'));
  app.use('/api/cash',cashRoutes(db));
  app.use('/api/reports',reportRoutes(db));
  app.use('/api/settings',settingsRoutes(db));
  app.use('/api/tickets',ticketRoutes(db));
  if(backups)app.use('/api/backups',backupRoutes());
  app.get('/api/dashboard',async(req,res)=>{
    if(req.user.role!=='admin')return res.json({application:'boutique',role:'operator'});
    res.json(await summary(db,dateRange({})));
  });
  app.use((req,res)=>res.status(404).json({message:'Ruta no encontrada. Backend Boutique v1.'}));
  app.use((error,req,res,next)=>{
    if(error instanceof BusinessError||error instanceof AccountError)return res.status(error.status).json({message:error.message});
    if(error instanceof z.ZodError)return res.status(400).json({message:'Revisa los datos.',details:error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
    if(error.code==='ER_DUP_ENTRY')return res.status(409).json({message:'Ya existe ese codigo, documento, categoria o combinacion talla/color.'});
    if(error.code==='ER_NO_REFERENCED_ROW_2')return res.status(400).json({message:'Uno de los registros relacionados no existe.'});
    if(error.type==='entity.parse.failed')return res.status(400).json({message:'JSON invalido.'});
    if(error.type==='entity.too.large')return res.status(413).json({message:'La solicitud es demasiado grande.'});
    if(['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code))return res.status(409).json({message:'Operacion concurrente. Reintenta con el mismo requestId.'});
    console.error('Error de solicitud:',error.code||error.name);res.status(500).json({message:'No se pudo completar la operacion. Revisa MySQL y la migracion.'});
  });return app;
}
