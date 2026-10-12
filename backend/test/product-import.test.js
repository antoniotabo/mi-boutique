import {test} from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createApp} from '../src/app.js';

test('importación CSV en MySQL aislado',{skip:!process.env.BOUTIQUE_TEST_PORT},async t=>{
 const config={host:'127.0.0.1',port:Number(process.env.BOUTIQUE_TEST_PORT),user:process.env.BOUTIQUE_TEST_USER||'root',password:process.env.BOUTIQUE_TEST_PASSWORD||'',timezone:'Z'};
 const database='boutique_test_'+randomBytes(8).toString('hex'),manager=await mysql.createConnection(config);let db;
 try{
  await manager.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  db=mysql.createPool({...config,database,connectionLimit:6});
  for(const sql of (await readFile(new URL('../database/schema.sql',import.meta.url),'utf8')).split(';').map(s=>s.trim()).filter(Boolean))await db.query(sql);
  await db.query('INSERT INTO b_schema_versions(version) VALUES(1)');
  await db.execute("INSERT INTO users(username,password_hash,role) VALUES('admin',?,'admin'),('seller',?,'operator')",[await bcrypt.hash('CsvTest123!',4),await bcrypt.hash('CsvTest123!',4)]);
  const app=createApp(db,{backups:false}),admin=request.agent(app),seller=request.agent(app),url='/api/imports/products';
  for(const [agent,username] of [[admin,'admin'],[seller,'seller']])assert.equal((await agent.post('/api/auth/login').send({username,password:'CsvTest123!'})).status,200);
  const header='sku;producto;categoria;talla;color;unidad;costo;precio;stock;stock_minimo;codigo_barras';
  const csv=header+'\nBL-M;Blusa;Ropa;M;Blanco;unidad;10,50;29,90;5;2;000123\nBL-L;Blusa;Ropa;L;Blanco;unidad;10;29;3;1;\nAR;Aretes;Bisutería;;;par;3;10;4;2;';
  const payload={csv,requestId:randomUUID()};
  const count=async table=>Number((await db.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n);
  await t.test('solo administración y sin efectos al previsualizar',async()=>{
   assert.equal((await request(app).post(url+'/preview').send({csv})).status,401);
   assert.equal((await seller.post(url+'/preview').send({csv})).status,403);
   assert.equal((await seller.post(url+'/commit').send(payload)).status,403);
   const p=await admin.post(url+'/preview').send({csv});assert.equal(p.status,200);assert.equal(p.body.valid,true);assert.equal(p.body.summary.productsCreated,2);assert.equal(p.body.summary.unitsAdded,12);
   assert.equal(await count('b_variants'),0);assert.equal(await count('b_categories'),0);
  });
  await t.test('carga stock y movimientos, conserva ceros, no duplica al reintentar',async()=>{
   const [a,b]=await Promise.all([admin.post(url+'/commit').send(payload),admin.post(url+'/commit').send(payload)]);
   assert.equal(a.status,201,JSON.stringify(a.body));assert.equal(b.status,201);assert.deepEqual(a.body,b.body);
   assert.equal(a.body.variantsCreated,3);assert.equal(a.body.productsCreated,2);assert.equal(await count('b_variants'),3);assert.equal(await count('b_stock_movements'),3);
   const [[v]]=await db.execute('SELECT stock,barcode FROM b_variants WHERE sku=?',['BL-M']);assert.equal(v.stock,5);assert.equal(v.barcode,'000123');
   assert.equal(await count('b_cash_movements'),0);assert.equal(await count('b_orders'),0);
   assert.equal((await admin.post(url+'/commit').send({...payload,csv:csv+'\n'})).status,409);
  });
  await t.test('segunda carga del archivo y archivos mixtos se rechazan completos',async()=>{
   const mixed=csv+'\nNEW;Cartera;Carteras;;;unidad;20;40;3;0;';
   assert.equal((await admin.post(url+'/preview').send({csv:mixed})).body.valid,false);
   const r=await admin.post(url+'/commit').send({csv:mixed,requestId:randomUUID()});assert.equal(r.status,422);assert.ok(r.body.errors[0].row);
   assert.equal(await count('b_variants'),3);assert.equal(await count('b_categories'),2);
  });
  await t.test('agrega otra talla al producto existente',async()=>{
   const csv=header+'\nBL-S;Blusa;Ropa;S;Blanco;unidad;10;29;0;1;';
   const r=await admin.post(url+'/commit').send({csv,requestId:randomUUID()});assert.equal(r.status,201);assert.equal(r.body.productsCreated,0);assert.equal(r.body.variantsCreated,1);assert.equal(await count('b_products'),2);
  });
  await t.test('revalida entre vista previa y confirmación',async()=>{
   const csv=header+'\nOTRO;Collar;Accesorios;;;unidad;2;9;1;0;';
   assert.equal((await admin.post(url+'/preview').send({csv})).body.valid,true);
   await db.query("INSERT INTO b_categories(name,active) VALUES('Accesorios',0)");
   assert.equal((await admin.post(url+'/commit').send({csv,requestId:randomUUID()})).status,422);
   assert.equal(await count('b_variants'),4);
  });
  await t.test('rollback ante equivalencias de collation que solo MySQL detecta',async()=>{
   const csv=header+'\nCAS-1;Caso;Nueva;;;unidad;1;2;1;0;Straße\nCAS-2;Otro;Nueva;;;unidad;1;2;1;0;Strasse';
   const r=await admin.post(url+'/commit').send({csv,requestId:randomUUID()});assert.equal(r.status,409);
   assert.equal(await count('b_variants'),4);assert.equal((await db.query("SELECT id FROM b_categories WHERE name='Nueva'"))[0].length,0);
  });
  await t.test('concurrencia con solicitudes distintas no duplica stock',async()=>{
   const csv=header+'\nUNICO;Cartera;Carteras;;;unidad;20;40;3;0;';
   const results=await Promise.all([1,2].map(()=>admin.post(url+'/commit').send({csv,requestId:randomUUID()})));
   assert.deepEqual(results.map(r=>r.status).sort(),[201,422]);
   assert.equal((await db.query("SELECT stock FROM b_variants WHERE sku='UNICO'"))[0][0].stock,3);
  });
 }finally{if(db)await db.end();await manager.query(`DROP DATABASE IF EXISTS \`${database}\``);await manager.end();}
});
