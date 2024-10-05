const { LinkChannel } = require('../../models/models.js');
const axios = require('axios');
require('dotenv').config();

// //

async function setLinkChannel(guildId, channelId) {
    await LinkChannel.upsert({ guildId, channelId });
}

async function getLinkChannel(guildId) {
    const linkChannel = await LinkChannel.findOne({ where: { guildId } });
    return linkChannel ? linkChannel.channelId : null;
}

// //

// YouTube Functions
function extractYouTubeVideoId(url) {
    // Regular expression to match YouTube video IDs
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function fetchYouTubeVideoTitle(videoId) {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                part: 'snippet',
                id: videoId,
                key: process.env.YOUTUBE_API_KEY
            }
        });

        if (response.data.items && response.data.items.length > 0) {
            return response.data.items[0].snippet.title;
        }
        return 'Unknown Title';
    } catch (error) {
        console.error('Error fetching YouTube video title:', error);
        return 'Unknown Title';
    }
}

// //

// Twitter Functions
function extractTweetDetails(url) {
    // Regex to extract tweet username and ID from the link
    const regex = /x\.com\/(?:#!\/)?(\w+)\/status\/(\d+)/;
    const match = url.match(regex);
    
    if (match && match.length === 3) {
        return {
            username: match[1], // The Twitter username
            tweetId: match[2]   // The Tweet ID
        };
    }
    return null;
}

// //

// Twitch Functions
function extractTwitchUsername(url) {
    // Regular expression to match Twitch usernames from the link
    const regex = /twitch\.tv\/([a-zA-Z0-9_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// //

// Discord Functions
function extractInviteCode(url) {
    const regex = /discord\.gg\/([a-zA-Z0-9]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function fetchInviteDetails(inviteCode) {
    try {
        const response = await axios.get(`https://discord.com/api/v10/invites/${inviteCode}`, {
            headers: {
                'Authorization': `Bot ${process.env.TEST_TOKEN}`
            }
        });

        const invite = response.data;
        return {
            serverName: invite.guild ? invite.guild.name : 'Unknown Server',
            inviteCode: inviteCode
        };
    } catch (error) {
        console.error('Error fetching invite details:', error);
        return null;
    }
}

module.exports = {
    setLinkChannel,
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
}