/**
 * Check tenants in superadmin.db
 */

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('superadmin.db');

console.log('=== Checking superadmin.db for tenants ===\n');

db.all("SELECT id, slug, company_name, database_path, status, approval_status FROM tenants", (err, rows) => {
    if (err) {
        console.error('Error:', err.message);
        db.close();
        return;
    }
    
    console.log(`Found ${rows.length} tenant(s):\n`);
    
    rows.forEach((tenant, i) => {
        console.log(`${i + 1}. Slug: ${tenant.slug}`);
        console.log(`   Company: ${tenant.company_name || 'N/A'}`);
        console.log(`   Database: ${tenant.database_path}`);
        console.log(`   Status: ${tenant.status} / ${tenant.approval_status}`);
        console.log('');
    });
    
    db.close();
});
