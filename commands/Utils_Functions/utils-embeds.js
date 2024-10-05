const { EmbedBuilder } = require('discord.js');

function createEmbed(title, description, color) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);
}

module.exports = {
    // Embeds
    createEmbed
};