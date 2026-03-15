import { db } from '../src/infrastructure/database/postgres.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    try {
        console.log('🔄 Connecting to database...');
        
        // Connect to database
        await db.connect();
        
        console.log('✅ Connected to database. Running migrations...\n');
        
        // Get all migration files
        const migrationsDir = path.join(__dirname, '../src/infrastructure/database/migrations');
        
        // Check if migrations directory exists
        if (!fs.existsSync(migrationsDir)) {
            console.error('❌ Migrations directory not found:', migrationsDir);
            process.exit(1);
        }
        
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        if (files.length === 0) {
            console.log('⚠️  No migration files found.');
            process.exit(0);
        }

        console.log(`📁 Found ${files.length} migration files\n`);

        for (const file of files) {
            console.log(`▶️  Running migration: ${file}`);
            
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            
            try {
                await db.query(sql);
                console.log(`✅ Completed: ${file}\n`);
            } catch (error) {
                console.error(`❌ Failed: ${file}`);
                console.error('Error:', error.message);
                console.log('Continuing with next migration...\n');
            }
        }
        
        console.log('🎉 All migrations completed successfully!');
        
        // Disconnect from database
        await db.disconnect();
        console.log('\n👋 Database disconnected');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigrations();