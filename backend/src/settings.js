import { Router } from 'express';
import { z } from 'zod';
import { transaction } from './core.js';
export function settingsRoutes(db){
  const router=Router();
  router.get('/',async(req,res)=>{const [[row]]=await db.query('SELECT * FROM b_settings WHERE id=1');res.json(row);});
  router.put('/',async(req,res)=>{
    const data=z.object({businessName:z.string().trim().min(2).max(120),document:z.string().trim().max(30).default(''),
      address:z.string().trim().max(250).default(''),phone:z.string().trim().max(30).default(''),
      ticketMessage:z.string().trim().max(250).default('Gracias por tu compra'),paperWidth:z.enum(['58','80']).default('80')}).strict().parse(req.body);
    res.json(await transaction(db,req.user,'settings.update',data,async c=>{
      await c.execute('UPDATE b_settings SET business_name=?,document=?,address=?,phone=?,ticket_message=?,paper_width=? WHERE id=1',
        [data.businessName,data.document,data.address,data.phone,data.ticketMessage,data.paperWidth]);return data;
    },true));
  });return router;
}
