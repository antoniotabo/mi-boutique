import { Router } from 'express';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, writeFile, rename, lstat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const validFile = /^boutique-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{6}\.sql$/;
async function hash(file) {
  const h = createHash('sha256');
  for await (const part of createReadStream(file)) h.update(part);
  return h.digest('hex');
}
function launch(root, dir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts/backup.mjs'), '--verify'], {
      cwd: root, windowsHide: true,
      env: { ...process.env, BACKUP_DIR: dir, BACKUP_CONFIG_MODULE: path.join(root, 'src/db.js') },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', chunk => { output = (output + chunk).slice(-16384); });
    child.stderr.resume();
    child.once('error', reject);
    child.once('close', code => {
      const line = output.split(/\r?\n/).find(x => x.startsWith('Respaldo guardado: '));
      const file = line ? path.basename(line.slice('Respaldo guardado: '.length).trim()) : null;
      resolve({ code, file });
    });
  });
}

export function backupRoutes(options = {}) {
  const root = options.root || fileURLToPath(new URL('../', import.meta.url));
  const dir = options.dir || path.resolve(root, process.env.BACKUP_DIR || '../backups/database');
  const run = options.run || launch;
  const stateFile = path.join(dir, '.last-job.json');
  let running = false;
  let job = null;
  const ready = (async () => {
    await mkdir(dir, { recursive: true });
    try { job = JSON.parse(await readFile(stateFile, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e; }
    if (job?.status === 'running') job = { ...job, status: 'interrupted', message: 'El servidor se reinició. Revisa el historial antes de crear otro respaldo.' };
  })();
  // Let Express surface initialization errors on a request, without an unhandled rejection.
  ready.catch(() => {});
  async function save() {
    const temp = stateFile + '.' + randomUUID();
    await writeFile(temp, JSON.stringify(job));
    await rename(temp, stateFile);
  }
  async function record(file) {
    if (!validFile.test(file)) return null;
    try {
      const sqlPath = path.join(dir, file);
      const metaPath = sqlPath + '.json';
      const [stat, metaStat] = await Promise.all([lstat(sqlPath), lstat(metaPath)]);
      if (!stat.isFile() || stat.isSymbolicLink() || !metaStat.isFile() || metaStat.isSymbolicLink()) return null;
      const meta = JSON.parse(await readFile(metaPath, 'utf8'));
      if (meta.file !== file || !/^[a-f0-9]{64}$/.test(meta.sha256) || !Number.isFinite(Date.parse(meta.createdAt))) return null;
      return { file, createdAt: meta.createdAt, verified: meta.verified === true, bytes: stat.size, sha256: meta.sha256 };
    } catch (e) { if (e.code === 'ENOENT' || e instanceof SyntaxError) return null; throw e; }
  }
  async function execute() {
    try {
      const result = await run(root, dir);
      const item = result.file ? await record(result.file) : null;
      if (result.code !== 0 || !item?.verified || await hash(path.join(dir, item.file)) !== item.sha256) throw new Error('verification');
      job = { ...job, status: 'completed', finishedAt: new Date().toISOString(), file: item.file, message: 'Respaldo creado y recuperación verificada.' };
    } catch {
      job = { ...job, status: 'failed', finishedAt: new Date().toISOString(), message: 'No se completó la verificación. Revisa MySQL, el script de respaldo y los permisos de la carpeta. El historial conserva los archivos generados.' };
    } finally {
      try { await save(); }
      catch { job = { ...job, status: 'failed', message: 'No se pudo guardar el resultado en disco. Revisa el historial y el espacio disponible.' }; }
      running = false;
    }
  }
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Solo el administrador puede administrar respaldos.' });
    next();
  });
  router.get('/', async (req, res) => {
    await ready;
    const items = [];
    for (const file of await readdir(dir)) { const item = await record(file); if (item) items.push(item); }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ job, items });
  });
  router.post('/', async (req, res) => {
    await ready;
    if (running) return res.status(409).json({ message: 'Ya hay un respaldo en proceso.' });
    running = true;
    job = { id: randomUUID(), status: 'running', startedAt: new Date().toISOString(), message: 'Creando respaldo y comprobando su recuperación…' };
    try { await save(); } catch (e) { running = false; job = null; throw e; }
    res.status(202).json(job);
    void execute();
  });
  router.get('/:file/:format', async (req, res, next) => {
    await ready;
    const { file, format } = req.params;
    if (!['sql', 'json'].includes(format)) return res.status(404).json({ message: 'Archivo no encontrado.' });
    const item = await record(file);
    if (!item) return res.status(404).json({ message: 'Respaldo no encontrado.' });
    if (!item.verified) return res.status(409).json({ message: 'Este respaldo aún no tiene una recuperación verificada.' });
    if (await hash(path.join(dir, file)) !== item.sha256) return res.status(409).json({ message: 'El archivo cambió desde su verificación. Crea un respaldo nuevo.' });
    const name = file + (format === 'json' ? '.json' : '');
    res.download(path.join(dir, name), name, error => { if (error) next(error); });
  });
  return router;
}

