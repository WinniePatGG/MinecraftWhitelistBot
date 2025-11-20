const { Rcon } = require('rcon-client');
const sqlite3 = require('sqlite3');
const path = require('path');
require('dotenv').config({ quiet: true });

console.log('🔗 Starting Minecraft Bridge...');
console.log('RCON Config:', {
    host: process.env.RCON_HOST || 'NOT SET',
    port: process.env.RCON_PORT || '25575',
    hasPassword: !!process.env.RCON_PASSWORD
});

const dbPath = path.join(__dirname, 'whitelist.db');
const db = new sqlite3.Database(dbPath);

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function executeMinecraftCommand(command) {
    const rcon = new Rcon({
        host: process.env.RCON_HOST,
        port: process.env.RCON_PORT,
        password: process.env.RCON_PASSWORD,
    });

    try {
        await rcon.connect();
        const response = await rcon.send(command);
        await rcon.end();
        return response;
    } catch (error) {
        console.error('RCON error:', error);
        throw error;
    }
}

async function processApprovedUsers() {
    try {
        const approvedUsers = await dbAll(
            'SELECT * FROM whitelist_requests WHERE status = "approved" AND minecraft_added = 0'
        );

        for (const user of approvedUsers) {
            try {
                await executeMinecraftCommand(`whitelist add ${user.minecraft_username}`);
                console.log(`✅ Added ${user.minecraft_username} to whitelist`);

                await dbRun(
                    'UPDATE whitelist_requests SET minecraft_added = 1 WHERE id = ?',
                    [user.id]
                );
            } catch (error) {
                console.error(`Failed to add ${user.minecraft_username} to whitelist:`, error);
            }
        }
    } catch (error) {
        console.error('Database error:', error);
    }
}

setInterval(processApprovedUsers, 1000);

processApprovedUsers();

console.log(`✅ Started Minecraft Bridge successfully!`);
console.log(`Waiting for changes in whitelist.db`);