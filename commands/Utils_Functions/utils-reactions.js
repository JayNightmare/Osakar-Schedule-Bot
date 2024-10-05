const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { ReactionRole } = require('../../models/models.js'); // Import the Sequelize User model

const { getReactionRoleConfigurations } = require('../config_commands/configs_commands.js')

async function saveReactionRole(guildId, channelId, messageId, emoji, roleId) {
    await ReactionRole.create({
        guildId,
        channelId,
        messageId,
        emoji,
        roleId,
    });
}

async function loadReactionRoles() {
    try {
        // Fetch all reaction roles from the database
        const allReactionRoles = await ReactionRole.findAll();

        const reactionRoleConfigurations = getReactionRoleConfigurations();

        // Iterate through the results and populate the in-memory configuration
        allReactionRoles.forEach(({ guildId, messageId, channelId, emoji, roleId }) => {
            if (!reactionRoleConfigurations.has(guildId)) {
                reactionRoleConfigurations.set(guildId, []);
            }
            // Add to the server-specific array in the configuration
            reactionRoleConfigurations.get(guildId).push({
                messageId,
                channelId,
                emoji,
                roleId
            });
        });

        console.log('Successfully loaded all reaction roles from the database:', reactionRoleConfigurations);
    } catch (error) {
        console.error('Error loading reaction roles from the database:', error);
    }
}

module.exports = {
    // Reaction Roles
    saveReactionRole,
    loadReactionRoles
};