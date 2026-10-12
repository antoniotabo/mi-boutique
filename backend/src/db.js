import 'dotenv/config';
import mysql from 'mysql2/promise';
if (process.env.DB_NAME !== 'boutique_db') throw new Error('DB_NAME debe ser boutique_db.');
if (!process.env.DB_USER || process.env.DB_PASSWORD === undefined) throw new Error('Configura DB_USER y DB_PASSWORD en backend/.env.');
export const config = {
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: 'boutique_db', charset: 'utf8mb4', timezone: 'Z', dateStrings: true
};
export const pool = mysql.createPool({ ...config, connectionLimit: 8 });
