/**
 * Check if client_users exist in panel.db
 */

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('panel.db');

console.log('=== Checking panel.db for client_users ===\n');

// Check if table exists
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='client_users'", (err, row) => {
    if (err) {
        console.error('Error:', err.message);
        db.close();
        return;
    }
    
    if (!row) {
        console.log('✗ client_users table does not exist in panel.db');
        console.log('  The table will be created when the server starts.');
        db.close();
        return;
    }
    
    console.log('✓ client_users table exists\n');
    
    // Get all users
    db.all('SELECT id, username, pppoe_username, router_id, account_number, tenant_slug FROM client_users', (err, rows) => {
        if (err) {
            console.error('Error querying users:', err.message);
            db.close();
            return;
        }
        
        console.log(`Found ${rows.length} user(s) in client_users:\n`);
        rows.forEach((user, i) => {
            console.log(`${i + 1}. Username: ${user.username}`);
            console.log(`   PPPoE: ${user.pppoe_username || 'N/A'}`);
            console.log(`   Router: ${user.router_id || 'N/A'}`);
            console.log(`   Account: ${user.account_number || 'N/A'}`);
            console.log(`   Tenant: ${user.tenant_slug || 'N/A (main db)'}`);
            console.log('');
        });
        
        db.close();
    });
});
