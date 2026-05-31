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
    const countRes = await pgPool.query("SELECT COUNT(*) FROM users WHERE username ~ '^user_[a-zA-Z0-9]{6}$'");
    console.log(`Total users matching '^user_[a-zA-Z0-9]{6}$': ${countRes.rows[0].count}`);

    const uploadRes = await pgPool.query("SELECT COUNT(*) FROM users u WHERE u.username ~ '^user_[a-zA-Z0-9]{6}$' AND NOT EXISTS (SELECT 1 FROM images WHERE user_id = u.id)");
    console.log(`Matching users with 0 uploads: ${uploadRes.rows[0].count}`);

    console.log('Purging all auto-generated placeholder dummy users...');
    const result = await pgPool.query("DELETE FROM users WHERE username ~ '^user_[a-zA-Z0-9]{6}$'");
    console.log(`✅ Purged ${result.rowCount} placeholder user accounts!`);
  } catch (error) {
    console.error('Error cleaning up bot users:', error);
  } finally {
    await pgPool.end();
  }
}

cleanup().catch(console.error);
