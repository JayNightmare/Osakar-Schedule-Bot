require('dotenv').config();

const { User, StreamAnnouncement } = require('../../models/models');
const axios = require('axios');
const express = require('express');
const app = express();

const { OAuth2Client } = require('google-auth-library');
const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.REDIRECT_URI
);

const port = 3000;

app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    const state = JSON.parse(req.query.state);
    const { userId, username, guildId } = state;

    if (!code) {
        return res.status(400).send('Missing auth code');
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Save tokens to the database or your storage (DB, session)
        await saveUserTokens({ userId, username, guildId, tokens });

        console.log(`Saving tokens for userId: ${userId}, username: ${username}, guildId: ${guildId}`);
        
        // Redirect to the external URL with a success message
        res.redirect('https://nexusgit.info/pages/info/OAuth/oauth2callback?status=success');
    } catch (error) {
        console.error(error);
        console.log(`Saving tokens for userId: ${userId}, username: ${username}, guildId: ${guildId}`);
        
        // Redirect to the external URL with a failure message
        res.redirect('https://nexusgit.info/pages/info/OAuth/oauth2callback?status=failure');
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});

async function saveUserTokens({ userId, username, guildId, tokens }) {
    checkAccessTokenPermissions(tokens.access_token)

    const [user, created] = await User.findOrCreate({
        where: { userId },
        defaults: { 
            username: username, 
            guildId: guildId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiry: Date.now() + 7200 * 1000
        }
    });

    if (!created) {
        await user.update({
            userId: userId,
            username: username, 
            guildId: guildId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            tokenExpiry: Date.now() + 7200 * 1000
        });
    }

    console.log(`Token saved successfully for user ${userId}`);
}

function isTokenExpired(expiryDate) {
    return Date.now() > expiryDate;
}

async function checkAccessTokenPermissions(accessToken) {
    console.log(accessToken);

    try {
        const response = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);

        if (response.data.scope.includes('https://www.googleapis.com/auth/youtube.force-ssl')) {
            console.log('Access token has correct permissions.');
            console.log(accessToken);
            return true;
        } else {
            console.error('Access token does not have required permissions.');
            console.log(accessToken);
            return false;
        }
    } catch (error) {
        console.error('Error checking access token permissions:', error.response ? error.response.data : error.message);
        return false;
    }
}


// Get user token from database
async function getUserTokens(userId) {
    const user = await User.findOne({ where: { userId } });

    if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
    }

    let { accessToken, refreshToken, expiry_date } = user;

    if (isTokenExpired(expiry_date)) {
        const newAccessToken = await refreshAccessToken(refreshToken);
        const newExpiryDate = Date.now() + 7200 * 1000; // 2 hour from now

        // Save the new token details
        await saveUserTokens({
            userId,
            tokens: {
                access_token: newAccessToken,
                refresh_token: refreshToken, // Keep the old refresh token
                expiry_date: newExpiryDate
            }
        });

        // Return updated token data
        return {
            accessToken: newAccessToken,
            refreshToken,
            tokenExpiry: newExpiryDate
        };
    }

    // Return current token data if still valid
    return {
        accessToken,
        refreshToken,
        tokenExpiry: Date.now() + 7200 * 1000
    };
}


function generateAuthURl(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const guildId = interaction.guild.id;

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
        state: JSON.stringify({
            userId,
            username,
            guildId
        })
    });

    console.log(authUrl);    

    console.log(`Saving tokens for userId: ${userId}, username: ${username}, guildId: ${guildId}`);

    interaction.reply(`To authorize, vist [YouTube oAuth2](${authUrl})`);
}

// //

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
                timestamp: new Date(),
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
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    if (match) {
        // Remove URL parameters if they exist
        const videoId = match[1].split('?')[0];
        return videoId;
    }
    return null;
}


function extractPlaylistId(url) {
    const regex = /[?&]list=([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function addVideoToPlaylist(vUrl, pUrl, accessToken, interaction) {
    try {
        const token = accessToken.accessToken || accessToken;

        const videoId = await extractVideoId(vUrl);
        const playlistId = await extractPlaylistId(pUrl);

        // Check value in console log
        console.log(`Adding video ${videoId} to playlist ${playlistId}`);
        console.log(`Access Token:`);
        console.log(token);

        if (!videoId) {
            await interaction.reply(`Invalid YouTube URL provided: ${vUrl}`);
            return interaction.reply('Invalid YouTube URL provided');
        }

        const response = await axios.post('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
            snippet: {
                playlistId: playlistId,
                resourceId: {
                    kind: 'youtube#video',
                    videoId: videoId
                }
            }
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        await interaction.reply(`Video Added: ${vUrl} from ${pUrl}`);
        console.log('Video added:', response.data);
    } catch (error) {
        console.error('Error adding video:', error.response.data);
        throw error;
    }
}

async function removeVideoFromPlaylist(vUrl, pUrl, accessToken, interaction) {
    try {
        const token = accessToken.accessToken || accessToken;

        const videoId = await extractVideoId(vUrl);
        const playlistId = await extractPlaylistId(pUrl);

        console.log(`Removing video ${videoId} from playlist ${pUrl}`);
        console.log(`Access Token:`, token);

        if (!videoId) {
            return console.log('Invalid YouTube URL provided.');
        }

        // Get the playlist items and retrieve the `playlistItemId`
        const getPlaylistItemsResponse = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
            params: {
                part: 'id',
                playlistId: playlistId,
                videoId: videoId
            },
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const playlistItem = getPlaylistItemsResponse.data.items[0];
        if (!playlistItem) {
            await interaction.reply('Video not found in the playlist')
            return console.log('Video not found in the playlist.');
        }

        const playlistItemId = playlistItem.id;

        // Delete the video from the playlist using `playlistItemId`
        const response = await axios.delete(`https://www.googleapis.com/youtube/v3/playlistItems?id=${playlistItemId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        await interaction.reply(`Video removed: ${vUrl} from ${pUrl}`);
        console.log('Video removed:', response.data);
    } catch (error) {
        await interaction.reply(`Error Removing Video`);
        console.error('Error removing video:', error.response?.data || error.message);
        throw error;
    }
}


// //

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

    // YouTube Auth
    generateAuthURl,
    getUserTokens
};