import { pool } from './db.js';
import { createApp } from './app.js';
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const server=createApp(pool).listen(port,host,()=>console.log(`Boutique API: http://${host}:${port}/api/health`));
server.on('error',async e=>{console.error(e.code==='EADDRINUSE'?'El puerto esta ocupado. Cierra el servidor anterior.':e.code);await pool.end();process.exitCode=1;});
function shutdown(){server.close(async()=>{await pool.end();process.exit(0);});}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
