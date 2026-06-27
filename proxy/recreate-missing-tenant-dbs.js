/**
 * Recovery Script: Recreate Missing Tenant Databases
 * 
 * This script finds all approved tenants in superadmin.db that are missing
 * their database files and recreates them with the proper schema.
 * 
 * Usage: node recreate-missing-tenant-dbs.js
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { initializeTenantSchema, seedDefaultRoles } = require('./tenantManager');

const SUPERADMIN_DB_PATH = path.join(__dirname, 'superadmin.db');
const TENANTS_DIR = path.join(__dirname, 'tenant-databases');

async function recreateMissingTenantDatabases() {
    console.log('=== Tenant Database Recovery Script ===\n');
    
    // Ensure tenant-databases directory exists
    if (!fs.existsSync(TENANTS_DIR)) {
        fs.mkdirSync(TENANTS_DIR, { recursive: true });
        console.log('Created tenant-databases directory\n');
    }
    
    // Open superadmin database
    const superadminDb = await open({
        filename: SUPERADMIN_DB_PATH,
        driver: sqlite3.Database
    });
    
    console.log('Opening superadmin database...\n');
    
    // Get all approved tenants
    const tenants = await superadminDb.all(
        'SELECT * FROM tenants WHERE approval_status = ? AND status = ?',
        'approved', 'active'
    );
    
    console.log(`Found ${tenants.length} approved tenant(s)\n`);
    
    let recreated = 0;
    let skipped = 0;
    
    for (const tenant of tenants) {
        console.log(`\n--- Processing: ${tenant.name} (${tenant.slug}) ---`);
        
        // Determine database path
        const dbPath = tenant.database_path || path.join(TENANTS_DIR, `tenant_${tenant.slug}.db`);
        
        // Check if database file exists
        if (fs.existsSync(dbPath)) {
            console.log(`✓ Database file already exists: ${dbPath}`);
            console.log('  Skipping...\n');
            skipped++;
            continue;
        }
        
        console.log(`✗ Database file missing: ${dbPath}`);
        console.log('  Creating new database...\n');
        
        try {
            // Create new database
            const tenantDb = await open({
                filename: dbPath,
                driver: sqlite3.Database
            });
            
            // Enable WAL mode
            await tenantDb.exec('PRAGMA journal_mode = WAL;');
            
            // Initialize schema
            console.log('  Initializing schema...');
            await initializeTenantSchema(tenantDb);
            
            // Recreate admin user if we have the credentials
            if (tenant.admin_username && tenant.admin_password_hash) {
                console.log('  Recreating admin user...');
                
                const userId = `user_admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                await tenantDb.run(
                    'INSERT INTO users (id, username, password, role_id) VALUES (?, ?, ?, ?)',
                    userId,
                    tenant.admin_username,
                    tenant.admin_password_hash, // Reuse existing password hash
                    'role_admin'
                );
                
                console.log(`  ✓ Admin user created: ${tenant.admin_username}`);
            }
            
            // Update tenant record with correct database_path
            await superadminDb.run(
                'UPDATE tenants SET database_path = ?, updated_at = datetime(\'now\') WHERE id = ?',
                dbPath,
                tenant.id
            );
            
            console.log(`  ✓ Database path updated in superadmin.db`);
            console.log(`  ✓ Successfully recreated database for ${tenant.name}\n`);
            
            await tenantDb.close();
            recreated++;
            
        } catch (error) {
            console.error(`  ✗ ERROR creating database for ${tenant.name}:`, error.message);
            console.error('  Stack:', error.stack, '\n');
        }
    }
    
    console.log('\n=== Recovery Complete ===');
    console.log(`Recreated: ${recreated} database(s)`);
    console.log(`Skipped (already exist): ${skipped} database(s)`);
    console.log(`Total processed: ${tenants.length} tenant(s)\n`);
    
    await superadminDb.close();
}

// Run the recovery
recreateMissingTenantDatabases()
    .then(() => {
        console.log('Recovery script finished successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Recovery script failed:', error);
        process.exit(1);
    });
