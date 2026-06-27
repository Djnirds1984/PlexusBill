/**
 * Diagnostic Script: Check Tenant Database Status
 * 
 * This script checks if tenant databases exist and if billing plans
 * are being stored in the correct database.
 * 
 * Usage: node check-tenant-databases.js
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const SUPERADMIN_DB_PATH = path.join(__dirname, 'superadmin.db');
const PANEL_DB_PATH = path.join(__dirname, 'panel.db');
const TENANTS_DIR = path.join(__dirname, 'tenant-databases');

async function checkTenantDatabases() {
    console.log('=== Tenant Database Diagnostic ===\n');
    
    // Check if superadmin.db exists
    if (!fs.existsSync(SUPERADMIN_DB_PATH)) {
        console.error('✗ superadmin.db not found!');
        process.exit(1);
    }
    console.log('✓ superadmin.db exists\n');
    
    const superadminDb = await open({
        filename: SUPERADMIN_DB_PATH,
        driver: sqlite3.Database
    });
    
    // Get all tenants
    const tenants = await superadminDb.all('SELECT * FROM tenants ORDER BY created_at DESC');
    console.log(`Found ${tenants.length} tenant(s):\n`);
    
    for (const tenant of tenants) {
        console.log(`--- Tenant: ${tenant.name} (${tenant.slug}) ---`);
        console.log(`  Status: ${tenant.status}`);
        console.log(`  Approval: ${tenant.approval_status}`);
        
        const dbPath = tenant.database_path || path.join(TENANTS_DIR, `tenant_${tenant.slug}.db`);
        const dbExists = fs.existsSync(dbPath);
        
        console.log(`  DB Path: ${dbPath}`);
        console.log(`  DB Exists: ${dbExists ? '✓ YES' : '✗ NO'}\n`);
        
        if (dbExists) {
            try {
                const tenantDb = await open({
                    filename: dbPath,
                    driver: sqlite3.Database
                });
                
                // Check billing plans
                const billingPlans = await tenantDb.all('SELECT COUNT(*) as count FROM billing_plans');
                console.log(`  Billing Plans: ${billingPlans[0].count}`);
                
                // Check routers
                const routers = await tenantDb.all('SELECT COUNT(*) as count FROM routers');
                console.log(`  Routers: ${routers[0].count}`);
                
                // Check users
                const users = await tenantDb.all('SELECT id, username FROM users');
                console.log(`  Users: ${users.map(u => u.username).join(', ')}`);
                
                await tenantDb.close();
            } catch (err) {
                console.log(`  Error reading database: ${err.message}`);
            }
        }
        console.log('\n');
    }
    
    // Check panel.db for comparison
    if (fs.existsSync(PANEL_DB_PATH)) {
        console.log('--- Panel Database (Legacy/Shared) ---');
        const panelDb = await open({
            filename: PANEL_DB_PATH,
            driver: sqlite3.Database
        });
        
        const billingPlans = await panelDb.all('SELECT COUNT(*) as count FROM billing_plans');
        console.log(`  Billing Plans in panel.db: ${billingPlans[0].count}\n`);
        
        await panelDb.close();
    }
    
    await superadminDb.close();
}

checkTenantDatabases()
    .then(() => {
        console.log('Diagnostic complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Diagnostic failed:', error);
        process.exit(1);
    });
