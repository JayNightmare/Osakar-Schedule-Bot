require('dotenv').config();

const STREAM_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function checkTwitchStream(channelName) {
    try {
        const response = await axios.get(
            `https://api.twitch.tv/helix/streams`,
            {
                params: { user_login: channelName },
                headers: {
                    "Client-ID": process.env.TWITCH_CLIENT_ID,
                    Authorization: `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
                },
            }
        );

        const streamData = response.data.data[0]; // Returns an array; check if the first item exists
        return streamData || null;
    } catch (error) {
        console.error("Error checking Twitch stream:", error);
        return null;
    }
}

async function checkYouTubeStream(channelName) {
    try {
        const response = await axios.get(
            `https://www.googleapis.com/youtube/v3/search`,
            {
                params: {
                    part: "snippet",
                    channelId: channelName, // You might need to get the channelId based on the channel name
                    type: "video",
                    eventType: "live",
                    key: process.env.YOUTUBE_API_KEY,
                },
            }
        );

        const videoData = response.data.items[0]; // Check if there's a live video item
        return videoData || null;
    } catch (error) {
        console.error("Error checking YouTube stream:", error);
        return null;
    }
}

async function checkAllStreams() {
    const allStreams = await StreamAnnouncement.findAll();

    for (const stream of allStreams) {
        const { platform, channelName, guildId } = stream;

        let isLive = false;
        let streamData = null;

        if (platform === "twitch") {
            streamData = await checkTwitchStream(channelName);
            isLive = !!streamData;
        } else if (platform === "youtube") {
            streamData = await checkYouTubeStream(channelName);
            isLive = !!streamData;
        }

        // If live, send an announcement
        if (isLive) {
            const guild = client.guilds.cache.get(guildId);
            const channel = guild.channels.cache.find(
                (ch) => ch.name === "stream-announcements"
            );

            if (channel) {
                const embed = {
                    color: 0x1e90ff,
                    title: `${channelName} is now live on ${platform}!`,
                    url:
                        platform === "twitch"
                            ? `https://twitch.tv/${channelName}`
                            : `https://youtube.com/channel/${channelName}`,
                    description:
                        streamData.title || "Check out the live stream!",
                    image: {
                        url: streamData.thumbnail_url
                            .replace("{width}", "1280")
                            .replace("{height}", "720"),
                    },
                    footer: {
                        text: "Click the link above to watch the stream!",
                    },
                };

                await channel.send({ embeds: [embed] });
            }
        }
    }
}

module.exports = {
    checkTwitchStream,
    checkYouTubeStream,
    checkAllStreams,
    STREAM_CHECK_INTERVAL,
};