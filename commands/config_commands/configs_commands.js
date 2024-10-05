const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { Server, ReactionRole } = require('../../models/models.js'); // Import the Sequelize User model

const {
    setLinkChannel
} = require('../Utils_Functions/utils-extract-details.js');

const reactionRoleConfigurations = new Map();

function getReactionRoleConfigurations() {
    return reactionRoleConfigurations;
}

module.exports = {
    // //

    setupReactionRole: {
        execute: async (interaction) => {
            // Check for permission to manage roles
            const serverId = interaction.guild.id;
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return interaction.reply({ content: 'You do not have permission to manage roles.', ephemeral: true });
            }
    
            // Get the channel to send the message
            const channel = interaction.options.getChannel('channel');
    
            // Prompt user for configuration details
            await interaction.reply({ content: 'Let’s set up your reaction roles. Please reply with the roles, emojis, and message for the embed.' });
    
            // Use a collector to gather multiple pieces of information interactively
            const filter = m => m.author.id === interaction.user.id;
    
            // Step 1: Get roles and emojis
            await interaction.followUp('Please provide the roles and corresponding emojis in this format: `@Role1 :emoji1:, @Role2 :emoji2:`.');
    
            const rolesAndEmojisMessage = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000 });
            const rolesAndEmojisContent = rolesAndEmojisMessage.first().content;
    
            // Check if user provided a valid response
            if (!rolesAndEmojisContent) {
                return interaction.followUp({ content: 'No roles and emojis provided.' });
            }
    
            // Step 2: Parse roles and emojis
            const rolesAndEmojis = rolesAndEmojisContent.split(',').map(item => {
                const [roleMention, emoji] = item.trim().split(/\s+/);
                const roleId = roleMention.match(/\d+/)[0]; // Extract role ID from mention
                return { roleId, emoji };
            });
    
            // Step 3: Get the embed message content
            await interaction.followUp('Please provide the message you want to display in the embed.');
    
            const embedMessageResponse = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000 });
            const embedMessageContent = embedMessageResponse.first().content;
    
            // Step 4: Create and send the embed
            const reactionRoleEmbed = new EmbedBuilder()
                .setTitle('React to Get a Role!')
                .setDescription(embedMessageContent)
                .setColor(0xFFC0CB);
    
            // Send the embed message to the specified channel
            const message = await channel.send({ embeds: [reactionRoleEmbed] });
    
            // Add reactions to the message
            for (const { emoji } of rolesAndEmojis) {
                await message.react(emoji);
            }
    
            // Store the configuration for future reference
            if (!reactionRoleConfigurations.has(serverId)) {
                // If this is the first configuration for the server, initialize an array
                reactionRoleConfigurations.set(serverId, []);
            }
            // Add the new reaction role configuration to the server's array
            reactionRoleConfigurations.get(serverId).push({
                messageId: message.id,
                rolesAndEmojis
            });

            let messageId = message.id; 
            let channelId = channel.id;

            for (const { roleId, emoji } of rolesAndEmojis) {
                await ReactionRole.create({
                    guildId: serverId, messageId, channelId, emoji, roleId
                });
            }
    
            await interaction.followUp({ content: `Reaction role message has been set up in ${channel}.` });
        }
    },
    
    reactionRoleConfigurations,
    getReactionRoleConfigurations,

    // //

    setupLinkChannel: {
        execute: async (interaction) => {
            const channel = interaction.options.getChannel('channel');
            await setLinkChannel(interaction.guildId, channel.id);

            await interaction.deferReply();
            
            await interaction.editReply(`Link submissions will now be sent to ${channel}.`);
        }
    }, 

    setupStream: {
        execute: async (interaction) => {
            const platform = interaction.options.getString('platform');
            const channelName = interaction.options.getString('channel_name');
            const guildId = interaction.guildId;

            // Store the stream details in your database
            await setStreamDetails(guildId, platform, channelName);

            await interaction.reply(`Stream announcement setup for ${channelName} on ${platform}.`);
        }
    }
}