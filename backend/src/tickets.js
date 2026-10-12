import { Router } from 'express';
import { id } from './core.js';
import { orderDetail } from './orders.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function ticketHtml(business,order){
  const width=business.paper_width==='58'?'58':'80';
  const localTime=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'short'})
    .format(new Date(String(order.created_at).replace(' ','T').replace(/Z$/,'')+'Z'));
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Ticket ${order.id}</title>
  <style>@page{size:${width}mm auto;margin:3mm}body{width:${Number(width)-8}mm;margin:0 auto;font:12px Arial;color:#000}h1{font-size:17px;text-align:center}p{margin:5px 0}table{width:100%;border-collapse:collapse}td{padding:4px 0;vertical-align:top}td:last-child{text-align:right}small{font-size:10px}hr{border:0;border-top:1px dashed #000}.actions{text-align:center;margin:12px}@media print{.actions{display:none}}</style>
  <body><div class="actions">Usa Ctrl+P para imprimir</div><h1>${esc(business.business_name)}</h1>
  <p>${esc(business.document)}</p><p>${esc(business.address)}</p><p>${esc(business.phone)}</p><hr>
  <p><b>NOTA DE VENTA #${order.id}</b></p><p>${esc(localTime)}</p><p>Cliente: ${esc(order.party_name)}</p>
  <table>${order.items.map(i=>`<tr><td>${esc(i.product_name)}<br><small>${esc(i.sku)} ${esc(i.size)} ${esc(i.color)}<br>${i.quantity} ${i.unit==='pair'?'par(es)':'unidad(es)'} × S/ ${(Number(i.unit_price)-Number(i.unit_discount)).toFixed(2)}</small></td><td>S/ ${esc(i.subtotal)}</td></tr>`).join('')}</table>
  <hr><p><b>TOTAL: S/ ${esc(order.total)}</b></p><p>Medio: ${esc(order.payment_method)}</p><p>Recibido: S/ ${esc(order.tendered)}</p><p>Vuelto: S/ ${esc(order.change_amount)}</p>
  ${order.returns.length?'<p>Esta venta registra devoluciones. Consultar el historial.</p>':''}<hr><p>${esc(business.ticket_message)}</p><small>Documento interno. No es comprobante electronico SUNAT.</small></body></html>`;
}
export function ticketRoutes(db){
  const router=Router();
  router.get('/sales/:id',async(req,res)=>{
    const order=await orderDetail(db,id.parse(req.params.id),'sale');const [[business]]=await db.query('SELECT * FROM b_settings WHERE id=1');
    if(req.query.format==='html')return res.type('html').send(ticketHtml(business,order));
    res.json({business,order,documentType:'internal_sale_note'});
  });return router;
}
