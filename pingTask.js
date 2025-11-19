require('dotenv').config();
let pingUrl = (process.env.PING_DOMAIN || "").trim();

function startPingLoop() {
    setInterval(async () => {
        try {
            await fetch(pingUrl);
        } catch (err) {
            console.error(`[PING] Error: ${err}`);
        }
    }, 20000);
}

module.exports = { startPingLoop };