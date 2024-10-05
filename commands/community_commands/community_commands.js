const { EmbedBuilder, Emoji, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { User } = require('../../models/models.js'); // Import the Sequelize User model
const axios = require('axios');

const {
    getLinkChannel,
    // YouTube Functions
    extractYouTubeVideoId,
    fetchYouTubeVideoTitle,

    // Twitter Functions
    extractTweetDetails,

    // Twitch Functions
    extractTwitchUsername,

    // Discord Functions
    extractInviteCode,
    fetchInviteDetails,
} = require('../Utils_Functions/utils-link.js');

module.exports = {
    help: {
        execute: async (interaction) => {
            try {
                const options = [
                    {
                        label: 'Admin Commands',
                        description: 'Commands for managing server settings',
                        value: 'admin_commands',
                    },
                    {
                        label: 'Community Commands',
                        description: 'Commands for community interactions',
                        value: 'community_commands',
                    },
                    {
                        label: 'Configuration Commands',
                        description: 'Commands for configuring the bot',
                        value: 'configuration_commands',
                    },
                    {
                        label: 'Help With Commands',
                        description: 'Help with commands for the bot',
                        value: 'command_help',
                    }
                ];
        
                // Check if the user is the owner and add the Owner Commands option
                if (interaction.member.id === process.env.OWNER) {
                    options.push({
                        label: 'Owner Commands',
                        description: 'Commands only available to the bot owner',
                        value: 'owner_commands',
                    });
                }
        
                // Create the select menu and action row
                const row = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('help_menu')
                            .setPlaceholder('Select a category')
                            .addOptions(options),
                    );
        
                // Create the initial embed
                const optionEmbed = new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle("Help")
                    .setDescription("Choose an option below to see commands");
            
                // Reply with the embed and select menu
                await interaction.reply({ embeds: [optionEmbed], components: [row] });
            } catch (error) {
                console.error('An error occurred while creating the help embed:', error);
                interaction.reply({ content: 'An error occurred while generating the help message. Please contact the admin. **Error code: 0hb**', ephemeral: true });
            }
        }
    },

    // //

    submitLink: {
        async execute(interaction) {
            const link = interaction.options.getString('link');
            const channelId = await getLinkChannel(interaction.guildId);
        
            if (!channelId) { return await interaction.reply('No submission channel set. Please ask an admin to use `/set-link`.'); }
        
            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (!targetChannel) { return await interaction.reply('The submission channel is invalid or not accessible.'); }

            // If link contains YouTube, return a YouTube preview
            if (link.includes('youtube.com') || link.includes('youtu.be')) {
                const videoId = extractYouTubeVideoId(link);
                const videoTitle = await fetchYouTubeVideoTitle(videoId);
    
                const YouTubeMarkdown = `[${videoTitle}](${link})`;
                await targetChannel.send(`YouTube • ${YouTubeMarkdown}`);
                return await interaction.reply({ content: 'Your link has been submitted!', ephemeral: true });
            }

            // If link contains Twitch, return a Twitch preview
            if (link.includes('twitch.tv')) {
                const twitchDetails = extractTwitchUsername(link);

                const TwitchMarkdown = `[Twitch Stream • ${twitchDetails}](${link})`;
                await targetChannel.send(`${TwitchMarkdown}`);
                return await interaction.reply({ content: 'Your link has been submitted!', ephemeral: true });
            }

            // If link contains a Discord invite, return a Discord invite preview
            if (link.includes('discord.gg')) {
                const inviteCode = extractInviteCode(link);
                const inviteDetails = await fetchInviteDetails(inviteCode);

                if (inviteDetails) {
                    const discordMarkdown = `[Discord Invite • ${inviteDetails.serverName}](https://discord.gg/${inviteDetails.inviteCode})`;
                    await targetChannel.send(`${discordMarkdown}`);
                    return await interaction.reply({ content: 'Your invite has been submitted!', ephemeral: true });
            }
            }

            // If link is Twitter, reutrn a Twitter preview
            if (link.includes('x.com')) {
                const tweetDetails = extractTweetDetails(link);

                if (tweetDetails) {
                    const twitterMarkdown = `[Tweet • @${tweetDetails.username}](${link})`;
                    await targetChannel.send(`${twitterMarkdown}`);
                    return await interaction.reply({ content: 'Your link has been submitted!', ephemeral: true });
                }
            }

            // If link is not a YouTube, Twitch, or Discord invite, send it as a plain text
            await targetChannel.send(link);
            return await interaction.reply({ content: 'Your link has been submitted!', ephemeral: true });
        }
    }
};
