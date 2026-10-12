import { Router } from 'express';
import { z } from 'zod';
import { money, requestId, id, transaction, openSession, cashBalance, paymentMove, cents, amount, bounded, fail, page, admin } from './core.js';

export const cashSchemas={
  open:z.object({requestId,amount:money}).strict(),
  movement:z.object({requestId,sessionId:id,kind:z.enum(['income','expense']),amount:money.refine(n=>n>0),note:z.string().trim().min(5).max(250)}).strict(),
  close:z.object({requestId,sessionId:id,counted:money,expected:money,note:z.string().trim().max(250).default('')}).strict()
};
export async function cashOperation(db,kind,input,actor){
  const data=cashSchemas[kind].parse(input);
  return transaction(db,actor,'cash.'+kind,data,async c=>{
    if(kind==='open'){
      const [[old]]=await c.query('SELECT id FROM b_cash_sessions WHERE closed_at IS NULL');
      if(old)fail('Ya existe una caja abierta.');
      const [r]=await c.execute('INSERT INTO b_cash_sessions(opening_amount,opened_by,opened_at) VALUES(?,?,UTC_TIMESTAMP())',[amount(cents(data.amount)),actor.id]);
      return {sessionId:r.insertId,balance:amount(cents(data.amount))};
    }
    const session=await openSession(c,data.sessionId);
    if(kind==='movement'){
      await paymentMove(c,session,data.kind==='income'?cents(data.amount):-cents(data.amount),'cash',data.kind,null,data.note,actor.id);
      return {sessionId:session.id,balance:amount(await cashBalance(c,session))};
    }
    const expected=await cashBalance(c,session),difference=bounded(cents(data.counted)-expected);
    if(cents(data.expected)!==expected)fail('El saldo cambio mientras contabas. Actualiza y revisa antes de cerrar.');
    if(difference!==0&&!data.note)fail('Indica el motivo de la diferencia de caja.',400);
    await c.execute('UPDATE b_cash_sessions SET closed_at=UTC_TIMESTAMP(),closed_by=?,expected_amount=?,counted_amount=?,difference_amount=?,note=? WHERE id=?',
      [actor.id,amount(expected),amount(cents(data.counted)),amount(difference),data.note,session.id]);
    return {sessionId:session.id,expected:amount(expected),counted:amount(cents(data.counted)),difference:amount(difference)};
  },true);
}
export function cashRoutes(db){
  const router=Router();
  // Operators can read the current session to sell, but only admins manage it.
  router.get('/',async(req,res)=>{
    const c=await db.getConnection();
    try{
      await c.beginTransaction();
      const [[session]]=await c.query('SELECT * FROM b_cash_sessions WHERE closed_at IS NULL');
      if(!session){await c.commit();return res.json({session:null});}
      const balance=amount(await cashBalance(c,session));
      const [methods]=await c.execute('SELECT method,COALESCE(SUM(amount),0) AS net FROM b_cash_movements WHERE session_id=? GROUP BY method',[session.id]);
      await c.commit();res.json({session,balance,methods});
    }catch(e){await c.rollback();throw e;}finally{c.release();}
  });
  router.get('/history',admin,async(req,res)=>{
    const {limit,offset}=page(req.query);const [rows]=await db.query(`SELECT * FROM b_cash_sessions ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`);res.json(rows);
  });
  router.get('/:id/movements',admin,async(req,res)=>{
    const sessionId=id.parse(req.params.id),{limit,offset}=page(req.query);
    const [rows]=await db.execute(`SELECT m.*,u.username FROM b_cash_movements m JOIN users u ON u.id=m.user_id WHERE session_id=? ORDER BY m.id DESC LIMIT ${limit} OFFSET ${offset}`,[sessionId]);res.json(rows);
  });
  for(const kind of Object.keys(cashSchemas))router.post('/'+kind,async(req,res)=>res.json(await cashOperation(db,kind,req.body,req.user)));
  return router;
}
