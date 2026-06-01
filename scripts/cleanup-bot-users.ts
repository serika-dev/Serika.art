import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) process.env[key] = valueParts.join('=');
      }
    }
  }
}

loadEnvFile();

const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
  console.error('Error: POSTGRES_URL is not defined in .env.local');
  process.exit(1);
}

async function cleanup() {
  console.log('Connecting to PostgreSQL database...');
  const pgPool = new Pool({ connectionString: postgresUrl, max: 1 });

  try {
    console.log('Beginning split-query database consolidation...');

    // 1. Ensure system user exists
    await pgPool.query(`
      INSERT INTO users (id, username, rank, created_at)
      VALUES ('system', 'system', 'admin', '2000-01-01 00:00:00+00')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('  - Ensured system user account exists.');

    // 2. Consolidate anonymous images under system (split queries)
    let res = await pgPool.query(`
      UPDATE images 
      SET user_id = 'system' 
      WHERE user_id IS NULL
    `);
    console.log(`  - Reassigned ${res.rowCount} null user_id images to 'system'.`);

    try {
      res = await pgPool.query(`
        UPDATE images 
        SET user_id = 'system' 
        WHERE username = 'Anonymous' AND user_id != 'system'
      `);
      console.log(`  - Reassigned ${res.rowCount} Anonymous images to 'system'.`);
    } catch (e: any) {
      console.log(`  ⚠️ Warning during Anonymous images reassignment: ${e.message}`);
    }

    try {
      res = await pgPool.query(`
        UPDATE images 
        SET user_id = 'system' 
        WHERE user_id ~ '^user_[a-zA-Z0-9]{6}$'
      `);
      console.log(`  - Reassigned ${res.rowCount} dummy user_id images to 'system'.`);
    } catch (e: any) {
      console.log(`  ⚠️ Warning during dummy user_id images reassignment: ${e.message}`);
    }

    // 3. Consolidate anonymous comments under system (split queries)
    res = await pgPool.query(`
      UPDATE comments 
      SET user_id = 'system' 
      WHERE user_id IS NULL
    `);
    console.log(`  - Reassigned ${res.rowCount} null user_id comments to 'system'.`);

    res = await pgPool.query(`
      UPDATE comments 
      SET user_id = 'system' 
      WHERE username = 'Anonymous' AND user_id != 'system'
    `);
    console.log(`  - Reassigned ${res.rowCount} Anonymous comments to 'system'.`);

    res = await pgPool.query(`
      UPDATE comments 
      SET user_id = 'system' 
      WHERE user_id ~ '^user_[a-zA-Z0-9]{6}$'
    `);
    console.log(`  - Reassigned ${res.rowCount} dummy user_id comments to 'system'.`);

    // 4. Clean up any remaining placeholder dummy users
    const userRes = await pgPool.query(`
      DELETE FROM users 
      WHERE username ~ '^user_[a-zA-Z0-9]{6}$'
    `);
    console.log(`  - Deleted ${userRes.rowCount} remaining placeholder dummy user profiles.`);

    console.log('\n✅ Database consolidated successfully!');
  } catch (error) {
    console.error('\n❌ Error in consolidation:', error);
  } finally {
    await pgPool.end();
  }
}

cleanup().catch(console.error);
