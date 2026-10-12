import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Ejecutar desde backend para cargar su .env. No imprime credenciales.
const moduleUrl = process.env.BACKUP_CONFIG_MODULE
  ? pathToFileURL(path.resolve(process.env.BACKUP_CONFIG_MODULE)).href
  : new URL('../src/db.js', import.meta.url).href;
const { config, pool } = await import(moduleUrl);
const verify = process.argv.includes('--verify');
const outputDir = path.resolve(process.env.BACKUP_DIR || '../backups/database');
const binDir = process.env.MYSQL_BIN || 'C:/Program Files/MySQL/MySQL Server 8.0/bin';
const binary = name => path.join(binDir, name + (process.platform === 'win32' ? '.exe' : ''));
const connectionArgs = ['--protocol=TCP', '--host=' + config.host, '--port=' + config.port, '--user=' + config.user, '--default-character-set=utf8mb4'];
const dumpArgs = [...connectionArgs, '--single-transaction', '--quick', '--skip-lock-tables', '--no-tablespaces', '--set-gtid-purged=OFF', '--hex-blob', '--order-by-primary', '--skip-comments', '--skip-dump-date', '--routines', '--events', '--triggers'];
const quote = name => '`' + name.replaceAll('`', '``') + '`';

async function run(name, args, input, output) {
  const child = spawn(binary(name), args, { windowsHide: true, env: { ...process.env, MYSQL_PWD: String(config.password ?? '') }, stdio: ['pipe', 'pipe', 'pipe'] });
  // Keep stderr private: connection errors can contain connection details.
  child.stderr.resume();
  const completed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(name + ' terminó con código ' + code + '. Revisa conexión, permisos y MYSQL_BIN.')));
  });
  const tasks = [completed];
  if (input) tasks.push(pipeline(createReadStream(input), child.stdin));
  else child.stdin.end();
  if (output) tasks.push(pipeline(child.stdout, createWriteStream(output, { flags: 'wx' })));
  else child.stdout.resume();
  try { await Promise.all(tasks); }
  catch (error) { child.kill(); await Promise.allSettled(tasks); throw error; }
}

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function comparableDigest(file) {
  const hash = createHash('sha256');
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (let line of lines) {
    // MySQL may expand the charset implied by a column's collation on restore.
    // Normalize only column definitions, never INSERT values.
    if (/^  `/.test(line)) line = line.replace(/ CHARACTER SET ([a-z0-9]+) COLLATE \1_/gi, ' COLLATE $1_');
    hash.update(line + '\n');
  }
  return hash.digest('hex');
}

let temporaryDatabase;
let partial;
let secondDump;
try {
  for (const name of verify ? ['mysqldump', 'mysql'] : ['mysqldump']) {
    if (!existsSync(binary(name))) throw new Error('No se encontró ' + name + '. Configura MYSQL_BIN con la carpeta bin de MySQL.');
  }
  const [tables] = await pool.execute('SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE=\'BASE TABLE\'', [config.database]);
  if (!tables.length || tables.some(t => t.engine !== 'InnoDB')) throw new Error('Se necesita una base con tablas InnoDB para generar un respaldo consistente.');
  await mkdir(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const file = path.join(outputDir, 'boutique-' + stamp + '-' + randomBytes(3).toString('hex') + '.sql');
  partial = file + '.partial';
  await run('mysqldump', [...dumpArgs, config.database], null, partial);
  await rename(partial, file);
  partial = null;
  const sha256 = await digest(file);
  const manifest = { createdAt: new Date().toISOString(), database: config.database, file: path.basename(file), sha256, verified: false };
  await writeFile(file + '.json', JSON.stringify(manifest, null, 2));
  console.log('Respaldo guardado: ' + file);
  if (verify) {
    const testName = 'boutique_restore_test_' + randomBytes(8).toString('hex');
    if (testName === config.database) throw new Error('La base de prueba debe ser distinta.');
    const [[settings]] = await pool.execute('SELECT DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [config.database]);
    if (!/^[a-z0-9_]+$/i.test(settings.charset) || !/^[a-z0-9_]+$/i.test(settings.collation)) throw new Error('Configuración de texto inesperada.');
    await pool.query('CREATE DATABASE ' + quote(testName) + ' CHARACTER SET ' + settings.charset + ' COLLATE ' + settings.collation);
    temporaryDatabase = testName;
    await run('mysql', [...connectionArgs, '--binary-mode', testName], file);
    secondDump = file + '.verification';
    await run('mysqldump', [...dumpArgs, testName], null, secondDump);
    if (await comparableDigest(secondDump) !== await comparableDigest(file)) throw new Error('La restauración terminó pero su contenido no coincide; conserva el respaldo y revisa antes de usarlo.');
    manifest.verified = true;
    manifest.verifiedAt = new Date().toISOString();
    await writeFile(file + '.json', JSON.stringify(manifest, null, 2));
    console.log('Verificado: restauración en base temporal y comparación completa de estructura y datos correctas.');
  }
} catch (error) {
  console.error('No se completó el respaldo/verificación: ' + error.message);
  process.exitCode = 1;
} finally {
  try {
    // Solo se elimina la base aleatoria creada exitosamente por esta ejecución.
    if (temporaryDatabase) await pool.query('DROP DATABASE ' + quote(temporaryDatabase));
  } catch { console.error('No se pudo eliminar la base temporal: ' + temporaryDatabase); process.exitCode = 1; }
  for (const file of [partial, process.exitCode ? null : secondDump]) if (file) await rm(file, { force: true }).catch(() => {});
  await pool.end();
}



