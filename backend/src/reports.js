import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { admin, fail } from './core.js';

const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{
  const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s&&s>='2000-01-01'&&s<='2099-12-31';
},'Fecha invalida.');
export function dateRange(query){
  const today=new Date(Date.now()-5*3600000).toISOString().slice(0,10);
  const from=day.parse(query.from??today),to=day.parse(query.to??today);
  if(from>to || new Date(to)-new Date(from)>366*86400000)fail('El rango debe ser de hasta 366 dias, en orden.',400);
  // Peru UTC-5. Use UTC boundaries independent of MySQL host timezone.
  return {from,to,start:from+' 05:00:00',end:new Date(new Date(to+'T05:00:00Z').getTime()+86400000).toISOString().slice(0,19).replace('T',' ')};
}
async function salesRows(c,range){
  const [rows]=await c.execute(`SELECT o.id,'sale' AS event,o.created_at,o.party_name,o.total AS amount,o.payment_method,u.username
    FROM b_orders o JOIN users u ON u.id=o.user_id WHERE o.kind='sale' AND o.created_at>=? AND o.created_at<?
    UNION ALL
    SELECT r.id,'return',r.created_at,o.party_name,-r.total,o.payment_method,u.username
    FROM b_returns r JOIN b_orders o ON o.id=r.order_id JOIN users u ON u.id=r.user_id
    WHERE o.kind='sale' AND r.created_at>=? AND r.created_at<? ORDER BY created_at,id LIMIT 10001`,[range.start,range.end,range.start,range.end]);
  if(rows.length>10000)fail('Demasiados resultados. Reduce el rango de fechas.',400);return rows;
}
export async function summary(db,range){
  const c=await db.getConnection();
  try{
    await c.beginTransaction();
    const [[sales]]=await c.execute("SELECT COUNT(*) AS count,COALESCE(SUM(total),0) AS total FROM b_orders WHERE kind='sale' AND created_at>=? AND created_at<?",[range.start,range.end]);
    const [[returns]]=await c.execute("SELECT COALESCE(SUM(r.total),0) AS total FROM b_returns r JOIN b_orders o ON o.id=r.order_id WHERE o.kind='sale' AND r.created_at>=? AND r.created_at<?",[range.start,range.end]);
    const [[margin]]=await c.execute(`SELECT COALESCE(SUM(i.subtotal-i.unit_cost*i.quantity),0) AS total FROM b_order_items i JOIN b_orders o ON o.id=i.order_id WHERE o.kind='sale' AND o.created_at>=? AND o.created_at<?`,[range.start,range.end]);
    const [[returnedMargin]]=await c.execute(`SELECT COALESCE(SUM(ri.subtotal-i.unit_cost*ri.quantity),0) AS total FROM b_return_items ri JOIN b_returns r ON r.id=ri.return_id JOIN b_order_items i ON i.id=ri.order_item_id JOIN b_orders o ON o.id=r.order_id WHERE o.kind='sale' AND r.created_at>=? AND r.created_at<?`,[range.start,range.end]);
    const [[stock]]=await c.query('SELECT COUNT(*) AS variants,COALESCE(SUM(stock),0) AS units,COALESCE(SUM(stock*cost),0) AS estimated_cost FROM b_variants');
    const [lowStock]=await c.query('SELECT v.id,v.sku,v.size,v.color,v.stock,v.min_stock,p.name FROM b_variants v JOIN b_products p ON p.id=v.product_id WHERE v.active=1 AND p.active=1 AND v.stock<=v.min_stock ORDER BY v.stock,v.id LIMIT 50');
    await c.commit();
    return {from:range.from,to:range.to,timezone:'America/Lima',salesCount:Number(sales.count),grossSales:sales.total,returns:returns.total,
      netSales:(Number(sales.total)-Number(returns.total)).toFixed(2),estimatedGrossMargin:(Number(margin.total)-Number(returnedMargin.total)).toFixed(2),stock,lowStock};
  }catch(e){await c.rollback();throw e;}finally{c.release();}
}
export function reportRoutes(db){
  const router=Router();router.use(admin);
  router.get('/summary',async(req,res)=>res.json(await summary(db,dateRange(req.query))));
  router.get('/sales',async(req,res)=>res.json(await salesRows(db,dateRange(req.query))));
  router.get('/sales.xlsx',async(req,res)=>{
    const range=dateRange(req.query),rows=await salesRows(db,range);
    const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Ventas y devoluciones');
    sheet.columns=[{header:'ID',key:'id',width:12},{header:'Operacion',key:'event',width:15},{header:'Fecha UTC',key:'created_at',width:24},
      {header:'Cliente',key:'party_name',width:32},{header:'Importe S/',key:'amount',width:18},{header:'Medio',key:'payment_method',width:18},{header:'Usuario',key:'username',width:20}];
    for(const row of rows)sheet.addRow({...row,amount:Number(row.amount)});
    sheet.getRow(1).font={bold:true};sheet.getColumn('amount').numFmt='0.00';sheet.views=[{state:'frozen',ySplit:1}];
    res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition',`attachment; filename="boutique-ventas-${range.from}-${range.to}.xlsx"`);
    res.send(Buffer.from(await book.xlsx.writeBuffer()));
  });
  return router;
}
