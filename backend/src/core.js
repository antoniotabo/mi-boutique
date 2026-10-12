import { createHash } from 'node:crypto';
import { z } from 'zod';

export class BusinessError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}
export const fail = (message, status) => { throw new BusinessError(message, status); };
export const id = z.coerce.number().int().positive().max(4294967295);
export const quantity = z.number().int().positive().max(1000000);
export const money = z.number().finite().min(0).max(9999999.99)
  .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001, 'Usa como maximo dos decimales.');
export const cents = n => Math.round(Number(n) * 100);
export const amount = n => (n / 100).toFixed(2);
export const method = z.enum(['cash', 'yape', 'plin', 'card', 'transfer']);
export const requestId = z.uuid();
export const hash = value => createHash('sha256').update(value).digest('hex');
export const admin = (req, res, next) => req.user.role === 'admin'
  ? next() : res.status(403).json({ message: 'Solo el administrador puede realizar esta operacion.' });
export function bounded(n) {
  if (!Number.isSafeInteger(n) || Math.abs(n) > 99999999999) fail('El importe supera el limite permitido.', 400);
  return n;
}
export function page(query) {
  return {
    limit: z.coerce.number().int().min(1).max(200).default(50).parse(query.limit),
    offset: z.coerce.number().int().min(0).max(10000000).default(0).parse(query.offset)
  };
}
export async function transaction(db, actor, action, data, work, adminOnly = false) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Single write lock keeps stock, cash and idempotency consistent for this small shop.
    const [[lock]] = await conn.query('SELECT id FROM b_lock WHERE id=1 FOR UPDATE');
    if (!lock) fail('Ejecuta npm run db:migrate.', 503);
    const [[user]] = await conn.execute(`SELECT u.id,u.role,u.active,u.must_change_password
      FROM users u JOIN sessions s ON s.user_id=u.id
      WHERE u.id=? AND s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() FOR SHARE`, [actor.id, actor.tokenHash]);
    if (!user || !user.active || user.must_change_password) fail('Vuelve a iniciar sesion.', 401);
    if (adminOnly && user.role !== 'admin') fail('Solo el administrador puede realizar esta operacion.', 403);
    const fingerprint = hash(JSON.stringify({ action, userId: actor.id, data }));
    if (data.requestId) {
      const [[old]] = await conn.execute('SELECT fingerprint,result_json FROM b_requests WHERE request_id=?', [data.requestId]);
      if (old) {
        if (old.fingerprint !== fingerprint) fail('Esta solicitud ya se uso con otros datos.');
        await conn.commit();
        return typeof old.result_json === 'string' ? JSON.parse(old.result_json) : old.result_json;
      }
    }
    const result = await work(conn, user);
    if (data.requestId) await conn.execute('INSERT INTO b_requests(request_id,fingerprint,result_json) VALUES(?,?,?)', [data.requestId, fingerprint, JSON.stringify(result)]);
    await conn.commit();
    return result;
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
export async function stockMove(conn, variantId, delta, kind, referenceId, note, userId) {
  const [[variant]] = await conn.execute('SELECT stock FROM b_variants WHERE id=? FOR UPDATE', [variantId]);
  if (!variant) fail('Variante no encontrada.', 404);
  const after = Number(variant.stock) + delta;
  if (!Number.isInteger(delta) || !Number.isSafeInteger(after) || after < 0 || after > 100000000) fail('Stock insuficiente o cantidad fuera de rango.');
  await conn.execute('UPDATE b_variants SET stock=? WHERE id=?', [after, variantId]);
  await conn.execute(`INSERT INTO b_stock_movements(variant_id,quantity,balance,kind,reference_id,note,user_id)
    VALUES(?,?,?,?,?,?,?)`, [variantId, delta, after, kind, referenceId, note, userId]);
  return after;
}
export async function openSession(conn, sessionId) {
  const [[session]] = await conn.query('SELECT * FROM b_cash_sessions WHERE closed_at IS NULL FOR UPDATE');
  if (!session || Number(session.id) !== sessionId) fail('Abre caja o actualiza la sesion de caja antes de continuar.');
  return session;
}
export async function cashBalance(conn, session) {
  const [[row]] = await conn.execute("SELECT COALESCE(SUM(amount),0) AS net FROM b_cash_movements WHERE session_id=? AND method='cash'", [session.id]);
  return bounded(cents(session.opening_amount) + cents(row.net));
}
export async function paymentMove(conn, session, signedCents, paymentMethod, kind, referenceId, note, userId) {
  bounded(signedCents);
  if (paymentMethod === 'cash' && bounded(await cashBalance(conn, session) + signedCents) < 0) fail('No hay efectivo suficiente en caja.');
  if (!signedCents) return;
  await conn.execute(`INSERT INTO b_cash_movements(session_id,amount,method,kind,reference_id,note,user_id)
    VALUES(?,?,?,?,?,?,?)`, [session.id, amount(signedCents), paymentMethod, kind, referenceId, note, userId]);
}
