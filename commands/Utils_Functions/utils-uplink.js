require('dotenv').config();

const STREAM_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

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
    // YouTube API implementation here
    // Check for live stream status using the YouTube Data API
    return null; // Placeholder
}

// //

async function checkAllStreams() {
    const streams = await getAllStreamDetails();
    for (const stream of streams) {
        const { guildId, platform, channelName } = stream;
        await checkStreamLiveStatus(guildId, platform, channelName);
    }
}

module.exports = {
    checkTwitchStream,
    checkYouTubeStream,
    checkAllStreams,
    STREAM_CHECK_INTERVAL,
};