import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineTotal,orderSchema } from '../src/orders.js';
import { dateRange } from '../src/reports.js';
import { ticketHtml } from '../src/tickets.js';
import { randomUUID } from 'node:crypto';

test('precios y descuentos se calculan en centimos',()=>{
  assert.equal(lineTotal(3,19.9,0.1),5940);
  assert.throws(()=>lineTotal(1,10,10));
  assert.throws(()=>lineTotal(1000000,9999999.99,0));
});
test('ventas rechazan fracciones, variantes duplicadas y campos antiguos',()=>{
  const base={requestId:randomUUID(),sessionId:1,paymentMethod:'cash',items:[{variantId:1,quantity:1}]};
  assert.ok(orderSchema.safeParse(base).success);
  assert.equal(orderSchema.safeParse({...base,items:[{variantId:1,quantity:1.5}]}).success,false);
  assert.equal(orderSchema.safeParse({...base,items:[base.items[0],base.items[0]]}).success,false);
  assert.equal(orderSchema.safeParse({...base,kg:10}).success,false);
});
test('reportes usan limites de fecha Peru sin depender de la zona del servidor',()=>{
  const range=dateRange({from:'2026-10-09',to:'2026-10-09'});
  assert.equal(range.start,'2026-10-09 05:00:00');assert.equal(range.end,'2026-10-10 05:00:00');
  assert.throws(()=>dateRange({from:'2026-02-30',to:'2026-03-01'}));
  assert.throws(()=>dateRange({from:'2026-10-10',to:'2026-10-09'}));
});
test('ticket escapa nombres y no ejecuta HTML del catalogo',()=>{
  const html=ticketHtml({paper_width:'80',business_name:'<script>alert(1)</script>'},{id:1,created_at:'2026-10-09 20:00:00',items:[],returns:[],total:'1.00'});
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
