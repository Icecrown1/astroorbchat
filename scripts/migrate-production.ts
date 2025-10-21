#!/usr/bin/env tsx
/**
 * Production Database Migration Script
 * 
 * This script adds the idempotency_key column to the yookassa_payments table
 * in the production database.
 * 
 * Usage:
 *   DATABASE_URL="<production-db-url>" npx tsx scripts/migrate-production.ts
 * 
 * OR if DATABASE_URL is already set to production:
 *   npx tsx scripts/migrate-production.ts
 */

import { neon } from '@neondatabase/serverless';

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.log('\nUsage:');
    console.log('  DATABASE_URL="<production-db-url>" npx tsx scripts/migrate-production.ts');
    process.exit(1);
  }

  console.log('🔧 Connecting to database...');
  console.log('   URL:', databaseUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
  
  const sql = neon(databaseUrl);

  try {
    // Check if column already exists
    console.log('\n📋 Checking if idempotency_key column exists...');
    const checkResult = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'yookassa_payments' 
      AND column_name = 'idempotency_key'
    `;

    if (checkResult.length > 0) {
      console.log('✅ Column idempotency_key already exists - no migration needed');
      process.exit(0);
    }

    console.log('⚠️  Column does not exist - applying migration...');

    // Add the column
    console.log('\n1️⃣  Adding idempotency_key column...');
    await sql`
      ALTER TABLE yookassa_payments 
      ADD COLUMN idempotency_key VARCHAR(255)
    `;
    console.log('   ✓ Column added');

    // Add unique constraint
    console.log('\n2️⃣  Adding unique constraint...');
    await sql`
      ALTER TABLE yookassa_payments 
      ADD CONSTRAINT yookassa_payments_idempotency_key_unique 
      UNIQUE (idempotency_key)
    `;
    console.log('   ✓ Unique constraint added');

    // Add index
    console.log('\n3️⃣  Creating index...');
    await sql`
      CREATE INDEX yookassa_payments_idempotency_key_idx 
      ON yookassa_payments(idempotency_key)
    `;
    console.log('   ✓ Index created');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nYou can now publish your app - the YooKassa payments will work correctly.');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

migrate();
