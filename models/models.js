const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

// User Model: Storing user information (for leveling and other features)
const User = sequelize.define('User', {
    userId: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
});

// Define the Server model
const Server = sequelize.define('Server', {
    serverId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
    serverName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    streamChannelId: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

const LinkChannel = sequelize.define('LinkChannel', {
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    channelId: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

// Define Twitch API
const StreamAnnouncement = sequelize.define('StreamAnnouncement', {
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
    platform: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    channelName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

const ReactionRole = sequelize.define('ReactionRoles', {
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    messageId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    channelId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    emoji: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    roleId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

// Syncing the models with the database
(async () => {
    try {
        await User.sync(); // Create the User table if it doesn't exist
        await StreamAnnouncement.sync(); // Create the Punishment table if it doesn't exist
        await Server.sync(); // Create the Server table if it doesn't exist
        await ReactionRole.sync(); // Create the ReactionRole table if it doesn't exist
        await LinkChannel.sync();
        console.log('Database models synced successfully.');
    } catch (error) {
        console.error('Unable to sync models with the database:', error);
    }
})();

module.exports = { User, Server, LinkChannel, ReactionRole, StreamAnnouncement };
