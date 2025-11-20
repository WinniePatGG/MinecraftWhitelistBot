const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    Events,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} = require('discord.js');

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { startPingLoop } = require('./pingTask');
require('dotenv').config({ quiet: true, path: path.join(__dirname, '.env') });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const dbPath = path.join(__dirname, 'whitelist.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS whitelist_requests (
                                                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                          discord_id TEXT NOT NULL,
                                                          discord_username TEXT NOT NULL,
                                                          minecraft_username TEXT NOT NULL,
                                                          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
            minecraft_added BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(discord_id, minecraft_username)
            )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Database initialization was successful');
        }
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

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'whitelist') {
            await handleWhitelistCommand(interaction);
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'request_whitelist') {
            await showWhitelistModal(interaction);
        } else if (interaction.customId.startsWith('approve_')) {
            await handleApproveButton(interaction);
        } else if (interaction.customId.startsWith('deny_')) {
            await handleDenyButton(interaction);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'whitelist_modal') {
            await handleWhitelistSubmission(interaction);
        }
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'whitelist_approve') {
        await handleApproveCommand(interaction);
    }

    if (interaction.commandName === 'whitelist_deny') {
        await handleDenyCommand(interaction);
    }

    if (interaction.commandName === 'whitelist_list') {
        await handleListCommand(interaction);
    }

    if (interaction.commandName === 'whitelist_remove') {
        await handleRemoveCommand(interaction);
    }

    if (interaction.commandName === 'whitelist_stats') {
        await handleStatsCommand(interaction);
    }
});

async function handleWhitelistCommand(interaction) {
    if (interaction.channelId !== process.env.PUBLIC_CHANNEL_ID) {
        return await interaction.reply({
            content: '❌ Please use this command in the designated whitelist channel.',
            flags: 64
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🎮 Survival Server Whitelist')
        .setDescription('Click the button below to request whitelist access to our Minecraft server!')
        .setColor(0x00FF00)
        .addFields(
            { name: 'How it works',
                    value:  '1. Click the "Request Whitelist" button\n' +
                            '2. Enter your Minecraft username\n' +
                            '3. Wait for admin approval' },
            { name: 'Rules',
                value:  '• Use your exact Minecraft username\n' +
                        '• One request per user\n' +
                        '• No offensive names allowed' }
        )
        .setFooter({ text: 'Minecraft Server Whitelist System' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('request_whitelist')
                .setLabel('Request Whitelist')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎮')
        );

    await interaction.reply({ embeds: [embed], components: [row] });
}

async function showWhitelistModal(interaction) {
    if (interaction.channelId !== process.env.PUBLIC_CHANNEL_ID) {
        return await interaction.reply({
            content: '❌ Please use this command in the designated whitelist channel.',
            flags: 64
        });
    }

    const modal = new ModalBuilder()
        .setCustomId('whitelist_modal')
        .setTitle('Minecraft Whitelist Request');

    const minecraftInput = new TextInputBuilder()
        .setCustomId('minecraft_username')
        .setLabel('What is your Minecraft username?')
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(16)
        .setPlaceholder('Enter your exact Minecraft username')
        .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(minecraftInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
}

async function handleWhitelistSubmission(interaction) {
    const minecraftUsername = interaction.fields.getTextInputValue('minecraft_username');
    const discordUser = interaction.user;

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(minecraftUsername)) {
        return await interaction.reply({
            content: '❌ Invalid Minecraft username! Usernames must be 3-16 characters long and contain only letters, numbers, and underscores.',
            flags: 64
        });
    }

    try {
        const existing = await dbGet(
            'SELECT * FROM whitelist_requests WHERE discord_id = ? AND (status = "pending" OR status = "approved")',
            [discordUser.id]
        );

        if (existing) {
            return await interaction.reply({
                content: '❌ You already have a pending or approved whitelist request!',
                flags: 64
            });
        }

        const existingMinecraft = await dbGet(
            'SELECT * FROM whitelist_requests WHERE minecraft_username = ? AND status = "approved"',
            [minecraftUsername]
        );

        if (existingMinecraft) {
            return await interaction.reply({
                content: '❌ This Minecraft username is already whitelisted!',
                flags: 64
            });
        }

        await dbRun(
            'INSERT INTO whitelist_requests (discord_id, discord_username, minecraft_username, status) VALUES (?, ?, ?, "pending")',
            [discordUser.id, discordUser.tag, minecraftUsername]
        );

        const adminChannel = await client.channels.fetch(process.env.ADMIN_REVIEW_CHANNEL_ID);
        if (adminChannel) {
            const adminEmbed = new EmbedBuilder()
                .setTitle('🆕 New Whitelist Request')
                .setColor(0xFFFF00)
                .addFields(
                    { name: 'Discord User', value: `${discordUser.tag} (\`${discordUser.id}\`)`, inline: true },
                    { name: 'Minecraft Username', value: `\`${minecraftUsername}\``, inline: true },
                    { name: 'Status', value: '⏳ Pending', inline: true }
                )
                .setThumbnail(discordUser.displayAvatarURL())
                .setTimestamp();

            const adminRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_${discordUser.id}_${minecraftUsername}`)
                        .setLabel('Approve')
                        .setStyle(3)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`deny_${discordUser.id}_${minecraftUsername}`)
                        .setLabel('Deny')
                        .setStyle(4)
                        .setEmoji('❌')
                );

            await adminChannel.send({content: `<@&${process.env.TEAM_ROLE_ID}>`, embeds: [adminEmbed], components: [adminRow] });
        }

        await interaction.reply({
            content: `✅ Whitelist request submitted for **${minecraftUsername}**! An admin will review your request shortly.`,
            flags: 64
        });

    } catch (error) {
        console.error('Error submitting whitelist request:', error);
        await interaction.reply({
            content: '❌ An error occurred while submitting your request. Please try again later.',
            flags: 64
        });
    }
}

async function handleApproveButton(interaction) {
    if (interaction.channelId !== process.env.ADMIN_REVIEW_CHANNEL_ID) {
        return await interaction.reply({
            content: '❌ This button can only be used in the admin review channel.',
            flags: 64
        });
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({
            content: '❌ You need administrator permissions to use this button.',
            flags: 64
        });
    }

    const [_, discordId, minecraftUsername] = interaction.customId.split('_');

    try {
        await dbRun(
            'UPDATE whitelist_requests SET status = "approved" WHERE discord_id = ? AND minecraft_username = ?',
            [discordId, minecraftUsername]
        );

        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(0x00FF00)
            .spliceFields(2, 1, { name: 'Status',
                value: '✅ Approved',
                inline: true })
            .setFooter({ text: `Approved by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL() });

        await interaction.message.edit({
            embeds: [updatedEmbed],
            components: []
        });

        await interaction.reply({
            content: `✅ Approved whitelist request for **${minecraftUsername}**`,
            flags: 64
        });

        try {
            const user = await client.users.fetch(discordId);
            const notifyEmbed = new EmbedBuilder()
                .setTitle('🎉 Whitelist Request Approved!')
                .setDescription(`Your whitelist request for **${minecraftUsername}** has been approved! by ${interaction.user.tag}`)
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Minecraft Username',
                        value: minecraftUsername },
                    { name: 'Status',
                        value: '✅ Approved' },
                    { name: 'Next Steps',
                        value: 'You can now join the Minecraft server!' }
                )
                .setTimestamp();

            await user.send({ embeds: [notifyEmbed] });
        } catch (dmError) {
            console.log('Could not send DM to user');
        }

    } catch (error) {
        console.error('Error approving whitelist:', error);
        await interaction.reply({
            content: '❌ An error occurred while approving the whitelist request.',
            flags: 64
        });
    }
}

async function handleDenyButton(interaction) {
    if (interaction.channelId !== process.env.ADMIN_REVIEW_CHANNEL_ID) {
        return await interaction.reply({
            content: '❌ This button can only be used in the admin review channel.',
            flags: 64
        });
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({
            content: '❌ You need administrator permissions to use this button.',
            flags: 64
        });
    }

    const [_, discordId, minecraftUsername] = interaction.customId.split('_');

    try {
        await dbRun(
            'UPDATE whitelist_requests SET status = "rejected" WHERE discord_id = ? AND minecraft_username = ?',
            [discordId, minecraftUsername]
        );

        const originalEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(0xFF0000)
            .spliceFields(2, 1, { name: 'Status',
                value: '❌ Denied',
                inline: true })
            .setFooter({ text: `Denied by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL() });

        await interaction.message.edit({
            embeds: [updatedEmbed],
            components: []
        });

        await interaction.reply({
            content: `❌ Denied whitelist request for **${minecraftUsername}**`,
            flags: 64
        });

        try {
            const user = await client.users.fetch(discordId);
            const notifyEmbed = new EmbedBuilder()
                .setTitle('❌ Whitelist Request Denied')
                .setDescription(`Your whitelist request for **${minecraftUsername}** has been denied by ${interaction.user.tag}.`)
                .setColor(0xFF0000)
                .addFields(
                    { name: 'Minecraft Username', value: minecraftUsername },
                    { name: 'Status', value: '❌ Denied' },
                    { name: 'Next Steps', value: 'Please contact an admin if you believe this is a mistake.' }
                )
                .setTimestamp();

            await user.send({ embeds: [notifyEmbed] });
        } catch (dmError) {
            console.log('Could not send DM to user');
        }

    } catch (error) {
        console.error('Error denying whitelist:', error);
        await interaction.reply({
            content: '❌ An error occurred while denying the whitelist request.',
            flags: 64
        });
    }
}

async function handleApproveCommand(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({
            content: '❌ You need administrator permissions to use this command.',
            flags: 64
        });
    }

    const username = interaction.options.getString('username');

    try {
        const result = await dbRun(
            'UPDATE whitelist_requests SET status = "approved" WHERE minecraft_username = ?',
            [username]
        );

        if (result.changes === 0) {
            return await interaction.reply({
                content: `❌ No pending request found for username **${username}**`,
                flags: 64
            });
        }

        await interaction.reply({
            content: `✅ Successfully approved whitelist request for **${username}**`
        });

    } catch (error) {
        console.error('Error approving whitelist:', error);
        await interaction.reply({
            content: '❌ An error occurred while approving the whitelist request.',
            flags: 64
        });
    }
}

async function handleDenyCommand(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({
            content: '❌ You need administrator permissions to use this command.',
            flags: 64
        });
    }

    const username = interaction.options.getString('username');

    try {
        const result = await dbRun(
            'UPDATE whitelist_requests SET status = "rejected" WHERE minecraft_username = ?',
            [username]
        );

        if (result.changes === 0) {
            return await interaction.reply({
                content: `❌ No pending request found for username **${username}**`,
                flags: 64
            });
        }

        await interaction.reply({
            content: `❌ Successfully denied whitelist request for **${username}**`
        });

    } catch (error) {
        console.error('Error denying whitelist:', error);
        await interaction.reply({
            content: '❌ An error occurred while denying the whitelist request.',
            flags: 64
        });
    }
}

async function handleRemoveCommand(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({
            content: '❌ You need administrator permissions to use this command.',
            flags: 64
        });
    }

    const username = interaction.options.getString('username');

    try {
        const result = await dbRun(
            'DELETE FROM whitelist_requests WHERE minecraft_username = ?',
            [username]
        );

        if (result.changes === 0) {
            return await interaction.reply({
                content: `❌ No whitelist entry found for username **${username}**`,
                flags: 64
            });
        }

        await interaction.reply({
            content: `🗑️ Successfully removed **${username}** from the whitelist database`
        });

    } catch (error) {
        console.error('Error removing from whitelist:', error);
        await interaction.reply({
            content: '❌ An error occurred while removing the whitelist entry.',
            flags: 64
        });
    }
}

async function handleListCommand(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({
            content: '❌ You need administrator permissions to use this command.',
            flags: 64
        });
    }

    try {
        const requests = await dbAll(
            'SELECT * FROM whitelist_requests WHERE status = "pending" ORDER BY created_at DESC'
        );

        if (requests.length === 0) {
            return await interaction.reply({
                content: 'No pending whitelist requests.',
                flags: 64
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Pending Whitelist Requests')
            .setColor(0xFFFF00);

        requests.forEach(request => {
            embed.addFields({
                name: `Request #${request.id} - ${request.minecraft_username}`,
                value: `Discord User: <@${request.discord_id}> (\`${request.discord_username}\`)\nSubmitted: <t:${Math.floor(new Date(request.created_at).getTime() / 1000)}:R>`
            });
        });

        await interaction.reply({ embeds: [embed], flags: 64 });

    } catch (error) {
        console.error('Error listing requests:', error);
        await interaction.reply({
            content: '❌ An error occurred while fetching whitelist requests.',
            flags: 64
        });
    }
}

async function handleStatsCommand(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return await interaction.reply({
            content: '❌ You need administrator permissions to use this command.',
            flags: 64
        });
    }

    try {
        const [pending, approved, rejected, total] = await Promise.all([
            dbGet('SELECT COUNT(*) as count FROM whitelist_requests WHERE status = "pending"'),
            dbGet('SELECT COUNT(*) as count FROM whitelist_requests WHERE status = "approved"'),
            dbGet('SELECT COUNT(*) as count FROM whitelist_requests WHERE status = "rejected"'),
            dbGet('SELECT COUNT(*) as count FROM whitelist_requests')
        ]);

        const embed = new EmbedBuilder()
            .setTitle('📊 Whitelist Statistics')
            .setColor(0x0099FF)
            .addFields(
                { name: '📥 Pending Requests', value: pending.count.toString(), inline: true },
                { name: '✅ Approved',
                    value: approved.count.toString(),
                    inline: true },
                { name: '❌ Rejected',
                    value: rejected.count.toString(),
                    inline: true },
                { name: '📈 Total Requests',
                    value: total.count.toString(),
                    inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error getting stats:', error);
        await interaction.reply({
            content: '❌ An error occurred while fetching statistics.',
            flags: 64
        });
    }
}

const { REST, Routes } = require('discord.js');

const commands = [
    {
        name: 'whitelist',
        description: 'Start the whitelist process for the Minecraft server'
    },
    {
        name: 'whitelist_approve',
        description: 'Approve a whitelist request',
        options: [
            {
                name: 'username',
                type: 3,
                description: 'Minecraft username to approve',
                required: true
            }
        ]
    },
    {
        name: 'whitelist_deny',
        description: 'Deny a whitelist request',
        options: [
            {
                name: 'username',
                type: 3,
                description: 'Minecraft username to deny',
                required: true
            }
        ]
    },
    {
        name: 'whitelist_remove',
        description: 'Remove a username from the whitelist database',
        options: [
            {
                name: 'username',
                type: 3,
                description: 'Minecraft username to remove',
                required: true
            }
        ]
    },
    {
        name: 'whitelist_list',
        description: 'List all pending whitelist requests'
    },
    {
        name: 'whitelist_stats',
        description: 'Show whitelist statistics'
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
        console.log('Refreshing slash-commands');

        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('Refreshed slash-commands');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

client.once(Events.ClientReady, async () => {
    console.log('');
    console.log(`✅ Bot is online as ${client.user.tag}`);
    console.log(`📢 Public channel: ${process.env.PUBLIC_CHANNEL_ID}`);
    console.log(`🔧 Admin channel: ${process.env.ADMIN_REVIEW_CHANNEL_ID}`);
    console.log('');
    await registerCommands();
    if (process.env.PING_ENABLED === 'true') {
        startPingLoop();
        console.log('[PING] enabled.')
    } else {
        console.log('[PING] disabled.')
    }
});

client.login(process.env.DISCORD_TOKEN);