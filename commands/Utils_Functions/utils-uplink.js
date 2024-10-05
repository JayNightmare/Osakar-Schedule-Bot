require('dotenv').config();
const { StreamAnnouncement } = require('../../models/models.js');
const axios = require('axios');

// Save stream details to the database
async function setStreamDetails(guildId, platform, channelName, announcementChannelId) {
    await StreamAnnouncement.upsert({ guildId, platform, channelName, announcementChannelId });
}

  // Get all stream announcements for all guilds
async function getAllStreamDetails() {
    return await StreamAnnouncement.findAll();
}

// Function to check if a specific channel is live on the given platform
async function checkStreamLiveStatus(client, guildId, platform, channelName) {
    let isLive = false;
    let streamData = null;

    // Fetch stream data based on platform
    if (platform === 'twitch') {
        streamData = await fetchTwitchStream(channelName);
        isLive = !!streamData;
    } else if (platform === 'youtube') {
        streamData = await fetchYouTubeStream(channelName);
        isLive = !!streamData;
    }

    // Fetch the stream record to check the last announced time
    const streamAnnouncement = await StreamAnnouncement.findOne({
        where: { guildId, platform, channelName }
    });

    if (!streamAnnouncement || !streamAnnouncement.announcementChannelId) {
        console.error(`No announcement channel set for ${channelName} in guild ${guildId}`);
        return;
    }

    const { announcementChannelId, lastAnnouncedAt } = streamAnnouncement;
    const announcementChannel = client.channels.cache.get(announcementChannelId);

    // If stream is live and hasn't been announced yet (or it's a new stream)
    if (isLive && (!lastAnnouncedAt || new Date(lastAnnouncedAt).getTime() < streamData.startedAt.getTime())) {
        console.log(`${channelName} is live on ${platform}!`);

        if (announcementChannel) {
            // Create an embed message for the live stream
            const embed = {
                color: platform === 'twitch' ? 0x9146FF : 0xFF0000, // Twitch purple or YouTube red
                title: `${channelName} is now live on ${platform}!`,
                url: streamData.url,
                description: streamData.title,
                image: { url: streamData.thumbnail },
                footer: { text: 'Click the link above to watch the stream!' }
            };

            // Send the embed message to the announcement channel
            await announcementChannel.send({ embeds: [embed] });

            // Update the last announced time
            await StreamAnnouncement.update(
                { lastAnnouncedAt: new Date() },
                { where: { guildId, platform, channelName } }
            );
        }
    }

    // If stream is offline, reset the last announced timestamp
    if (!isLive && lastAnnouncedAt) {
        await StreamAnnouncement.update(
            { lastAnnouncedAt: null },
            { where: { guildId, platform, channelName } }
        );
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
        const stream = response.data.data[0];
        if (stream) {
            return {
                title: stream.title,
                url: `https://www.twitch.tv/${username}`,
                thumbnail: stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
                startedAt: new Date(stream.started_at)
            };
        }
        return null; // No live stream
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
                thumbnail: liveVideo.snippet.thumbnails.high.url,
                startedAt: new Date(liveVideo.snippet.publishedAt) // Make sure to parse the start time
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

async function checkAllStreams(client) {
    const streams = await getAllStreamDetails();
    for (const stream of streams) {
        const { guildId, platform, channelName } = stream;
        await checkStreamLiveStatus(client, guildId, platform, channelName);
    }
}

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