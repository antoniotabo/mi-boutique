import { createInterface } from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
const rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  const username = (await rl.question('Usuario administrador: ')).trim();
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) throw new Error('Usuario: 3 a 80 letras, numeros, punto o guion.');
  console.log('La clave se muestra solo en esta terminal. No compartas capturas.');
  const password = await rl.question('Clave (minimo 12 caracteres): ');
  if (password.length < 12 || Buffer.byteLength(password,'utf8') > 72) throw new Error('Clave: minimo 12 caracteres y maximo 72 bytes.');
  if (password !== await rl.question('Repite la clave: ')) throw new Error('Las claves no coinciden.');
  await pool.execute("INSERT INTO users(username,password_hash,role,active,must_change_password) VALUES(?,?,'admin',1,0)", [username, await bcrypt.hash(password,12)]);
  console.log('Administrador creado.');
} catch (error) { console.error(error.code === 'ER_DUP_ENTRY' ? 'Ese usuario ya existe y no se modifico.' : error.code || error.message); process.exitCode=1; }
finally { rl.close(); await pool.end(); }
