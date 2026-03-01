import { Pool } from 'pg';
import dotenv from 'dotenv';
import { ENV } from "./env.js";

dotenv.config();

const pool = new Pool({
  user: ENV.DB_USER,
  host: ENV.DB_HOST,
  database: ENV.DB_NAME,
  password: ENV.DB_PASSWORD,
  port: ENV.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;