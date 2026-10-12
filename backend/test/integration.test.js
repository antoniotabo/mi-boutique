import { test } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { randomUUID,randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';

// Opt-in only. Creates/drops a randomly named test database on the specified test server.
test('integracion MySQL aislada',{skip:!process.env.BOUTIQUE_TEST_PORT},async t=>{
  const config={host:'127.0.0.1',port:Number(process.env.BOUTIQUE_TEST_PORT),user:process.env.BOUTIQUE_TEST_USER||'root',password:process.env.BOUTIQUE_TEST_PASSWORD||'',timezone:'Z',dateStrings:true};
  const database='boutique_test_'+randomBytes(8).toString('hex');
  const manager=await mysql.createConnection(config);let db;
  try{
    await manager.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    db=mysql.createPool({...config,database,connectionLimit:8});
    const sql=await readFile(new URL('../database/schema.sql',import.meta.url),'utf8');
    for(const stmt of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.query(stmt);
    await db.query('INSERT INTO b_schema_versions(version) VALUES(1)');
    await db.execute("INSERT INTO users(username,password_hash,role) VALUES('admin',?,'admin'),('seller',?,'operator')",[await bcrypt.hash('BoutiqueTest123!',4),await bcrypt.hash('BoutiqueTest123!',4)]);
    const app=createApp(db,{backups:false}),admin=request.agent(app),seller=request.agent(app);
    const post=async(path,body,agent=admin,expected=201)=>{const r=await agent.post(path).send(body);assert.equal(r.status,expected,JSON.stringify(r.body));return r.body;};
    await post('/api/auth/login',{username:'admin',password:'BoutiqueTest123!'},admin,200);
    await post('/api/auth/login',{username:'seller',password:'BoutiqueTest123!'},seller,200);
    let category,product,variant,session,sale;
    await t.test('autenticacion y origen',async()=>{
      assert.equal((await request(app).get('/api/products')).status,401);
      assert.equal((await admin.post('/api/categories').set('Origin','https://evil.example').send({name:'X'})).status,403);
      assert.equal((await seller.post('/api/categories').send({name:'Ropa'})).status,403);
    });
    await t.test('crear catalogo y evitar SKU repetido',async()=>{
      category=await post('/api/categories',{name:'Ropa'});
      product=await post('/api/products',{categoryId:category.id,name:'Blusa',unit:'unit'});
      variant=await post(`/api/products/${product.id}/variants`,{sku:'BL-M-NEG',size:'M',color:'Negro',cost:20,price:40,minStock:2});
      await post(`/api/products/${product.id}/variants`,{sku:'BL-M-NEG',size:'L',color:'Negro',cost:20,price:40},admin,409);
    });
    await t.test('stock inicial e idempotencia',async()=>{
      const payload={requestId:randomUUID(),variantId:variant.id,kind:'initial',quantity:10,reason:'Inventario inicial'};
      await post('/api/inventory/adjustments',payload);await post('/api/inventory/adjustments',payload);
      const [[v]]=await db.execute('SELECT stock FROM b_variants WHERE id=?',[variant.id]);assert.equal(v.stock,10);
      await post('/api/inventory/adjustments',{...payload,quantity:11},admin,409);
      await post('/api/inventory/adjustments',{...payload,requestId:randomUUID()},admin,409);
    });
    await t.test('apertura unica',async()=>{
      const payload={requestId:randomUUID(),amount:100};session=await post('/api/cash/open',payload,admin,200);
      assert.equal((await post('/api/cash/open',payload,admin,200)).sessionId,session.sessionId);
      await post('/api/cash/open',{...payload,requestId:randomUUID()},admin,409);
    });
    await t.test('venta y vuelto sin duplicar cobro ni inventario',async()=>{
      const payload={requestId:randomUUID(),sessionId:session.sessionId,paymentMethod:'cash',tendered:100,items:[{variantId:variant.id,quantity:2}]};
      sale=await post('/api/sales',payload,seller);assert.equal(sale.total,'80.00');assert.equal(sale.change,'20.00');
      assert.equal((await post('/api/sales',payload,seller)).id,sale.id);
      const [[v]]=await db.execute('SELECT stock FROM b_variants WHERE id=?',[variant.id]);assert.equal(v.stock,8);
      const cash=(await admin.get('/api/cash')).body;assert.equal(cash.balance,'180.00');
      await post('/api/sales',{...payload,requestId:randomUUID(),items:[{variantId:variant.id,quantity:1,unitPrice:1}]},seller,403);
    });
    await t.test('devolucion parcial y sobredevolucion',async()=>{
      const detail=(await admin.get('/api/sales/'+sale.id)).body;
      const payload={requestId:randomUUID(),sessionId:session.sessionId,reason:'Cambio solicitado',items:[{itemId:detail.items[0].id,quantity:1}]};
      const r=await post(`/api/sales/${sale.id}/returns`,payload);assert.equal(r.total,'40.00');
      await post(`/api/sales/${sale.id}/returns`,payload);
      await post(`/api/sales/${sale.id}/returns`,{...payload,requestId:randomUUID(),items:[{itemId:detail.items[0].id,quantity:2}]},admin,409);
      assert.equal((await admin.get('/api/cash')).body.balance,'140.00');
    });
    await t.test('pago digital no incrementa efectivo',async()=>{
      await post('/api/sales',{requestId:randomUUID(),sessionId:session.sessionId,paymentMethod:'yape',items:[{variantId:variant.id,quantity:1}]},seller);
      const cash=(await admin.get('/api/cash')).body;assert.equal(cash.balance,'140.00');assert.equal(cash.methods.find(m=>m.method==='yape').net,'40.00');
    });
    await t.test('compra y devolucion a proveedor actualizan stock y caja',async()=>{
      const purchase=await post('/api/purchases',{requestId:randomUUID(),sessionId:session.sessionId,paymentMethod:'cash',items:[{variantId:variant.id,quantity:2,unitPrice:10}]});
      const detail=(await admin.get('/api/purchases/'+purchase.id)).body;
      await post(`/api/purchases/${purchase.id}/returns`,{requestId:randomUUID(),sessionId:session.sessionId,reason:'Mercaderia defectuosa',items:[{itemId:detail.items[0].id,quantity:1}]});
      assert.equal((await admin.get('/api/cash')).body.balance,'130.00');
    });
    await t.test('rollback completo si no alcanza efectivo para compra',async()=>{
      const [[before]]=await db.execute('SELECT stock FROM b_variants WHERE id=?',[variant.id]);
      await post('/api/purchases',{requestId:randomUUID(),sessionId:session.sessionId,paymentMethod:'cash',items:[{variantId:variant.id,quantity:100,unitPrice:10}]},admin,409);
      const [[after]]=await db.execute('SELECT stock FROM b_variants WHERE id=?',[variant.id]);assert.equal(after.stock,before.stock);
    });
    await t.test('concurrencia no permite vender stock negativo',async()=>{
      const [[v]]=await db.execute('SELECT stock FROM b_variants WHERE id=?',[variant.id]);
      const payload=()=>({requestId:randomUUID(),sessionId:session.sessionId,paymentMethod:'card',items:[{variantId:variant.id,quantity:v.stock}]});
      const results=await Promise.all([seller.post('/api/sales').send(payload()),seller.post('/api/sales').send(payload())]);
      assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
      const [[end]]=await db.execute('SELECT stock FROM b_variants WHERE id=?',[variant.id]);assert.equal(end.stock,0);
    });
    await t.test('reportes, Excel y tickets',async()=>{
      assert.equal((await admin.get('/api/reports/summary')).status,200);
      assert.equal((await seller.get('/api/reports/summary')).status,403);
      const excel=await admin.get('/api/reports/sales.xlsx');assert.equal(excel.status,200);assert.ok(excel.headers['content-type'].includes('spreadsheetml'));
      const ticket=await admin.get(`/api/tickets/sales/${sale.id}?format=html`);assert.equal(ticket.status,200);assert.ok(ticket.text.includes('NOTA DE VENTA'));
    });
    await t.test('cierre exige saldo vigente y motivo de diferencia',async()=>{
      await post('/api/cash/close',{requestId:randomUUID(),sessionId:session.sessionId,counted:130,expected:100},admin,409);
      await post('/api/cash/close',{requestId:randomUUID(),sessionId:session.sessionId,counted:120,expected:130},admin,400);
      await post('/api/cash/close',{requestId:randomUUID(),sessionId:session.sessionId,counted:130,expected:130},admin,200);
      await post('/api/sales',{requestId:randomUUID(),sessionId:session.sessionId,paymentMethod:'cash',items:[{variantId:variant.id,quantity:1}]},admin,409);
    });
  }finally{
    await db?.end();
    if(/^boutique_test_[a-f0-9]{16}$/.test(database))await manager.query(`DROP DATABASE \`${database}\``);
    await manager.end();
  }
});
