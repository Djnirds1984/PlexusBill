/**
 * Migration Script: Add Missing Columns to Tenant Databases
 * 
 * This script adds the cycle_days and store_enabled columns to billing_plans
 * table in all existing tenant databases.
 * 
 * Usage: node migrate-tenant-billing-plans.js
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const SUPERADMIN_DB_PATH = path.join(__dirname, 'superadmin.db');
const TENANTS_DIR = path.join(__dirname, 'tenant-databases');

async function migrateTenantDatabases() {
    console.log('=== Tenant Billing Plans Migration ===\n');
    
    // Check if superadmin.db exists
    if (!fs.existsSync(SUPERADMIN_DB_PATH)) {
        console.error('✗ superadmin.db not found!');
        process.exit(1);
    }
    console.log('✓ Opening superadmin database...\n');
    
    const superadminDb = await open({
        filename: SUPERADMIN_DB_PATH,
        driver: sqlite3.Database
    });
    
    // Get all approved tenants
    const tenants = await superadminDb.all(
        'SELECT * FROM tenants WHERE approval_status = ? AND status = ?',
        'approved', 'active'
    );
    
    console.log(`Found ${tenants.length} approved tenant(s)\n`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const tenant of tenants) {
        console.log(`\n--- Migrating: ${tenant.name} (${tenant.slug}) ---`);
        
        const dbPath = tenant.database_path || path.join(TENANTS_DIR, `tenant_${tenant.slug}.db`);
        
        if (!fs.existsSync(dbPath)) {
            console.log(`✗ Database file not found: ${dbPath}`);
            console.log('  Skipping (run recreate-missing-tenant-dbs.js first)\n');
            skipped++;
            continue;
        }
        
        try {
            const tenantDb = await open({
                filename: dbPath,
                driver: sqlite3.Database
            });
            
            // Check current columns in billing_plans
            const columns = await tenantDb.all("PRAGMA table_info(billing_plans)");
            const columnNames = columns.map(c => c.name);
            
            console.log(`  Current columns: ${columnNames.join(', ')}`);
            
            let needsMigration = false;
            
            // Add cycle_days if missing
            if (!columnNames.includes('cycle_days')) {
                console.log('  Adding cycle_days column...');
                await tenantDb.exec("ALTER TABLE billing_plans ADD COLUMN cycle_days INTEGER DEFAULT 30");
                console.log('  ✓ cycle_days added');
                needsMigration = true;
            } else {
                console.log('  ✓ cycle_days already exists');
            }
            
            // Add store_enabled if missing
            if (!columnNames.includes('store_enabled')) {
                console.log('  Adding store_enabled column...');
                await tenantDb.exec("ALTER TABLE billing_plans ADD COLUMN store_enabled INTEGER DEFAULT 1");
                console.log('  ✓ store_enabled added');
                needsMigration = true;
            } else {
                console.log('  ✓ store_enabled already exists');
            }
            
            if (needsMigration) {
                console.log(`  ✓ Migration completed for ${tenant.name}`);
                migrated++;
            } else {
                console.log(`  ✓ No migration needed (already up to date)`);
                skipped++;
            }
            
            await tenantDb.close();
            
        } catch (err) {
            console.error(`  ✗ Error migrating ${tenant.name}: ${err.message}`);
            errors++;
        }
        
        console.log('');
    }
    
    console.log('\n=== Migration Complete ===');
    console.log(`Migrated: ${migrated} database(s)`);
    console.log(`Skipped (up to date): ${skipped} database(s)`);
    console.log(`Errors: ${errors} database(s)`);
    console.log(`Total processed: ${tenants.length} tenant(s)\n`);
    
    await superadminDb.close();
}

// Run the migration
migrateTenantDatabases()
    .then(() => {
        console.log('Migration finished successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
