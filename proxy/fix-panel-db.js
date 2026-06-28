/**
 * Quick fix: Add tenant_slug column to client_users in panel.db
 * Run: node fix-panel-db.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'panel.db');

console.log('=== Fixing panel.db client_users table ===\n');

const db = new sqlite3.Database(DB_PATH);

// Check current columns
db.all("PRAGMA table_info(client_users)", (err, rows) => {
    if (err) {
        console.error('Error checking columns:', err.message);
        db.close();
        return;
    }
    
    const columns = rows.map(r => r.name);
    console.log('Current columns:', columns.join(', '));
    
    const needsTenantSlug = !columns.includes('tenant_slug');
    const needsAccountNumber = !columns.includes('account_number');
    
    if (!needsTenantSlug && !needsAccountNumber) {
        console.log('\n✓ All columns already exist. No migration needed.');
        db.close();
        return;
    }
    
    let migrationsRun = 0;
    
    // Add tenant_slug if missing
    if (needsTenantSlug) {
        console.log('\nAdding tenant_slug column...');
        db.run('ALTER TABLE client_users ADD COLUMN tenant_slug TEXT', (err) => {
            if (err) {
                console.error('Error adding tenant_slug:', err.message);
            } else {
                console.log('✓ tenant_slug column added');
                migrationsRun++;
            }
            checkComplete();
        });
    }
    
    // Add account_number if missing
    if (needsAccountNumber) {
        console.log('\nAdding account_number column...');
        db.run('ALTER TABLE client_users ADD COLUMN account_number TEXT', (err) => {
            if (err) {
                console.error('Error adding account_number:', err.message);
            } else {
                console.log('✓ account_number column added');
                migrationsRun++;
            }
            checkComplete();
        });
    }
    
    function checkComplete() {
        if (migrationsRun === (needsTenantSlug ? 1 : 0) + (needsAccountNumber ? 1 : 0)) {
            console.log('\n=== Migration completed successfully ===');
            db.close();
        }
    }
});
