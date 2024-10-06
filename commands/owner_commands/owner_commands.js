// serverinfo.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Server, StreamAnnouncement, ReactionRole, LinkChannel } = require('../../models/models.js');

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
    },

    leaveServer: {
        async execute(interaction) {
            // Check if the user is the bot owner (ensure only the owner can execute this command)
            const botOwnerId = process.env.OWNER; // Replace with your Discord user ID
            if (interaction.user.id !== botOwnerId) {
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }
    
            const serverId = interaction.options.getString('server_id');
            const guild = interaction.client.guilds.cache.get(serverId);
    
            if (!guild) {
                return interaction.reply({ content: 'The bot is not part of a server with that ID.', ephemeral: true });
            }
    
            try {
                // Delete the server details from the database
                await StreamAnnouncement.destroy({ where: { guildId: serverId } });
                await Server.destroy({ where: { serverId: serverId } });
                await ReactionRole.destroy({ where: { guildId: serverId } });
                await LinkChannel.destroy({ where: { guildId: serverId } });
    
                // Leave the server
                await guild.leave();
                await interaction.reply(`Successfully left the server: ${guild.name} and deleted its records from the database.`);
            } catch (error) {
                console.error(`Error leaving server ${serverId}:`, error);
                await interaction.reply('Failed to leave the server or delete database records. Please check the server ID and try again.');
            }
        }
    }
};