require('dotenv').config();
const { StreamAnnouncement } = require('../../models/models.js');
const axios = require('axios');

const STREAM_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Save stream details to the database
async function setStreamDetails(guildId, platform, channelName) {
    await StreamAnnouncement.upsert({ guildId, platform, channelName });
}

// Get all stream announcements for all guilds
async function getAllStreamDetails() {
    return await StreamAnnouncement.findAll();
}

async function checkStreamLiveStatus(guildId, platform, channelName) {
    let isLive = false;
    let streamData = null;

    if (platform === 'twitch') {
        // Twitch API request
        streamData = await fetchTwitchStream(channelName);
        isLive = !!streamData;
    } else if (platform === 'youtube') {
        // YouTube API request
        streamData = await fetchYouTubeStream(channelName);
        isLive = !!streamData;
    }

    if (isLive) {
        console.log(`${channelName} is live on ${platform}!`);
        // You can send an announcement to the guild's channel
        // Customize this part to send to the right channel in Discord
    }
}

// //

async function fetchTwitchStream(username) {
    try {
        const response = await axios.get(`https://api.twitch.tv/helix/streams`, {
            params: { user_login: username },
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
            }
        });
        return response.data.data[0] || null; // Return stream data if available
    } catch (error) {
        console.error('Error fetching Twitch stream:', error);
        return null;
    }
}

// Fetch YouTube stream data (You can customize this logic)
async function fetchYouTubeStream(channelName) {
    try {
        // Resolve channel name to channel ID (if necessary)
        const channelId = await getYouTubeChannelId(channelName);

        if (!channelId) {
            console.error(`Unable to find Channel ID for ${channelName}`);
            return null;
        }

        // Search for live broadcasts on the channel
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                channelId: channelId,
                type: 'video',
                eventType: 'live', // This checks for active live streams
                key: process.env.YOUTUBE_API_KEY // Your YouTube API key
            }
        });

        // Check if there's a live video
        const liveVideo = response.data.items[0];
        if (liveVideo) {
            return {
                title: liveVideo.snippet.title,
                url: `https://www.youtube.com/watch?v=${liveVideo.id.videoId}`,
                thumbnail: liveVideo.snippet.thumbnails.high.url
            };
        }

        return null; // Return null if there's no live stream
    } catch (error) {
        console.error('Error fetching YouTube stream:', error);
        return null;
    }
}

// Function to resolve a YouTube channel name to a Channel ID
async function getYouTubeChannelId(channelName) {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
            params: {
                part: 'id',
                forUsername: channelName, // This tries to resolve a custom URL name
                key: process.env.YOUTUBE_API_KEY
            }
        });

        // Return the channel ID if found
        if (response.data.items && response.data.items.length > 0) {
            return response.data.items[0].id;
        }

        return channelName; // If the channelName is already a Channel ID
    } catch (error) {
        console.error('Error resolving YouTube Channel ID:', error);
        return null;
    }
}

// //

async function checkAllStreams() {
    const streams = await getAllStreamDetails();
    for (const stream of streams) {
        const { guildId, platform, channelName } = stream;
        await checkStreamLiveStatus(guildId, platform, channelName);
    }
}

setInterval(checkAllStreams, 5 * 60 * 1000); // Check every 5 minutes

module.exports = {
    // Checker
    checkAllStreams,
    checkStreamLiveStatus,

    // Fetcher
    fetchTwitchStream,
    fetchYouTubeStream,

    // Setter
    setStreamDetails,

    // Getter
    getYouTubeChannelId,
    getAllStreamDetails,
};