# Discord Whitelist Bot

A **Discord.js** bot that handles **Minecraft whitelist requests** with admin review, RCON integration, and optional uptime pings.

------------------------------------------------------------------------

## Features

-   Whitelist requests from discord
-   Admin review system
-   RCON integration
-   Optional uptime ping system
-   Docker support
-   Fully customizable via `.env`

------------------------------------------------------------------------

## Environment Variables


| Variable                  | Description                                   |
|---------------------------|-----------------------------------------------|
| `DISCORD_TOKEN`           | Discord Bot Token                             |
| `GUILD_ID`                | Discord Server ID                             |
| `PUBLIC_CHANNEL_ID`       | Channel where users submit whitelist requests |
| `ADMIN_REVIEW_CHANNEL_ID` | Channel where admins review requests          |
| `TEAM_ROLE_ID`            | Role that gets pinged for new requests        |
| `RCON_HOST`               | IP address of the Minecraft server            |
| `RCON_PORT`               | RCON port (from server.properties)            |
| `RCON_PASSWORD`           | Password for RCON                             |
| `PING_ENABLED`            | Enable/disable API pings                      |
| `PING_DOMAIN`             | URL to ping (e.g. Uptime Kuma)                |

------------------------------------------------------------------------

## File Overview

### `bot.js`

Handles:
- Slash commands
- Request storage
- Embeds and UI
- Workflow logic

### `minecraft_bridge.js`

Manages communication with the Minecraft server via **RCON**.

### `pingTask.js`

Runs scheduled pings if enabled.

------------------------------------------------------------------------

## Getting Started

### Local Setup

    git clone https://github.com/WinniePatGG/MinecraftWhitelistBot.git
    cd MinecraftWhitelistBot
    npm install
    npm run start:all

Then run `/whitelist` in your configured Discord channel.

------------------------------------------------------------------------

## Docker Deployment

    mkdir MinecraftWhitelistBot
    mkdir MinecraftWhitelistBot/app

Copy: 
- `docker-compose.yml` → root folder\
- `.env` → root folder\
- All app files → `/app`

Start:

    docker compose up -d

------------------------------------------------------------------------

## Common Issues

### "Error: SQLITE_ERROR: no such table: whitelist_requests"

Restart everything:

    npm run start:all

------------------------------------------------------------------------