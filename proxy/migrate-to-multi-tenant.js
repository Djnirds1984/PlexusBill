/**
 * Migration script to convert existing single-tenant installation to multi-tenant
 * Creates a default tenant from existing panel.db data
 * 
 * Usage: node proxy/migrate-to-multi-tenant.js
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const PROXY_DIR = __dirname;
const DB_PATH = path.join(PROXY_DIR, 'panel.db');
const SUPERADMIN_DB_PATH = path.join(PROXY_DIR, 'superadmin.db');
const TENANTS_DIR = path.join(PROXY_DIR, 'tenant-databases');

async function migrateToMultiTenant() {
    console.log('========================================');
    console.log('PlexusBill Multi-Tenant Migration');
    console.log('========================================\n');

    // Check if panel.db exists
    if (!fs.existsSync(DB_PATH)) {
        console.error('❌ Error: panel.db not found. Make sure you run this from the project root.');
        process.exit(1);
    }

    let superadminDb;
    let legacyDb;

    try {
        // Open existing database
        console.log('📂 Opening legacy database...');
        legacyDb = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });
        console.log('✓ Legacy database opened\n');

        // Open superadmin database
        console.log('📂 Opening superadmin database...');
        superadminDb = await open({
            filename: SUPERADMIN_DB_PATH,
            driver: sqlite3.Database
        });

        // Create tenants table if not exists
        await superadminDb.exec(`
            CREATE TABLE IF NOT EXISTS tenants (
                id TEXT PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                admin_email TEXT UNIQUE NOT NULL,
                admin_password_hash TEXT NOT NULL,
                admin_username TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'active',
                subscription_tier TEXT DEFAULT 'free',
                subscription_status TEXT DEFAULT 'trial',
                trial_ends_at TEXT,
                subscription_ends_at TEXT,
                database_path TEXT NOT NULL,
                max_routers INTEGER DEFAULT 3,
                max_users INTEGER DEFAULT 10,
                max_customers INTEGER DEFAULT 100,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT
            );
        `);

        await superadminDb.exec(`
            CREATE TABLE IF NOT EXISTS tenant_activity_logs (
                id TEXT PRIMARY KEY,
                tenant_id TEXT,
                action TEXT,
                details TEXT,
                ip_address TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (tenant_id) REFERENCES tenants(id)
            );
        `);
        console.log('✓ Superadmin database ready\n');

        // Create default tenant
        const defaultTenantId = 'tenant_default_001';
        const defaultSlug = 'default';
        const adminUsername = 'admin';
        const adminPassword = 'Akoangnagwagi84%'; // Same as default superadmin password
        const adminEmail = 'admin@plexusbill.com';

        console.log('🔍 Checking if default tenant already exists...');
        const existingTenant = await superadminDb.get('SELECT id FROM tenants WHERE slug = ?', defaultSlug);
        
        if (existingTenant) {
            console.log('⚠️  Default tenant already exists. Skipping migration.\n');
            console.log('Access your existing installation at: /tenant/default/login');
            return;
        }

        console.log('🏢 Creating default tenant...');
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        
        const trialEndsAt = new Date();
        trialEndsAt.setFullYear(trialEndsAt.getFullYear() + 10); // 10 years for migrated tenant

        await superadminDb.run(`
            INSERT INTO tenants (id, slug, name, admin_email, admin_username, admin_password_hash, 
                                subscription_tier, trial_ends_at, status, database_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `, defaultTenantId, defaultSlug, 'Default Tenant', adminEmail, adminUsername, 
           passwordHash, 'free', trialEndsAt.toISOString(), '');

        console.log('✓ Default tenant created\n');

        // Create tenant database
        console.log('🗄️  Creating tenant database...');
        const tenantDbPath = path.join(TENANTS_DIR, `tenant_${defaultSlug}.db`);
        
        if (!fs.existsSync(TENANTS_DIR)) {
            fs.mkdirSync(TENANTS_DIR, { recursive: true });
        }

        const tenantDb = await open({
            filename: tenantDbPath,
            driver: sqlite3.Database
        });

        // Enable WAL mode
        await tenantDb.exec('PRAGMA journal_mode = WAL;');

        console.log('📋 Copying schema...');
        
        // Get all tables from legacy database
        const tables = await legacyDb.all(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `);

        console.log(`   Found ${tables.length} tables to migrate\n`);

        // Copy schema and data for each table
        for (const tableObj of tables) {
            const tableName = tableObj.name;
            console.log(`   📦 Migrating table: ${tableName}`);

            try {
                // Get CREATE TABLE statement
                const createStmt = await legacyDb.get(
                    `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`,
                    tableName
                );

                if (createStmt && createStmt.sql) {
                    // Create table in tenant database
                    await tenantDb.exec(createStmt.sql);

                    // Copy data
                    const rows = await legacyDb.all(`SELECT * FROM ${tableName}`);
                    if (rows.length > 0) {
                        console.log(`      Copying ${rows.length} rows...`);
                        
                        for (const row of rows) {
                            const columns = Object.keys(row).join(', ');
                            const placeholders = Object.keys(row).map(() => '?').join(', ');
                            const values = Object.values(row);
                            
                            await tenantDb.run(
                                `INSERT OR IGNORE INTO ${tableName} (${columns}) VALUES (${placeholders})`,
                                ...values
                            );
                        }
                        console.log(`      ✓ ${rows.length} rows copied`);
                    } else {
                        console.log(`      (empty table)`);
                    }
                }
            } catch (err) {
                console.error(`      ⚠️  Error migrating ${tableName}:`, err.message);
            }
        }

        console.log('\n✅ Schema and data migration complete\n');

        // Update tenant record with database path
        await superadminDb.run('UPDATE tenants SET database_path = ? WHERE id = ?', tenantDbPath, defaultTenantId);

        // Log migration
        await superadminDb.run(`
            INSERT INTO tenant_activity_logs (id, tenant_id, action, details)
            VALUES (?, ?, 'migration_completed', ?)
        `, `log_migration_${Date.now()}`, defaultTenantId, JSON.stringify({
            migratedAt: new Date().toISOString(),
            tablesMigrated: tables.length
        }));

        // Close databases
        await tenantDb.close();
        await legacyDb.close();
        await superadminDb.close();

        console.log('========================================');
        console.log('✅ Migration Complete!');
        console.log('========================================\n');
        console.log('Your data has been migrated to multi-tenant mode.');
        console.log('\nAccess your installation:');
        console.log('  Login URL: /tenant/default/login');
        console.log('  Username: admin');
        console.log('  Password: Akoangnagwagi84%\n');
        console.log('The original panel.db file has been preserved as a backup.\n');

    } catch (err) {
        console.error('\n❌ Migration failed:', err);
        
        // Clean up on error
        if (superadminDb) await superadminDb.close().catch(() => {});
        if (legacyDb) await legacyDb.close().catch(() => {});
        
        process.exit(1);
    }
}

// Run migration
migrateToMultiTenant().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
