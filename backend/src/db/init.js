import { pool } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const initDb = async () => {
    try {
        console.log('Initializing database...');


        const schemaPath = path.join(__dirname, 'schema.postgresql.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf-8');


        const statements = schemaSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);


        for (const statement of statements) {
            await pool.query(statement);
            console.log('Executed:', statement.split('\n')[0].substring(0, 50) + '...');
        }

        console.log('Database initialized successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
};

initDb();
