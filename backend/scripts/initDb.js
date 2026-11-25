import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sql = await fs.readFile(path.join(__dirname, "../database/init.sql"), "utf8");

await pool.query(sql);
console.log("Database initialized successfully.");

await pool.end();
