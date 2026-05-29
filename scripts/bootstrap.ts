import { ensureSchema, query } from '../lib/db';

async function bootstrap() {
  console.log('Bootstrapping database schema...');
  await ensureSchema();
  
  console.log('Adding extra columns for DMCA...');
  await query(`
    ALTER TABLE dmca_requests ADD COLUMN IF NOT EXISTS affected_image_ids JSONB;
    ALTER TABLE dmca_requests ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;
  `);
  
  console.log('Database successfully bootstrapped!');
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
});
