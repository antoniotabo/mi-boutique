import { Router } from 'express';
import { z } from 'zod';
import { id, money, quantity, requestId, method, cents, amount, bounded, transaction, fail, stockMove, openSession, paymentMove, page } from './core.js';

export const orderSchema = z.object({
  requestId, sessionId:id, partyId:id.nullable().default(null), paymentMethod:method,
  tendered:money.optional(), note:z.string().trim().max(250).default(''),
  items:z.array(z.object({variantId:id,quantity,unitPrice:money.optional(),unitDiscount:money.default(0)}).strict()).min(1).max(100)
}).strict().refine(d=>new Set(d.items.map(i=>i.variantId)).size===d.items.length,'Agrupa cada variante en una sola linea.');

export function lineTotal(quantityValue, unitPrice, discount=0) {
  const net=cents(unitPrice)-cents(discount);
  if(net<=0)fail('El precio neto debe ser mayor que cero.',400);
  return bounded(quantityValue*net);
}
export async function createOrder(db,kind,input,actor) {
  const data=orderSchema.parse(input);
  if(kind!=='sale'&&kind!=='purchase')fail('Tipo de operacion invalido.',400);
  return transaction(db,actor,kind+'.create',data,async(c,user)=>{
    const session=await openSession(c,data.sessionId);
    let partyName=kind==='sale'?'Cliente general':'Proveedor general';
    if(data.partyId){
      const [[party]]=await c.execute(`SELECT name FROM ${kind==='sale'?'b_customers':'b_suppliers'} WHERE id=? AND active=1`,[data.partyId]);
      if(!party)fail('Cliente o proveedor no disponible.',400);partyName=party.name;
    }
    const lines=[]; let total=0;
    for(const item of data.items){
      const [[v]]=await c.execute(`SELECT v.*,p.name,p.unit FROM b_variants v JOIN b_products p ON p.id=v.product_id
        JOIN b_categories cat ON cat.id=p.category_id WHERE v.id=? AND v.active=1 AND p.active=1 AND cat.active=1 FOR UPDATE`,[item.variantId]);
      if(!v)fail('Producto o variante no disponible.',404);
      const unitPrice=item.unitPrice??Number(kind==='sale'?v.price:v.cost);
      const discount=kind==='sale'?item.unitDiscount:0;
      if(kind==='purchase' && item.unitDiscount!==0)fail('En compras ingresa el costo neto por unidad.',400);
      if(kind==='sale'&&user.role!=='admin'&&(cents(unitPrice)!==cents(v.price)||cents(discount)!==0))fail('Solo el administrador puede cambiar precios o aplicar descuentos.',403);
      if(kind==='sale'&&Number(v.stock)<item.quantity)fail(`Stock insuficiente: ${v.name} ${v.size} ${v.color}. Disponible: ${v.stock}.`);
      const subtotal=lineTotal(item.quantity,unitPrice,discount); total=bounded(total+subtotal);
      lines.push({v,item,unitPrice,discount,subtotal});
    }
    const tendered=data.tendered===undefined?total:cents(data.tendered);
    if(kind==='sale'&&data.paymentMethod==='cash'){
      if(tendered<total)fail('El efectivo recibido no cubre el total.',400);
    }else if(tendered!==total)fail('El pago debe coincidir con el total.',400);
    const change=kind==='sale'&&data.paymentMethod==='cash'?tendered-total:0;
    const [r]=await c.execute(`INSERT INTO b_orders(kind,party_id,party_name,user_id,session_id,total,payment_method,tendered,change_amount,note,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())`,[kind,data.partyId,partyName,actor.id,session.id,amount(total),data.paymentMethod,amount(tendered),amount(change),data.note]);
    for(const line of lines){
      const {v,item,unitPrice,discount,subtotal}=line;
      await c.execute(`INSERT INTO b_order_items(order_id,variant_id,product_name,sku,size,color,unit,quantity,unit_price,unit_discount,unit_cost,subtotal)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[r.insertId,v.id,v.name,v.sku,v.size,v.color,v.unit,item.quantity,amount(cents(unitPrice)),amount(cents(discount)),kind==='purchase'?amount(cents(unitPrice)):v.cost,amount(subtotal)]);
      await stockMove(c,v.id,kind==='sale'?-item.quantity:item.quantity,kind,r.insertId,data.note,actor.id);
      // Last purchase cost is the valuation policy. Historical sale costs remain fixed.
      if(kind==='purchase')await c.execute('UPDATE b_variants SET cost=? WHERE id=?',[amount(cents(unitPrice)),v.id]);
    }
    await paymentMove(c,session,kind==='sale'?total:-total,data.paymentMethod,kind,r.insertId,data.note,actor.id);
    return {id:r.insertId,kind,total:amount(total),change:amount(change),paymentMethod:data.paymentMethod};
  },kind==='purchase');
}

const returnSchema=z.object({requestId,sessionId:id,reason:z.string().trim().min(5).max(250),
  items:z.array(z.object({itemId:id,quantity}).strict()).min(1).max(100)
}).strict().refine(d=>new Set(d.items.map(i=>i.itemId)).size===d.items.length,'No repitas una linea de devolucion.');

export async function returnOrder(db,kind,orderId,input,actor){
  const data={...returnSchema.parse(input),orderId:id.parse(orderId)};
  return transaction(db,actor,kind+'.return',data,async c=>{
    const session=await openSession(c,data.sessionId);
    const [[order]]=await c.execute('SELECT * FROM b_orders WHERE id=? AND kind=? FOR UPDATE',[data.orderId,kind]);
    if(!order)fail('Operacion no encontrada.',404);
    const lines=[];let total=0;
    for(const item of data.items){
      const [[line]]=await c.execute('SELECT * FROM b_order_items WHERE id=? AND order_id=? FOR UPDATE',[item.itemId,data.orderId]);
      if(!line || item.quantity>line.quantity-line.returned_quantity)fail('La cantidad supera lo pendiente de devolver.');
      const subtotal=lineTotal(item.quantity,line.unit_price,line.unit_discount);total=bounded(total+subtotal);
      lines.push({item,line,subtotal});
    }
    const [r]=await c.execute('INSERT INTO b_returns(order_id,user_id,session_id,total,reason,created_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP())',
      [data.orderId,actor.id,session.id,amount(total),data.reason]);
    for(const {item,line,subtotal} of lines){
      await c.execute('INSERT INTO b_return_items(return_id,order_item_id,quantity,subtotal) VALUES(?,?,?,?)',[r.insertId,line.id,item.quantity,amount(subtotal)]);
      await c.execute('UPDATE b_order_items SET returned_quantity=returned_quantity+? WHERE id=?',[item.quantity,line.id]);
      await stockMove(c,line.variant_id,kind==='sale'?item.quantity:-item.quantity,kind+'_return',r.insertId,data.reason,actor.id);
    }
    await paymentMove(c,session,kind==='sale'?-total:total,order.payment_method,kind+'_return',r.insertId,data.reason,actor.id);
    return {id:r.insertId,orderId:data.orderId,total:amount(total),paymentMethod:order.payment_method};
  },true);
}

export async function orderDetail(db,orderId,kind){
  const [[order]]=await db.execute('SELECT o.*,u.username FROM b_orders o JOIN users u ON u.id=o.user_id WHERE o.id=? AND o.kind=?',[orderId,kind]);
  if(!order)fail('Operacion no encontrada.',404);
  const [items]=await db.execute('SELECT * FROM b_order_items WHERE order_id=? ORDER BY id',[orderId]);
  const [returns]=await db.execute('SELECT * FROM b_returns WHERE order_id=? ORDER BY id',[orderId]);
  return {...order,items,returns};
}
export function orderRoutes(db,kind){
  const router=Router();
  if(kind==='purchase')router.use((req,res,next)=>req.user.role==='admin'?next():res.status(403).json({message:'Solo el administrador puede gestionar compras.'}));
  router.get('/',async(req,res)=>{
    const {limit,offset}=page(req.query);
    const [rows]=await db.execute(`SELECT o.*,COALESCE((SELECT SUM(r.total) FROM b_returns r WHERE r.order_id=o.id),0) AS returned_total
      FROM b_orders o WHERE o.kind=? ORDER BY o.id DESC LIMIT ${limit} OFFSET ${offset}`,[kind]);res.json(rows);
  });
  router.post('/',async(req,res)=>res.status(201).json(await createOrder(db,kind,req.body,req.user)));
  router.get('/:id',async(req,res)=>res.json(await orderDetail(db,id.parse(req.params.id),kind)));
  router.post('/:id/returns',async(req,res)=>res.status(201).json(await returnOrder(db,kind,req.params.id,req.body,req.user)));
  return router;
}
