const { Client, PermissionsBitField, SlashCommandBuilder, ChannelType, GatewayIntentBits, REST, Routes, Events } = require('discord.js');
require('dotenv').config();
const rest = new REST({ version: '10' }).setToken(process.env.TEST_TOKEN);

const { Server, User, ReactionRole } = require('./models/models.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        'MESSAGE',
        'CHANNEL',
        'REACTION'
    ]
});

// Load Files
const adminCommands = require('./commands/admin_commands/admin_commands.js');
const communityCommands = require('./commands/community_commands/community_commands.js'); 
const configCommands = require('./commands/config_commands/configs_commands.js');
const { getReactionRoleConfigurations  } = require('./commands/config_commands/configs_commands.js');
const help_menu_selected = require('./events/help_menu_selected.js');
const ownerCommands = require('./commands/owner_commands/owner_commands.js');

const {
    // Reaction Roles
    saveReactionRole,
    loadReactionRoles
} = require('./commands/Utils_Functions/utils-reactions.js');

const {
    // Timer
    STREAM_CHECK_INTERVAL,

    // Checker
    checkAllStreams,

} = require('./commands/Utils_Functions/utils-uplink.js');

const commands = [
    new SlashCommandBuilder()
        .setName('set-link-channel')
        .setDescription('Sets a channel for submitting links.')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel where links will be sent')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)),

    new SlashCommandBuilder()
        .setName('submit-link')
        .setDescription('Submits a link to the designated channel.')
        .addStringOption(option => 
            option.setName('link')
                .setDescription('The link to submit')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('setup-reaction-role')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)

        .setDescription('Sets up a reaction role message')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel where the reaction role message will be sent')
                .setRequired(true)
                ),

    new SlashCommandBuilder()
        .setName('setup-stream')
        .setDescription('Sets up a stream to monitor and an announcement channel.')
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Streaming platform (Twitch or YouTube)')
                .setRequired(true)
                .addChoices(
                    { name: 'Twitch', value: 'twitch' },
                    { name: 'YouTube', value: 'youtube' }
                ))
        .addStringOption(option =>
            option.setName('channel_name')
                .setDescription('The Twitch or YouTube channel name to monitor')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('announcement_channel')
                .setDescription('The Discord channel for stream announcements')
                .setRequired(true)
    )
].map(command => command.toJSON());;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    try {
        console.log('Started refreshing application (/) commands');

        try {
            console.log('Checked All Streams');
            setInterval(() => checkAllStreams(client), 5 * 60 * 1000);
        } catch (error) { console.error('Error checking streams:', error); }

        // Fetch all guilds the bot is in
        const guilds = await client.guilds.fetch();

        for (const guild of guilds.values()) {
            try {
                // Check if the server already exists in the database
                const existingServer = await Server.findOne({ where: { serverId: guild.id } });
                
                // If the server already exists, skip creation
                if (existingServer) {
                    console.log(`Server ${guild.name} already exists in the database.`);
                } else {
                    // Create default entries for the server
                    await Server.create({
                        serverId: guild.id,
                        serverName: guild.name,
                        textChannelId: null,
                        loggingChannelId: null,
                        welcomeChannelId: null,
                        rankUpChannelId: null,
                        logLevel: 'low',
                        mute_role_level_1_id: null,
                        mute_role_level_2_id: null
                    });
                }
            } catch (error) {
                console.error(`Error adding guild to database: ${guild.name} (${guild.id})`, error);
            }
        }

        // Load reaction roles before registering slash commands
        await loadReactionRoles();
        const reactionRoleConfigurations = getReactionRoleConfigurations();
        console.log('Reaction role configurations loaded:', reactionRoleConfigurations);

        // List all reaction roles to the console
        for (const [guildId, configs] of reactionRoleConfigurations.entries()) {
            for (const config of configs) {
                try {
                    const guild = await client.guilds.fetch(guildId);
                    
                    console.log(`Fetching channel ID: ${config.channelId} for guild ${guild.name}`);
                    const channel = await guild.channels.fetch(config.channelId); // Explicitly fetch the channel
    
                    if (!channel) {
                        console.log(`Channel not found: ${config.channelId} in guild ${guild.name}`);
                        continue;
                    }
    
                    const message = await channel.messages.fetch(config.messageId);
    
                    // Iterate through the reactions on the message using a proper async loop
                    for (const reaction of message.reactions.cache.values()) {
                        const users = await reaction.users.fetch();
                        for (const user of users.values()) {
                            if (!user.bot) {
                                console.log(`Reaction found from user ${user.tag} on message ${message.id}`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing guild ${guildId} and config ${config}:`, error);
                }
            }
        }

        // Register slash commands for each guild dynamically
        for (const guild of guilds.values()) {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, guild.id),
                    { body: commands }
                );
                console.log(`Successfully registered commands for guild: ${guild.id}`);
            } catch (error) {
                console.error(`Error registering commands for guild: ${guild.id}`, error);
            }
        }

        console.log('Successfully reloaded application (/) commands');
    } catch (error) {
        console.error('An error occurred during initialization:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand() && interaction.componentType!== 3) return;
    const { commandName, options } = interaction; 

    if (commandName === 'set-link-channel') { console.log(`set link channel ran`); await configCommands.setupLinkChannel.execute(interaction, options); }
    if (commandName ==='submit-link') { console.log(`submit link ran`); await communityCommands.submitLink.execute(interaction, options); }
    // //
    if (commandName === 'setup-stream') { console.log(`setup stream command ran`); await configCommands.setupStream.execute(interaction, options); }
    // //
    if (commandName === 'setup-reaction-role') { console.log(`setup reaction command ran`); await configCommands.setupReactionRole.execute(interaction, options); }
});


client.on(Events.MessageReactionAdd, async (reaction, user) => {
    // // Check if the reaction is in a guild and not from a bot
    if (user.bot) return;

    try {
        // Fetch partial reactions and messages
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();
    } catch (err) {
        console.error('Error fetching partial reaction or message:', err);
        return; // Skip further processing if fetch fails
    }

    const guildId = reaction.message.guild.id;

    try {
        // Fetch all reaction roles for this message
        const existingRoles = await ReactionRole.findAll({
            where: {
                guildId: guildId,
                messageId: reaction.message.id,
            },
        });

        // If no reaction roles exist for this message, return
        if (!existingRoles || existingRoles.length === 0) {
            console.log(`No reaction role configuration found for message ID: ${reaction.message.id} in guild: ${guildId}`);
            return;
        }

        // Get the emoji identifier (custom vs standard)
        const emojiIdentifier = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

        // Find the role associated with the emoji
        const roleEntry = existingRoles.find(entry => entry.emoji === emojiIdentifier);
        if (!roleEntry) {
            console.log(`No role associated with emoji ${emojiIdentifier} for message ID: ${reaction.message.id}`);
            return;
        }

        // Get the role from the guild
        const role = reaction.message.guild.roles.cache.get(roleEntry.roleId);
        if (!role) {
            console.log(`Role not found in guild ${guildId} for role ID: ${roleEntry.roleId}`);
            return;
        }

        // Fetch the member who reacted
        const member = await reaction.message.guild.members.fetch(user.id);

        // Fetch the bot's highest role to compare with the role to be added
        const botMember = await reaction.message.guild.members.fetch(client.user.id);
        const botHighestRole = botMember.roles.highest;

        // Check if the bot has permission to manage roles and if its role is higher than the target role
        if (!reaction.message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            console.log(`Bot lacks 'Manage Roles' permission in guild ${guildId}`);
            return;
        }

        if (botHighestRole.comparePositionTo(role) <= 0) {
            console.log(`Bot's role (${botHighestRole.name}) is not higher than the role to be added (${role.name})`);
            return; // Prevent adding the role to avoid the permission error
        }

        // Add the role to the member
        await member.roles.add(role);
        console.log(`Added role ${role.name} to user ${user.username}`);
    } catch (error) {
        console.error('Error adding role based on reaction:', error);
        return;
    }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
    // Check if the reaction is in a guild and not from a bot
    if (reaction.message.partial) await reaction.message.fetch();
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;
    if (!reaction.message.guild) return;

    const guildId = reaction.message.guild.id;

    try {
        // Fetch all reaction roles for this message
        const existingRoles = await ReactionRole.findAll({
            where: {
                guildId: guildId,
                messageId: reaction.message.id,
            },
        });

        // If no reaction roles exist for this message, return
        if (!existingRoles || existingRoles.length === 0) {
            console.log(`No reaction role configuration found for message ID: ${reaction.message.id} in guild: ${guildId}`);
            return;
        }

        // Get the emoji identifier (custom vs standard)
        const emojiIdentifier = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

        // Find the role associated with the emoji
        const roleEntry = existingRoles.find(entry => entry.emoji === emojiIdentifier);
        if (!roleEntry) {
            console.log(`No role associated with emoji ${emojiIdentifier} for message ID: ${reaction.message.id}`);
            return;
        }

        // Get the role from the guild
        const role = reaction.message.guild.roles.cache.get(roleEntry.roleId);
        if (!role) {
            console.log(`Role not found in guild ${guildId} for role ID: ${roleEntry.roleId}`);
            return;
        }

        // Fetch the member who reacted
        const member = await reaction.message.guild.members.fetch(user.id);

        // Fetch the bot's highest role to compare with the role to be added
        const botMember = await reaction.message.guild.members.fetch(client.user.id);
        const botHighestRole = botMember.roles.highest;

        // Check if the bot has permission to manage roles and if its role is higher than the target role
        if (!reaction.message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            console.log(`Bot lacks 'Manage Roles' permission in guild ${guildId}`);
            return;
        }

        if (botHighestRole.comparePositionTo(role) <= 0) {
            console.log(`Bot's role (${botHighestRole.name}) is not higher than the role to be added (${role.name})`);
            return; // Prevent adding the role to avoid the permission error
        }

        // Add the role to the member
        await member.roles.remove(role);
        console.log(`Added role ${role.name} to user ${user.username}`);
    } catch (error) {
        console.error('Error adding role based on reaction:', error);
        return;
    }
});

client.login(process.env.TEST_TOKEN);