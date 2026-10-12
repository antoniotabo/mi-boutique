import {Router} from 'express';
import {z} from 'zod';
import bcrypt from 'bcryptjs';
import {randomBytes,createHash} from 'node:crypto';
import {rateLimit} from 'express-rate-limit';

const hash=value=>createHash('sha256').update(value).digest('hex');
const password=z.string().min(12,'Usa al menos 12 caracteres.').max(72).refine(p=>Buffer.byteLength(p,'utf8')<=72,'La contraseña es demasiado larga. Usa como máximo 72 bytes.');
const role=z.enum(['admin','operator']);
const createSchema=z.object({username:z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/,'Usa letras, números, punto, guion o guion bajo.'),password,role}).strict();
const updateSchema=z.object({role,active:z.boolean()}).strict();
const changeSchema=z.object({currentPassword:z.string().min(1).max(128),newPassword:password}).strict();
const resetSchema=z.object({newPassword:password}).strict();
const credentials=z.object({username:z.string().trim().min(1).max(80),password:z.string().min(1).max(128)});
export class AccountError extends Error{constructor(message,status=409){super(message);this.status=status;}}
const fail=(message,status)=>{throw new AccountError(message,status);};
const publicUser=u=>({id:u.id,username:u.username,role:u.role,mustChangePassword:!!u.must_change_password});

async function transaction(db,work){
 const conn=await db.getConnection();
 try{
  await conn.beginTransaction();
  const [lock]=await conn.query('SELECT id FROM user_management_lock WHERE id=1 FOR UPDATE');
  if(!lock.length)throw new Error('Falta inicializar el bloqueo de usuarios.');
  const result=await work(conn);await conn.commit();return result;
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function actor(conn,req,admin=false){
 const [rows]=await conn.execute(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
 WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND u.active=1`,[hash(req.cookies.sid||'')]);
 if(!rows.length)fail('Tu sesión venció. Vuelve a ingresar.',401);
 const u=rows[0];
 if(admin&&(u.role!=='admin'||u.must_change_password))fail('Solo un administrador con contraseña actualizada puede gestionar usuarios.',403);
 return u;
}

export async function loginUser(db,input,oldToken){
 const data=credentials.parse(input);
 return transaction(db,async conn=>{
  const [rows]=await conn.execute('SELECT * FROM users WHERE username=?',[data.username]);const u=rows[0];
  if(!u||!u.active||!(await bcrypt.compare(data.password,u.password_hash)))fail('Usuario o contraseña incorrectos.',401);
  await conn.query('DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP()');
  if(oldToken)await conn.execute('DELETE FROM sessions WHERE token_hash=?',[hash(oldToken)]);
  const token=randomBytes(32).toString('hex');
  await conn.execute('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))',[hash(token),u.id]);
  return {token,user:publicUser(u)};
 });
}

export function userRoutes(db){
 const router=Router();router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/users',async(req,res)=>{
  const users=await transaction(db,async conn=>{await actor(conn,req,true);const [rows]=await conn.query('SELECT id,username,role,active,must_change_password AS mustChangePassword FROM users ORDER BY active DESC,username');return rows;});
  res.json(users);
 });
 router.post('/users',async(req,res)=>{
  const data=createSchema.parse(req.body);
  const result=await transaction(db,async conn=>{
   await actor(conn,req,true);
   const [insert]=await conn.execute('INSERT INTO users(username,password_hash,role,active,must_change_password) VALUES(?,?,?,1,1)',[data.username,await bcrypt.hash(data.password,12),data.role]);
   return {id:insert.insertId,message:'Usuario creado. Deberá cambiar su contraseña al ingresar.'};
  });res.status(201).json(result);
 });
 router.put('/users/:id',async(req,res)=>{
  const id=z.coerce.number().int().positive().parse(req.params.id);const data=updateSchema.parse(req.body);
  const result=await transaction(db,async conn=>{
   const me=await actor(conn,req,true);
   const [rows]=await conn.execute('SELECT * FROM users WHERE id=?',[id]);const u=rows[0];if(!u)fail('Usuario no encontrado.',404);
   if(u.active&&u.role==='admin'&&(!data.active||data.role!=='admin')){
    const [[count]]=await conn.query("SELECT COUNT(*) AS n FROM users WHERE active=1 AND role='admin'");
    if(Number(count.n)<=1)fail('Debe quedar al menos un administrador activo.');
   }
   const changed=!!u.active!==data.active||u.role!==data.role;
   if(changed){
    await conn.execute('UPDATE users SET role=?,active=? WHERE id=?',[data.role,data.active?1:0,id]);
    await conn.execute('DELETE FROM sessions WHERE user_id=?',[id]);
   }
   return {message:changed?'Permisos actualizados. Se cerraron las sesiones de esa cuenta.':'La cuenta ya tenía esos permisos.',logout:changed&&me.id===id};
  });res.json(result);
 });
 const limit=()=>rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Demasiados intentos de contraseña. Espera 15 minutos.'}});
 router.post('/users/:id/password',limit(),async(req,res)=>{
  const id=z.coerce.number().int().positive().parse(req.params.id);const data=resetSchema.parse(req.body);
  await transaction(db,async conn=>{
   const me=await actor(conn,req,true);
   if(me.id===id)fail('Cambia tu propia contraseña desde Mi cuenta.',400);
   const [rows]=await conn.execute('SELECT id,password_hash FROM users WHERE id=?',[id]);if(!rows.length)fail('Usuario no encontrado.',404);
   if(await bcrypt.compare(data.newPassword,rows[0].password_hash))fail('Elige una contraseña diferente a la actual.',400);
   await conn.execute('UPDATE users SET password_hash=?,must_change_password=1 WHERE id=?',[await bcrypt.hash(data.newPassword,12),id]);
   await conn.execute('DELETE FROM sessions WHERE user_id=?',[id]);
  });res.json({message:'Contraseña restablecida. El usuario deberá cambiarla al ingresar.'});
 });
 router.post('/auth/password',limit(),async(req,res)=>{
  const data=changeSchema.parse(req.body);
  await transaction(db,async conn=>{
   const me=await actor(conn,req);
   if(!(await bcrypt.compare(data.currentPassword,me.password_hash)))fail('La contraseña actual no es correcta.',400);
   if(await bcrypt.compare(data.newPassword,me.password_hash))fail('Elige una contraseña diferente a la actual.',400);
   await conn.execute('UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?',[await bcrypt.hash(data.newPassword,12),me.id]);
   await conn.execute('DELETE FROM sessions WHERE user_id=?',[me.id]);
  });
  res.clearCookie('sid',{path:'/api',httpOnly:true,sameSite:'strict'}).json({message:'Contraseña cambiada. Vuelve a iniciar sesión.',logout:true});
 });
 router.use((error,req,res,next)=>{
  if(error instanceof z.ZodError)return res.status(400).json({message:error.issues[0]?.message||'Revisa los campos ingresados.'});
  if(error instanceof AccountError)return res.status(error.status).json({message:error.message});
  if(error.code==='ER_DUP_ENTRY')return res.status(409).json({message:'Ese nombre de usuario ya existe, incluso si la cuenta está desactivada.'});
  next(error);
 });
 return router;
}
