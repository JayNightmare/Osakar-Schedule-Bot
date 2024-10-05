const { Server } = require('../../models/models.js');

// Get all Server data
async function getServerData(serverId) {
    const serverData = await Server.findOne({ where: { serverId }});
    return serverData;
}

module.exports = {
    // Server Data
    getServerData
};