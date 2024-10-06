const { EmbedBuilder, PermissionsBitField } = require('discord.js');


module.exports = {
    announce: {
        async execute(interaction) {
            // Check if the user has permission to manage messages
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return interaction.reply({ content: 'You do not have permission to make announcements.', ephemeral: true });
            }
    
            // Get options
            const title = interaction.options.getString('title') || null;
            const description = interaction.options.getString('description') || null;
            const color = interaction.options.getString('color') || '#ffffff';
            const footer = interaction.options.getString('footer') || null;
            const thumbnail = interaction.user.displayAvatarURL({ dynamic: true, size: 1024 });;
            const image = interaction.options.getString('image') || null;
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const currentDate = new Date();
            const formattedDate = currentDate.toLocaleString();

            // console log all values
            console.log('Announcement options:', {
                title,
                description,
                color,
                footer,
                thumbnail,
                image,
                channelId: channel.id
            });
    
            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color.startsWith('#') ? color.slice(1) : color);
    
            if (footer) { embed.setFooter({ text: `${footer} • ${formattedDate}` }); } else { embed.setFooter({ text: `${formattedDate}` }); }
            if (thumbnail) { embed.setThumbnail(thumbnail); } else { embed.setThumbnail(thumbnailUrl); }
            if (image) embed.setImage(image);
    
            // Send the embed to the specified channel
            try {
                await channel.send({ embeds: [embed] });
                await interaction.reply({ content: `Announcement sent to ${channel}`, ephemeral: true });
            } catch (error) {
                console.error('Error sending announcement:', error);
                await interaction.reply({ content: 'Failed to send the announcement. Please check the provided details.', ephemeral: true });
            }
        }
    }    
};
