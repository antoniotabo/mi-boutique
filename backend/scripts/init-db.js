import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { config, pool } from '../src/db.js';
let conn;
try {
  conn = await mysql.createConnection({ ...config, database: undefined });
  await conn.query('CREATE DATABASE IF NOT EXISTS boutique_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await conn.changeUser({ database: 'boutique_db' });
  const [[locked]] = await conn.query("SELECT GET_LOCK('boutique_schema_v1',10) AS acquired");
  if (Number(locked.acquired) !== 1) throw new Error('Otra inicializacion esta en curso.');
  const sql = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await conn.query(statement);
  for (const field of ['active', 'must_change_password']) {
    const [[row]] = await conn.execute('SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', ['boutique_db', 'users', field]);
    if (!Number(row.n)) await conn.query(`ALTER TABLE users ADD COLUMN ${field} TINYINT NOT NULL DEFAULT ${field === 'active' ? 1 : 0}`);
  }
  const [[version]] = await conn.query('SELECT version FROM b_schema_versions WHERE version=1');
  if (!version) {
    for (const name of ['Ropa', 'Carteras', 'Aretes', 'Collares', 'Pulseras', 'Accesorios']) {
      await conn.execute('INSERT IGNORE INTO b_categories(name) VALUES(?)', [name]);
    }
    await conn.query('INSERT INTO b_schema_versions(version) VALUES(1)');
  }
  console.log('Boutique v1 lista. Usuarios anteriores conservados. Tablas antiguas sin modificar.');
} catch (error) {
  console.error('Inicializacion incompleta:', error.code || error.message);
  process.exitCode = 1;
} finally { await conn?.end(); await pool.end(); }
