import { pool } from '../src/db.js';
try {
  const [[row]] = await pool.query('SELECT DATABASE() AS name');
  const [[version]] = await pool.query('SELECT version FROM b_schema_versions WHERE version=1');
  if (!version) throw new Error('Ejecuta npm run db:migrate.');
  console.log(`Conexion correcta: ${row.name}. Boutique version ${version.version}.`);
} catch (error) { console.error(error.code || error.message); process.exitCode = 1; }
finally { await pool.end(); }
