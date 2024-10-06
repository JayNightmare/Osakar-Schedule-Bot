require('dotenv').config();
const { StreamAnnouncement } = require('../../models/models.js');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const oauth2Client = new OAuth2Client(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.REDIRECT_URI
);


// Save stream details to the database
async function setStreamDetails(guildId, platform, channelName, announcementChannelId, customMessage) {
    // Find the record if it exists
    const streamAnnouncement = await StreamAnnouncement.findOne({
        where: { guildId, platform, channelName }
    });

    // If record exists, check for a custom message
    if (streamAnnouncement) {
        if (!customMessage) {
            console.log(`No custom message provided for ${channelName}.`);
            return; // or return a message saying no custom message was added
        }

        // Update the record with new details
        await streamAnnouncement.update({ announcementChannelId, customMessage });
        return streamAnnouncement;
    }

    // If the record does not exist, create a new one
    const newStreamAnnouncement = await StreamAnnouncement.create({
        guildId,
        platform,
        channelName,
        announcementChannelId,
        customMessage
    });

    console.log(`Info: Set stream details for ${platform} ${channelName} in guild ${guildId}. Announcement channel ID: ${announcementChannelId}, custom message: ${customMessage || 'None provided'}.`);

    return newStreamAnnouncement;
}

async function updateStreamDetails(guildId, platform, channelName, newAnnouncementChannelId) {
    const streamAnnouncement = await StreamAnnouncement.findOne({
        where: { guildId, platform, channelName }
    });

    if (!streamAnnouncement) {
        throw new Error(`Stream details not found for ${platform} ${channelName} in guild ${guildId}.`);
    }

    await streamAnnouncement.update({ announcementChannelId: newAnnouncementChannelId });
    return streamAnnouncement;
}

async function removeStreamDetails(guildId, platform, channelName) {
    const streamAnnouncement = await StreamAnnouncement.findOne({
        where: { guildId, platform, channelName }
    });

    if (!streamAnnouncement) {
        throw new Error(`Stream details not found for ${platform} ${channelName} in guild ${guildId}.`);
    }

    await streamAnnouncement.destroy();
    return true; // Optional: return true or some confirmation of deletion
}


  // Get all stream announcements for all guilds
async function getAllStreamDetails() {
    return await StreamAnnouncement.findAll();
}

// Function to check if a specific channel is live on the given platform
async function checkStreamLiveStatus(client, guildId, platform, channelName) {
    let isLive = false;
    let streamData = null;

    // Resolve YouTube channel ID only once
    const channelId = platform === 'youtube' ? await getYouTubeChannelId(channelName) : channelName;

    if (platform === 'twitch') {
        streamData = await fetchTwitchData(channelName);
        isLive = !!streamData && streamData.startedAt;
    } else if (platform === 'youtube' && channelId) {
        streamData = await fetchYouTubeStream(channelId);
        isLive = !!streamData;
    }

    if (!channelId) return; // Exit if no channel ID found

    // Fetch the stream record to check the last announced time
    const streamAnnouncement = await StreamAnnouncement.findOne({ where: { guildId, platform, channelName } });

    if (!streamAnnouncement?.announcementChannelId) {
        console.error(`No announcement channel set for ${channelName} in guild ${guildId}`);
        return;
    }

    const { announcementChannelId, lastAnnouncedAt } = streamAnnouncement;
    const announcementChannel = client.channels.cache.get(announcementChannelId);
    const description = streamAnnouncement.customMessage
        ? `${streamAnnouncement.customMessage}`
        : `${streamData.title} ${channelName} is now live on ${platform}!`;

    // Announce if the stream is live and hasn't been announced before
    if (isLive && (!lastAnnouncedAt || new Date(lastAnnouncedAt).getTime() < streamData.startedAt.getTime())) {
        if (announcementChannel) {
            const embed = {
                color: platform === 'twitch' ? 0x9146FF : 0xFF0000,
                title: `${streamData.title}`,
                author: { name: streamData.username, url: streamData.url, icon_url: streamData.profileImage },
                thumbnail: { url: platform === 'twitch' ? streamData.profileImage : null },
                url: streamData.url,
                description: description,
                fields: [
                    { name: 'Viewers', value: streamData.viewerCount.toString(), inline: true },
                ],
                image: { url: streamData.thumbnail },
                footer: { text: 'Click the link above to watch the stream!' }
            };
            await announcementChannel.send({ embeds: [embed] });

            // Update the last announced time
            await StreamAnnouncement.update({ lastAnnouncedAt: new Date() }, { where: { guildId, platform, channelName } });
        }
    }

    // Reset the last announced timestamp if the stream goes offline
    if (!isLive && lastAnnouncedAt) {
        await StreamAnnouncement.update({ lastAnnouncedAt: null }, { where: { guildId, platform, channelName } });
    }
}

// //

async function fetchTwitchData(username) {
    try {
        // Make both requests in parallel
        const [streamResponse, userResponse] = await Promise.all([
            axios.get('https://api.twitch.tv/helix/streams', {
                params: { user_login: username },
                headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
                }
            }),
            axios.get('https://api.twitch.tv/helix/users', {
                params: { login: username },
                headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
                }
            })
        ]);

        const stream = streamResponse.data.data[0];
        const user = userResponse.data.data[0];

        // If the stream is live, collect details
        if (stream) {
            return {
                title: stream.title,
                url: `https://www.twitch.tv/${username}`,
                thumbnail: stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
                startedAt: new Date(stream.started_at),
                viewerCount: stream.viewer_count,
                profileImage: user.profile_image_url,
                username: user.display_name
            };
        }

        // Return user data if stream is offline
        return {
            profileImage: user.profile_image_url,
            username: user.display_name
        };
        
    } catch (error) {
        console.error('Error fetching Twitch data:', error.message);
        return null;
    }
}

// //

// Fetch YouTube stream data (You can customize this logic)
async function getYouTubeChannelId(handle) {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                q: handle,
                type: 'channel',
                key: process.env.YOUTUBE_API_KEY
            }
        });

        if (response.data.items.length > 0) {
            return response.data.items[0].snippet.channelId;
        } else {
            console.log('No channel found with this handle');
            return null;
        }
    } catch (error) {
        console.error('Error fetching YouTube channel ID:', error.message);
        return null;
    }
}

// Function to fetch live stream details for a YouTube channel
async function fetchYouTubeStream(channelId) {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                channelId: channelId,
                type: 'video',
                eventType: 'live',
                key: process.env.YOUTUBE_API_KEY
            }
        });

        const liveVideo = response.data.items[0];
        if (liveVideo) {
            return {
                title: liveVideo.snippet.title,
                url: `https://www.youtube.com/watch?v=${liveVideo.id.videoId}`,
                thumbnail: liveVideo.snippet.thumbnails.high.url,
                startedAt: new Date(liveVideo.snippet.publishedAt)
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching YouTube stream:', error.message);
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

// //

function extractVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function addVideoToPlaylist(playlistId, videoId, accessToken) {
    try {
        const url = interaction.options.getString('url');
        const videoId = extractVideoId(url);

        if (!videoId) {
            return interaction.reply('Invalid YouTube URL provided.');
        }

        const response = await axios.post('https://www.googleapis.com/youtube/v3/playlistItems', {
            snippet: {
                playlistId: playlistId,
                resourceId: {
                    kind: 'youtube#video',
                    videoId: videoId
                }
            }
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Video added:', response.data);
    } catch (error) {
        console.error('Error adding video:', error.message);
        throw error;
    }
}

async function removeVideoFromPlaylist(playlistId, videoId, accessToken) {
    try {
        const url = interaction.options.getString('url');
        const videoId = extractVideoId(url);
        
        if (!videoId) {
            return interaction.reply('Invalid YouTube URL provided.');
        }

        // Find the playlistItemId to remove the video from the playlist
        const playlistItemResponse = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
            params: {
                part: 'id',
                playlistId: playlistId,
                videoId: videoId,
                key: process.env.YOUTUBE_API_KEY
            },
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const playlistItemId = playlistItemResponse.data.items[0]?.id;

        if (playlistItemId) {
            // Make delete request
            await axios.delete(`https://www.googleapis.com/youtube/v3/playlistItems`, {
                params: {
                    id: playlistItemId,
                    key: process.env.YOUTUBE_API_KEY
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            console.log('Video removed:', playlistItemId);
        } else {
            throw new Error('Video not found in playlist');
        }
    } catch (error) {
        console.error('Error removing video:', error.message);
        throw error;
    }
}

// //

// YouTube OAuth2 Client
function getAuthUrl() {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube.force-ssl']
    });
}

async function getAccessToken(code) {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens.access_token;
}

async function refreshAccessToken(refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token;
}

async function getYouTubeAccessToken(userId) {
    // Fetch user tokens from your storage (DB, session)
    const userTokens = await getUserTokens(userId);
    
    if (userTokens.accessToken && !isTokenExpired(userTokens.accessToken)) {
        return userTokens.accessToken;
    }
    
    if (userTokens.refreshToken) {
        const newAccessToken = await refreshAccessToken(userTokens.refreshToken);
        // Save new access token in your storage
        await saveUserTokens(userId, { accessToken: newAccessToken });
        return newAccessToken;
    }
    
    // If no tokens available, start OAuth flow
    const authUrl = getAuthUrl();
    // Redirect user to authUrl to authorize
    throw new Error(`Authorize your account by visiting this URL: ${authUrl}`);
}




module.exports = {
    // Checkers
    checkAllStreams,
    checkStreamLiveStatus,

    // Updaters
    updateStreamDetails,
    removeStreamDetails,

    // Fetchers
    fetchTwitchData,
    fetchYouTubeStream,

    // Setter
    setStreamDetails,

    // Getters
    getYouTubeChannelId,
    getAllStreamDetails,

    // Video Playlist
    addVideoToPlaylist,
    removeVideoFromPlaylist,

    // YouTube OAuth2
    getYouTubeAccessToken,
};