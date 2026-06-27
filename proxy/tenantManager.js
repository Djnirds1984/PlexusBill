const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const TENANTS_DIR = path.join(__dirname, 'tenant-databases');

// Ensure tenant databases directory exists
if (!fs.existsSync(TENANTS_DIR)) {
    fs.mkdirSync(TENANTS_DIR, { recursive: true });
}

// Cache for open database connections
const dbCache = new Map();

/**
 * Initialize a new tenant database with full schema
 */
async function createTenantDatabase(tenantId, slug, adminUsername, adminPassword) {
    const dbPath = path.join(TENANTS_DIR, `tenant_${slug}.db`);
    
    console.log(`[TenantManager] Creating database for tenant ${slug} at ${dbPath}`);
    
    // Create database file
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    
    // Enable WAL mode for better concurrency
    await db.exec('PRAGMA journal_mode = WAL;');
    
    // Initialize full tenant schema
    await initializeTenantSchema(db);
    
    // Create default admin user for tenant
    await createDefaultTenantAdmin(db, adminUsername, adminPassword);
    
    // Cache the connection
    dbCache.set(tenantId, db);
    
    console.log(`[TenantManager] Database created successfully for tenant ${slug}`);
    
    return dbPath;
}

/**
 * Get or open tenant database connection
 */
async function getTenantDb(tenantId, superadminDb) {
    if (dbCache.has(tenantId)) {
        return dbCache.get(tenantId);
    }
    
    // Lookup tenant slug from superadminDb
    const tenant = await superadminDb.get('SELECT slug, database_path FROM tenants WHERE id = ?', tenantId);
    if (!tenant) throw new Error('Tenant not found');
    
    const dbPath = tenant.database_path || path.join(TENANTS_DIR, `tenant_${tenant.slug}.db`);
    
    if (!fs.existsSync(dbPath)) {
        throw new Error(`Tenant database file not found: ${dbPath}`);
    }
    
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    
    dbCache.set(tenantId, db);
    return db;
}

/**
 * Close tenant database connection
 */
async function closeTenantDb(tenantId) {
    const db = dbCache.get(tenantId);
    if (db) {
        await db.close();
        dbCache.delete(tenantId);
        console.log(`[TenantManager] Closed database connection for tenant ${tenantId}`);
    }
}

/**
 * Initialize full tenant schema (copied from initDb in server.js)
 */
async function initializeTenantSchema(db) {
    console.log('[TenantManager] Initializing tenant schema...');
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            language TEXT DEFAULT 'en',
            currency TEXT DEFAULT 'USD',
            geminiApiKey TEXT,
            licenseKey TEXT,
            companyName TEXT,
            address TEXT,
            contactNumber TEXT,
            email TEXT,
            logoBase64 TEXT,
            telegramSettings TEXT,
            paymongoSettings TEXT,
            xenditSettings TEXT,
            databaseEngine TEXT DEFAULT 'sqlite',
            dbHost TEXT,
            dbPort INTEGER,
            dbUser TEXT,
            dbPassword TEXT,
            dbName TEXT,
            notificationSettings TEXT,
            landingPageConfig TEXT
        );
        INSERT OR IGNORE INTO settings (id) VALUES (1);
        
        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT
        );
        CREATE TABLE IF NOT EXISTS permissions (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT
        );
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id TEXT,
            permission_id TEXT,
            PRIMARY KEY (role_id, permission_id),
            FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
            FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role_id TEXT,
            FOREIGN KEY (role_id) REFERENCES roles(id)
        );
        
        CREATE TABLE IF NOT EXISTS routers (
            id TEXT PRIMARY KEY,
            name TEXT,
            host TEXT,
            user TEXT,
            password TEXT,
            port INTEGER,
            api_type TEXT
        );
        CREATE TABLE IF NOT EXISTS billing_plans (
            id TEXT PRIMARY KEY,
            routerId TEXT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            cycle TEXT NOT NULL,
            pppoeProfile TEXT,
            description TEXT,
            currency TEXT
        );
        CREATE TABLE IF NOT EXISTS sales_records (
            id TEXT PRIMARY KEY,
            routerId TEXT,
            date TEXT NOT NULL,
            clientName TEXT NOT NULL,
            planName TEXT NOT NULL,
            planPrice REAL NOT NULL,
            discountAmount REAL DEFAULT 0,
            finalAmount REAL NOT NULL,
            routerName TEXT,
            currency TEXT,
            clientAddress TEXT,
            clientContact TEXT,
            clientEmail TEXT,
            invoiceId TEXT,
            coveredMonth TEXT,
            processedBy TEXT DEFAULT 'admin',
            payment_method TEXT DEFAULT 'manual'
        );
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            routerId TEXT,
            fullName TEXT,
            address TEXT,
            contactNumber TEXT,
            email TEXT,
            accountNumber TEXT,
            gps TEXT,
            applicationId TEXT
        );
        CREATE TABLE IF NOT EXISTS inventory (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            price REAL,
            serialNumber TEXT,
            dateAdded TEXT
        );
        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            category TEXT,
            description TEXT,
            amount REAL NOT NULL,
            routerId TEXT
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            type TEXT,
            message TEXT,
            is_read INTEGER DEFAULT 0,
            timestamp TEXT,
            link_to TEXT,
            context_json TEXT
        );
        CREATE TABLE IF NOT EXISTS dhcp_billing_plans (
            id TEXT PRIMARY KEY,
            routerId TEXT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            cycle_days INTEGER NOT NULL,
            speedLimit TEXT,
            currency TEXT
        );
        CREATE TABLE IF NOT EXISTS dhcp_clients (
            id TEXT PRIMARY KEY,
            routerId TEXT,
            macAddress TEXT,
            customerInfo TEXT,
            contactNumber TEXT,
            email TEXT,
            speedLimit TEXT,
            lastSeen TEXT,
            UNIQUE(routerId, macAddress)
        );
        CREATE TABLE IF NOT EXISTS client_users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            router_id TEXT,
            pppoe_username TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS applications (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            message TEXT,
            planName TEXT,
            pdfPath TEXT,
            createdAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS paymongo_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            invoice_no TEXT NOT NULL UNIQUE,
            pppoe_username TEXT NOT NULL,
            router_id TEXT,
            plan_name TEXT,
            amount REAL,
            status TEXT DEFAULT 'pending',
            processed_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS xendit_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            invoice_id TEXT NOT NULL,
            invoice_no TEXT NOT NULL UNIQUE,
            pppoe_username TEXT NOT NULL,
            router_id TEXT,
            plan_name TEXT,
            amount REAL,
            base_amount REAL,
            convenience_fee REAL,
            total_amount REAL,
            payment_method TEXT,
            status TEXT DEFAULT 'pending',
            processed_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS wan_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            connection_type TEXT NOT NULL DEFAULT 'dhcp',
            wan_interface TEXT NOT NULL DEFAULT 'eth0',
            static_ip TEXT,
            static_gateway TEXT,
            static_dns TEXT,
            pppoe_username TEXT,
            pppoe_password TEXT,
            pppoe_interface_name TEXT,
            last_applied_at TEXT,
            status TEXT DEFAULT 'pending',
            error_message TEXT
        );
    `);
    
    // Insert default WAN settings
    await db.run("INSERT OR IGNORE INTO wan_settings (id, connection_type, wan_interface) VALUES (1, 'dhcp', 'eth0')");
    
    // Seed default roles and permissions
    await seedDefaultRoles(db);
    
    console.log('[TenantManager] Tenant schema initialized successfully');
}

/**
 * Seed default roles and permissions
 */
async function seedDefaultRoles(db) {
    const rolesCount = await db.get("SELECT COUNT(*) as count FROM roles");
    if (rolesCount.count === 0) {
        await db.run("INSERT INTO roles (id, name, description) VALUES (?, ?, ?)", 'role_admin', 'Administrator', 'Full access to all features');
        await db.run("INSERT INTO roles (id, name, description) VALUES (?, ?, ?)", 'role_employee', 'Employee', 'Can view and process payments but cannot delete or edit users');
        
        await db.run("INSERT INTO permissions (id, name, description) VALUES (?, ?, ?)", 'perm_all', '*:*', 'All Permissions');
        await db.run("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", 'role_admin', 'perm_all');
    }
}

/**
 * Create default admin user for tenant
 */
async function createDefaultTenantAdmin(db, username, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `user_admin_${Date.now()}`;
    
    await db.run(
        'INSERT INTO users (id, username, password, role_id) VALUES (?, ?, ?, ?)',
        userId,
        username,
        passwordHash,
        'role_admin'
    );
    
    console.log(`[TenantManager] Default admin user created: ${username}`);
}

module.exports = {
    createTenantDatabase,
    getTenantDb,
    closeTenantDb,
    initializeTenantSchema,
    seedDefaultRoles
};
