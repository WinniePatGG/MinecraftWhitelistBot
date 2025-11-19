# Discord Bot written in discord.js that allows whitelist requests for a minecraft server via Rcon
## In the .env set the following values:
- DISCORD_TOKEN = Your Discord Bot Token
- GUILD_ID = The Discord Server ID
- PUBLIC_CHANNEL_ID = The Channel ID for the public message (for users to enter their username)
- ADMIN_REVIEW_CHANNEL_ID = The Channel ID for the Admin Review channel (Requests will be sent here for review)
- TEAM_ROLE_ID = The Role ID that gets pinged when a new request is sent
- RCON_HOST = Ip Address of the Minecraft Server
- RCON_PORT = Port of the Rcon Service (set in the server.properties file, also enable rcon here)
- RCON_PASSWORD = Password for rcon (also set in the server.properties)
- PING_ENABLED = Do you want to send a api request to some endpoint (like uptime kuma)
- PING_DOMAIN = URL to the api endpoint

### Files
- The `bot.js` is the main file that saves the discord_id, discord_username, minecraft_username, status, minecraft_added and created_at. Embeds and other stuff are also managed here.
- The `minecraft_bridge.js` is the file that manages the requests to the minecraft rcon server.

### Getting Started
- Clone the Repo
- Set the values in the .env file
- Run `npm install`
- Run `npm run start:all`
- In you public channel run `/whitelist` and select the command of your bot
- Done

### To run in Docker Containers
- Create a folder on your server `mkdir MinecraftWhitelistBot`
- Inside that folder create a new folder called `app` (`mkdir app`)
- Copy the `docker-compose.yml` from the Repo into the `MinecraftWhitelistBot` folder
- Create a `.env` file and set the Values as shown above
- Copy the rest of the files (`bot.js`, `minecraft_bridge.js` and `package.json`) into the `app` folder
- Start the Services inside the command with the compose file with the command `docker compose up -d`

### Common issues
- If you start, and you get the error, that the database table is not found. Just restart the `npm run start:all` command. This should fix this error.