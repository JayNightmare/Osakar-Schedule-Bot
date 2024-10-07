const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { StreamAnnouncement } = require('../../models/models');


module.exports = {
    announce: {
        async execute(interaction) {
            // Check if the user has permission to manage messages
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return interaction.reply({ content: 'You do not have permission to make announcements.', ephemeral: true });
            }

            await interaction.deferReply();
    
            // Get Role for notification
            const roleId = interaction.options.getString('notify_role');
            const role = roleId || null;

            // Get options
            const title = interaction.options.getString('title') || null;
            const color = interaction.options.getString('color') || '#ffffff';
            const footer = interaction.options.getString('footer') || null;
            const thumbnail = interaction.user.displayAvatarURL({ dynamic: true, size: 1024 });;
            const image = interaction.options.getString('image') || null;
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const currentDate = new Date();
            const formattedDate = currentDate.toLocaleString();

            await interaction.editReply('Please enter the announcement details for the description in the chat');

            const filter = m => m.author.id === interaction.user.id;
            const descriptionResponse = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
            const userDescription = descriptionResponse.first().content;

            const description = userDescription === '=close' ? null : userDescription;

            // console log all values
            console.log('Announcement options:', {
                title,
                description,
                color,
                footer,
                thumbnail,
                image,
                channelId: channel.id,
                roleId,
                channelName: channel.name,
                currentDate,
                formattedDate
            });
    
            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(color.startsWith('#') ? color.slice(1) : color);
    
            if (description) { embed.setDescription(description); }
            if (footer) { embed.setFooter({ text: `${footer} • ${formattedDate}` }); } else { embed.setFooter({ text: `${formattedDate}` }); }
            if (thumbnail) { embed.setThumbnail(thumbnail); } else { embed.setThumbnail(thumbnailUrl); }
            if (image) embed.setImage(image);
    
            // Send the embed to the specified channel
            try {
                if (role !== null) {
                    await channel.send({ content: role });
                    await channel.send({ embeds: [embed] });
                } 
                else { await channel.send({ embeds: [embed] }); }
                await interaction.followUp({ content: `Announcement sent to ${channel}`, ephemeral: true });
            } catch (error) {
                console.error('Error sending announcement:', error);
                return await interaction.followUp({ content: 'Failed to send the announcement. Please check the provided details.', ephemeral: true });
            }
        }
    },

    // //

    viewStreams: {
        async execute(interaction) {
            // Check if the user has permission to manage messages
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({ content: 'You do not have permission to view the stream.', ephemeral: true });
            }
            
            const streams = await StreamAnnouncement.findAll({ where: { guildId: interaction.guild.id } });
            
            if (!streams.length) { return interaction.reply({ content: 'No streams found for this server.', ephemeral: true }); }

            const embed = new EmbedBuilder()
                .setTitle('Server Stream Announcements')
                .setDescription('Here are the live streams for this server:')
                .setColor('#0099ff')
                .setTimestamp();

            streams.forEach((stream) => {
                embed.addFields({
                    name: `${stream.platform} - ${stream.channelName}`,
                    value: `Anncounement Channel: <#${stream.announcementChannelId}>\nCustom Message: ${stream.customMessage || 'None'}`,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [embed] });
        }
    }
};
