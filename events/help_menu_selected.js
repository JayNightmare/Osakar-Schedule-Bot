const { EmbedBuilder } = require("discord.js");
require('dotenv').config();

module.exports = {
    help_menu_selected: {
        execute: async (interaction) => {
            try {
                let embed;
                switch (interaction.values[0]) {
                    case "admin_commands":
                        embed = new EmbedBuilder()
                            .setColor(0x3498db)
                            .setTitle("Admin Commands").setDescription(`
                            • /mod-ban
                            • /mod-unban
                            • /mod-kick
                            • /mod-warn
                            • /mod-remove-warning
                            • /mod-timeout
                            • /mod-mute
                            • /mod-unmute
                            `);
                        break;

                    case "community_commands":
                        embed = new EmbedBuilder()
                            .setColor(0x3498db)
                            .setTitle("Community Commands").setDescription(`
                            • /help - All Command in the bot
                            • /setbio - set your bio for your profile
                            • /profile - Check out your xp and level
                            `);
                        break;

                    case "configuration_commands":
                        embed = new EmbedBuilder()
                            .setColor(0x3498db)
                            .setTitle("Configuration Commands").setDescription(`
                            • /setup-mute-role
                            • /setup-logging-channel
                            • /setup-welcome-channel
                            • /setup-reaction-role
                            • /setup-milestone
                            • /remove-milestone
                            • /setup-levelup-channel
                            `);
                        break;

                    case "owner_commands":
                        // Check if the user is the bot owner
                        if (interaction.user.id !== process.env.OWNER
                        ) {
                            return interaction.reply({
                                content:
                                    "You do not have permission to view this section.",
                                ephemeral: true,
                            });
                        }
                        embed = new EmbedBuilder()
                            .setColor(0xff0000)
                            .setTitle("Owner Commands").setDescription(`
                            • List of owner commands
                            `);
                        break;

                    case "command_help":
                        embed = new EmbedBuilder()
                            .setColor(0xffa500)
                            .setTitle("Help With Commands").setDescription(`
                                All commands use slash commands. If you want a new command or feature, please contact the [bot owner](https://discord.com/invite/W3bZxykvAX).
                            `);
                        break;

                    default:
                        return;
                }

                // Validate and send the embed
                if (
                    embed?.data &&
                    (embed.data.title || embed.data.description)
                ) {
                    await interaction.reply({
                        embeds: [embed],
                        ephemeral: true,
                    }); // Use update to edit the original message
                } else {
                    console.error(
                        "Attempted to send an embed with missing or invalid fields."
                    );
                    await interaction.reply({
                        content:
                            "There was an error generating the command list. Please try again later.",
                        ephemeral: true,
                    });
                }
            } catch (err) {
                return;
            }
        },
    },
};
