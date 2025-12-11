// =========================
// IMPORT MODULE
// =========================
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { createDecipheriv } = require("crypto");
const yts = require("yt-search");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// HELPER FUNCTIONS
// ===============================
function get_id(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|v\/|embed\/|user\/[^/\n\s]+\/)?(?:watch\?v=|v%3D|embed%2F|video%2F)?|youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/playlist\?list=)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function make_id(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function format_date(input) {
    const date = new Date(input);
    const options = {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    };
    const formatter = new Intl.DateTimeFormat("id-ID", options);
    const formatted = formatter.format(date);
    return `${formatted.replace(".", ":")} WIB`;
}

const audio = [92, 128, 256, 320];
const video = [144, 360, 480, 720, 1080];

const decode = (enc) => {
    try {
        const secret_key = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
        const data = Buffer.from(enc, 'base64');
        const iv = data.slice(0, 16);
        const content = data.slice(16);
        const key = Buffer.from(secret_key, 'hex');

        const decipher = createDecipheriv('aes-128-cbc', key, iv);
        let decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
        return JSON.parse(decrypted.toString());
    } catch (error) {
        return { error: true, message: "Decode failed: " + error.message };
    }
};

async function savetube(link, quality, value) {
    try {
        const cdnResponse = await axios.get("https://media.savetube.me/api/random-cdn");
        const cdn = cdnResponse.data.cdn;

        const infoget = await axios.post(`https://${cdn}/v2/info`, { 'url': link }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://yt.savetube.me/1kejjj1?id=362796039'
            }
        });

        const info = decode(infoget.data.data);

        const response = await axios.post(`https://${cdn}/download`, {
            'downloadType': value,
            'quality': `${quality}`,
            'key': info.key
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://yt.savetube.me/start-download?from=1kejjj1%3Fid%3D362796039'
            }
        });

        return {
            success: true,
            quality: `${quality}${value === "audio" ? "kbps" : "p"}`,
            availableQuality: value === "audio" ? audio : video,
            url: response.data.data.downloadUrl,
            filename: `${info.title} (${quality}${value === "audio" ? "kbps).mp3" : "p).mp4"}`,
            title: info.title,
            duration: info.duration,
            thumbnail: info.thumbnail,
            downloadType: value
        };
    } catch (error) {
        console.error("Savetube error:", error.message);
        return { success: false, message: "Converting error: " + error.message };
    }
}

// ===============================
// CORE FUNCTIONS
// ===============================

async function ytmp3(link, quality = 128) {
    try {
        const videoId = get_id(link);
        const format = audio.includes(Number(quality)) ? Number(quality) : 128;

        if (!videoId) {
            return { success: false, error: 'Invalid YouTube URL' };
        }

        const url = `https://youtube.com/watch?v=${videoId}`;
        const searchData = await yts({ videoId });
        const downloadResult = await savetube(url, format, "audio");

        if (!downloadResult.success) {
            return { success: false, error: downloadResult.message };
        }

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            metadata: {
                videoId: videoId,
                title: searchData?.title || downloadResult.title,
                duration: searchData?.duration?.seconds || downloadResult.duration,
                thumbnail: searchData?.thumbnail || downloadResult.thumbnail,
                author: searchData?.author?.name,
                views: searchData?.views,
                uploaded: searchData?.uploadedAt,
                url: url
            },
            download: {
                quality: downloadResult.quality,
                availableQuality: downloadResult.availableQuality,
                url: downloadResult.url
            }
        };
    } catch (error) {
        console.error("YTMP3 error:", error);
        return { success: false, error: error.message };
    }
}

async function ytmp4(link, quality = 360) {
    try {
        const videoId = get_id(link);
        const format = video.includes(Number(quality)) ? Number(quality) : 360;

        if (!videoId) {
            return { success: false, error: 'Invalid YouTube URL' };
        }

        const url = `https://youtube.com/watch?v=${videoId}`;
        const searchData = await yts({ videoId });
        const downloadResult = await savetube(url, format, "video");

        if (!downloadResult.success) {
            return { success: false, error: downloadResult.message };
        }

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            metadata: {
                videoId: videoId,
                title: searchData?.title || downloadResult.title,
                duration: searchData?.duration?.seconds || downloadResult.duration,
                thumbnail: searchData?.thumbnail || downloadResult.thumbnail,
                author: searchData?.author?.name,
                views: searchData?.views,
                uploaded: searchData?.uploadedAt,
                url: url
            },
            download: {
                quality: downloadResult.quality,
                availableQuality: downloadResult.availableQuality,
                url: downloadResult.url
            }
        };
    } catch (error) {
        console.error("YTMP4 error:", error);
        return { success: false, error: error.message };
    }
}

// YouTube Search - Return all results
async function youtubeSearch(query) {
    try {
        const searchResults = await yts(query);

        const videos = searchResults.videos.map(video => ({
            videoId: video.videoId,
            title: video.title,
            url: video.url,
            duration: video.duration.timestamp || video.duration.toString(),
            durationSeconds: video.duration.seconds,
            thumbnail: video.thumbnail,
            author: video.author.name,
            authorUrl: video.author.url,
            views: video.views,
            uploaded: video.uploadedAt,
            description: video.description
        }));

        const playlists = searchResults.playlists ? searchResults.playlists.map(playlist => ({
            playlistId: playlist.playlistId,
            title: playlist.title,
            url: playlist.url,
            thumbnail: playlist.thumbnail,
            author: playlist.author.name,
            videoCount: playlist.videoCount
        })) : [];

        const channels = searchResults.channels ? searchResults.channels.map(channel => ({
            channelId: channel.channelId,
            name: channel.name,
            url: channel.url,
            thumbnail: channel.thumbnail,
            description: channel.description,
            videoCount: channel.videoCount,
            subscriberCount: channel.subscriberCount
        })) : [];

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            query: query,
            results: {
                videos: videos,
                playlists: playlists,
                channels: channels
            },
            counts: {
                videos: videos.length,
                playlists: playlists.length,
                channels: channels.length,
                total: videos.length + playlists.length + channels.length
            }
        };
    } catch (error) {
        console.error("YouTube Search error:", error);
        return { success: false, error: error.message };
    }
}

async function ytMetadata(url) {
    try {
        const videoId = get_id(url);

        if (!videoId) {
            return { success: false, error: 'Invalid YouTube URL' };
        }

        const response = await axios.get('https://ytapi.apps.mattw.io/v3/videos', {
            params: {
                'key': 'foo1',
                'quotaUser': make_id(40),
                'part': 'snippet,statistics',
                'id': videoId
            },
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://mattw.io/youtube-metadata/'
            }
        });

        if (response.data.items.length === 0) {
            return { success: false, error: 'Video not found' };
        }

        const snippet = response.data.items[0].snippet;
        const statistics = response.data.items[0].statistics;

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            videoId: videoId,
            title: snippet.title,
            description: snippet.description,
            channelId: snippet.channelId,
            channelTitle: snippet.channelTitle,
            thumbnails: Object.entries(snippet.thumbnails).map(([quality, data]) => ({ quality, ...data })),
            tags: snippet.tags || [],
            publishedAt: snippet.publishedAt,
            publishedFormat: format_date(snippet.publishedAt),
            statistics: {
                viewCount: statistics.viewCount || 0,
                likeCount: statistics.likeCount || 0,
                commentCount: statistics.commentCount || 0
            }
        };
    } catch (error) {
        console.error("Metadata error:", error);
        return { success: false, error: error.message };
    }
}

async function ytChannel(input) {
    try {
        const searchResults = await yts(input);

        if (searchResults.channels && searchResults.channels.length > 0) {
            const channel = searchResults.channels[0];
            return {
                success: true,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                channelId: channel.channelId,
                name: channel.name,
                url: channel.url,
                thumbnail: channel.thumbnail,
                description: channel.description,
                videoCount: channel.videoCount,
                subscriberCount: channel.subscriberCount
            };
        }

        return { success: false, error: 'Channel not found. Try searching with @username format' };
    } catch (error) {
        console.error("Channel error:", error);
        return { success: false, error: error.message };
    }
}

// ===============================
// COMBO FUNCTIONS (Search + Download) - REVISED STRUCTURE
// ===============================

async function ytplaymp3(query, quality = 128) {
    try {
        // Step 1: Search for videos
        const searchResult = await youtubeSearch(query);

        if (!searchResult.success || searchResult.results.videos.length === 0) {
            return {
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: 'No videos found for query: ' + query,
                timestamp: new Date().toISOString()
            };
        }

        // Step 2: Get first video
        const firstVideo = searchResult.results.videos[0];
        
        // Step 3: Get detailed metadata
        const metadataResult = await ytMetadata(firstVideo.url);
        
        // Step 4: Download as MP3
        const downloadResult = await ytmp3(firstVideo.url, quality);

        if (!downloadResult.success) {
            return {
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: downloadResult.error,
                timestamp: new Date().toISOString()
            };
        }

        // Combine all metadata
        const combinedMetadata = {
            ...metadataResult.success ? {
                videoId: metadataResult.videoId,
                title: metadataResult.title,
                description: metadataResult.description,
                channelId: metadataResult.channelId,
                channelTitle: metadataResult.channelTitle,
                thumbnails: metadataResult.thumbnails,
                tags: metadataResult.tags,
                publishedAt: metadataResult.publishedAt,
                publishedFormat: metadataResult.publishedFormat,
                statistics: metadataResult.statistics
            } : {
                videoId: firstVideo.videoId,
                title: firstVideo.title,
                description: firstVideo.description,
                channelTitle: firstVideo.author,
                channelUrl: firstVideo.authorUrl,
                publishedAt: firstVideo.uploaded,
                views: firstVideo.views
            },
            duration: firstVideo.duration,
            durationSeconds: firstVideo.durationSeconds,
            thumbnail: firstVideo.thumbnail,
            url: firstVideo.url,
            searchQuery: query
        };

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            query: query,
            metadata: combinedMetadata,
            download: {
                quality: downloadResult.download.quality,
                availableQuality: downloadResult.download.availableQuality,
                url: downloadResult.download.url
            }
        };
    } catch (error) {
        console.error("Ytplaymp3 error:", error);
        return {
            success: false,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

async function ytplaymp4(query, quality = 360) {
    try {
        // Step 1: Search for videos
        const searchResult = await youtubeSearch(query);

        if (!searchResult.success || searchResult.results.videos.length === 0) {
            return {
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: 'No videos found for query: ' + query,
                timestamp: new Date().toISOString()
            };
        }

        // Step 2: Get first video
        const firstVideo = searchResult.results.videos[0];
        
        // Step 3: Get detailed metadata
        const metadataResult = await ytMetadata(firstVideo.url);
        
        // Step 4: Download as MP4
        const downloadResult = await ytmp4(firstVideo.url, quality);

        if (!downloadResult.success) {
            return {
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: downloadResult.error,
                timestamp: new Date().toISOString()
            };
        }

        // Combine all metadata
        const combinedMetadata = {
            ...metadataResult.success ? {
                videoId: metadataResult.videoId,
                title: metadataResult.title,
                description: metadataResult.description,
                channelId: metadataResult.channelId,
                channelTitle: metadataResult.channelTitle,
                thumbnails: metadataResult.thumbnails,
                tags: metadataResult.tags,
                publishedAt: metadataResult.publishedAt,
                publishedFormat: metadataResult.publishedFormat,
                statistics: metadataResult.statistics
            } : {
                videoId: firstVideo.videoId,
                title: firstVideo.title,
                description: firstVideo.description,
                channelTitle: firstVideo.author,
                channelUrl: firstVideo.authorUrl,
                publishedAt: firstVideo.uploaded,
                views: firstVideo.views
            },
            duration: firstVideo.duration,
            durationSeconds: firstVideo.durationSeconds,
            thumbnail: firstVideo.thumbnail,
            url: firstVideo.url,
            searchQuery: query
        };

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            query: query,
            metadata: combinedMetadata,
            download: {
                quality: downloadResult.download.quality,
                availableQuality: downloadResult.download.availableQuality,
                url: downloadResult.download.url
            }
        };
    } catch (error) {
        console.error("Ytplaymp4 error:", error);
        return {
            success: false,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ===============================
// API ROUTES
// ===============================

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: 'YouTube Downloader & Search API',
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        version: '3.1.0',
        endpoints: {
            download: {
                audio: '/api/v1/download/youtube/audio?url=URL&quality=128',
                video: '/api/v1/download/youtube/video?url=URL&quality=360'
            },
            play: {
                audio: '/api/v1/play/youtube/audio?q=QUERY&quality=128',
                video: '/api/v1/play/youtube/video?q=QUERY&quality=360'
            },
            search: {
                youtube: '/api/v1/search/youtube-search?query=SEARCH_QUERY',
                metadata: '/api/v1/search/metadata?url=VIDEO_URL',
                channel: '/api/v1/search/channel?query=CHANNEL_QUERY'
            },
            status: '/api/v1/status'
        },
        qualityOptions: {
            audio: [92, 128, 256, 320],
            video: [144, 360, 480, 720, 1080]
        }
    });
});

// API Status
app.get('/api/v1/status', (req, res) => {
    res.json({
        status: true,
        message: 'API is running',
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        timestamp: new Date().toISOString(),
        serverTime: format_date(new Date()),
        version: '3.1.0'
    });
});

// ===============================
// DOWNLOAD ENDPOINTS
// ===============================

// Download YouTube Audio by URL
app.get('/api/v1/download/youtube/audio', async (req, res) => {
    try {
        const { url, quality = 128 } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'Parameter url is required',
                example: '/api/v1/download/youtube/audio?url=https://youtube.com/watch?v=dQw4w9WgXcQ&quality=128'
            });
        }

        const result = await ytmp3(url, parseInt(quality));
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Audio endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Download YouTube Video by URL
app.get('/api/v1/download/youtube/video', async (req, res) => {
    try {
        const { url, quality = 360 } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'Parameter url is required',
                example: '/api/v1/download/youtube/video?url=https://youtube.com/watch?v=dQw4w9WgXcQ&quality=720'
            });
        }

        const result = await ytmp4(url, parseInt(quality));
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Video endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Play YouTube Audio (Search + Download)
app.get('/api/v1/play/youtube/audio', async (req, res) => {
    try {
        const { q, quality = 128 } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                message: 'Parameter q is required',
                example: '/api/v1/play/youtube/audio?q=music&quality=128'
            });
        }

        const result = await ytplaymp3(q, parseInt(quality));
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Play audio endpoint error:', error);
        res.status(500).json({
            success: false,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            message: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// Play YouTube Video (Search + Download)
app.get('/api/v1/play/youtube/video', async (req, res) => {
    try {
        const { q, quality = 360 } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                message: 'Parameter q is required',
                example: '/api/v1/play/youtube/video?q=tutorial&quality=720'
            });
        }

        const result = await ytplaymp4(q, parseInt(quality));
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Play video endpoint error:', error);
        res.status(500).json({
            success: false,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            message: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// ===============================
// SEARCH ENDPOINTS
// ===============================

// Search YouTube - ALL results (videos, playlists, channels)
app.get('/api/v1/search/youtube-search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Parameter query is required',
                example: '/api/v1/search/youtube-search?query=music'
            });
        }

        const result = await youtubeSearch(query);
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('YouTube Search endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get video metadata
app.get('/api/v1/search/metadata', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'Parameter url is required',
                example: '/api/v1/search/metadata?url=https://youtube.com/watch?v=dQw4w9WgXcQ'
            });
        }

        const result = await ytMetadata(url);
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Metadata endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get channel info
app.get('/api/v1/search/channel', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Parameter query is required',
                example: '/api/v1/search/channel?query=@MrBeast'
            });
        }

        const result = await ytChannel(query);
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Channel endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ===============================
// UTILITY ENDPOINTS
// ===============================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡'
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        availableEndpoints: [
            '/',
            '/api/v1/download/youtube/audio',
            '/api/v1/download/youtube/video',
            '/api/v1/play/youtube/audio',
            '/api/v1/play/youtube/video',
            '/api/v1/search/youtube-search',
            '/api/v1/search/metadata',
            '/api/v1/search/channel',
            '/api/v1/status',
            '/api/health',
            '/api/test'
        ]
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡'
    });
});

module.exports = (req, res) => {
    app(req, res);
};