const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('panel.db');

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
        console.error('Error:', err.message);
    } else {
        console.log('Tables in panel.db:');
        console.log(rows.map(r => r.name).join(', '));
    }
    db.close();
});
