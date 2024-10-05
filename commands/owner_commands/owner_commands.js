// serverinfo.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    serverCall: {
        async execute(interaction) {
            try {
                // Check if user is the bot owner
                if (interaction.user.id !== process.env.OWNER) {
                    return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                }
    
                const client = interaction.client;
                const servers = client.guilds.cache.map(guild => ({
                    name: guild.name,
                    id: guild.id,
                    memberCount: guild.memberCount,
                    ownerId: guild.ownerId || 'Unknown Owner'
                }));
    
                const totalUsers = servers.reduce((acc, guild) => acc + guild.memberCount, 0);
                let currentPage = 0;
                const perPage = 10; // Number of servers per page
                const totalPages = Math.ceil(servers.length / perPage);
    
                // Function to generate the embed for a specific page
                const generateEmbed = (page) => {
                    const serverSlice = servers.slice(page * perPage, (page + 1) * perPage);
                    const fields = serverSlice.map(server => ({
                        name: server.name,
                        value: `**ID**: \`${server.id}\`\n**Members**: ${server.memberCount}\n**Owner**: <@${server.ownerId}>`,
                        inline: true,
                    }));
    
                    return new EmbedBuilder()
                        .setTitle('Servers Overview')
                        .setColor(0x3498db)
                        .setDescription(`Total Servers: **${servers.length}**\nTotal Members: **${totalUsers}**\nPage: **${page + 1}/${totalPages}**`)
                        .addFields(fields)
                        .setFooter({ text: 'Server Information', iconURL: client.user.displayAvatarURL() });
                };
    
                // Function to generate navigation buttons
                const generateButtons = () => {
                    return new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('previous')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === 0), // Disable if on first page
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === totalPages - 1) // Disable if on last page
                    );
                };
    
                // Send the initial message with the first page
                const message = await interaction.reply({
                    embeds: [generateEmbed(currentPage)],
                    components: [generateButtons()],
                    fetchReply: true,
                });
    
                // Collector for button interactions
                const collector = message.createMessageComponentCollector({ time: 60000 });
    
                collector.on('collect', async (btnInteraction) => {
                    // Ensure the collector is only for the command user
                    if (btnInteraction.user.id !== interaction.user.id) return;
    
                    if (btnInteraction.customId === 'previous' && currentPage > 0) {
                        currentPage--;
                    } else if (btnInteraction.customId === 'next' && currentPage < totalPages - 1) {
                        currentPage++;
                    }
    
                    // Update the embed and buttons
                    await btnInteraction.update({
                        embeds: [generateEmbed(currentPage)],
                        components: [generateButtons()],
                    });
                });
    
                // When collector ends, disable buttons
                collector.on('end', () => {
                    message.edit({ components: [] });
                });
            } catch (err) {
                console.error('Error fetching server info:', err);
                return interaction.reply({ content: 'An error occurred while fetching server information.', ephemeral: true });
            }
        }
    }
};