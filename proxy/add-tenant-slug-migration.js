/**
 * Migration Script: Add tenant_slug column to client_users table
 * 
 * This script ensures all tenant databases have the tenant_slug and account_number columns
 * in the client_users table.
 * 
 * Usage: node add-tenant-slug-migration.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const TENANTS_DIR = path.join(__dirname, 'tenant-databases');
const SUPERADMIN_DB = path.join(__dirname, 'superadmin.db');

async function runMigration() {
    console.log('=== Starting tenant_slug migration ===\n');
    
    // Open superadmin database to get tenant list
    const superadminDb = new sqlite3.Database(SUPERADMIN_DB);
    
    try {
        // Get all active tenants
        const tenants = await new Promise((resolve, reject) => {
            superadminDb.all(
                'SELECT id, slug, database_path FROM tenants WHERE status = ?',
                ['active'],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        console.log(`Found ${tenants.length} active tenant(s)\n`);
        
        for (const tenant of tenants) {
            console.log(`\n--- Processing tenant: ${tenant.slug} ---`);
            
            // Use database_path if available, otherwise construct path
            const dbPath = tenant.database_path || path.join(TENANTS_DIR, `tenant_${tenant.slug}.db`);
            
            if (!fs.existsSync(dbPath)) {
                console.log(`  ⚠ Database file not found: ${dbPath}`);
                continue;
            }
            
            const tenantDb = new sqlite3.Database(dbPath);
            
            try {
                // Check if client_users table exists
                const tableExists = await new Promise((resolve, reject) => {
                    tenantDb.get(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name='client_users'",
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(!!row);
                        }
                    );
                });
                
                if (!tableExists) {
                    console.log(`  ⚠ client_users table does not exist`);
                    continue;
                }
                
                // Get existing columns
                const columns = await new Promise((resolve, reject) => {
                    tenantDb.all(
                        "PRAGMA table_info(client_users)",
                        (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows.map(r => r.name));
                        }
                    );
                });
                
                console.log(`  Current columns: ${columns.join(', ')}`);
                
                // Add tenant_slug column if missing
                if (!columns.includes('tenant_slug')) {
                    console.log(`  Adding tenant_slug column...`);
                    await new Promise((resolve, reject) => {
                        tenantDb.run('ALTER TABLE client_users ADD COLUMN tenant_slug TEXT', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    console.log(`  ✓ tenant_slug column added`);
                } else {
                    console.log(`  ✓ tenant_slug column already exists`);
                }
                
                // Add account_number column if missing
                if (!columns.includes('account_number')) {
                    console.log(`  Adding account_number column...`);
                    await new Promise((resolve, reject) => {
                        tenantDb.run('ALTER TABLE client_users ADD COLUMN account_number TEXT', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    console.log(`  ✓ account_number column added`);
                } else {
                    console.log(`  ✓ account_number column already exists`);
                }
                
                // Backfill tenant_slug for existing records
                const recordsWithoutSlug = await new Promise((resolve, reject) => {
                    tenantDb.all(
                        'SELECT COUNT(*) as count FROM client_users WHERE tenant_slug IS NULL OR tenant_slug = ?',
                        [''],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row[0].count);
                        }
                    );
                });
                
                if (recordsWithoutSlug > 0) {
                    console.log(`  Backfilling tenant_slug for ${recordsWithoutSlug} record(s)...`);
                    await new Promise((resolve, reject) => {
                        tenantDb.run(
                            "UPDATE client_users SET tenant_slug = ? WHERE tenant_slug IS NULL OR tenant_slug = ''",
                            [tenant.slug],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });
                    console.log(`  ✓ Backfilled tenant_slug for ${recordsWithoutSlug} record(s)`);
                } else {
                    console.log(`  ✓ All records have tenant_slug`);
                }
                
            } catch (err) {
                console.error(`  ✗ Error processing tenant ${tenant.slug}:`, err.message);
            } finally {
                tenantDb.close();
            }
        }
        
        console.log('\n=== Migration completed successfully ===');
        
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        superadminDb.close();
    }
}

// Run the migration
runMigration();
