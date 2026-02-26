// api/index.js
const express = require('express');
const cors = require('cors');
const yts = require('yt-search');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============= UTILITY FUNCTIONS =============

function getYoutubeId(url) {
	const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|v\/|embed\/|user\/[^\/\n\s]+\/)?(?:watch\?v=|v%3D|embed%2F|video%2F)?|youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/playlist\?list=)([a-zA-Z0-9_-]{11})/;
	const match = url.match(regex);
	return match ? match[1] : null;
}

function formatDate(input) {
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

// ============= YOUTUBE DOWNLOADER (savetube.vip) =============

const audioQualities = [92, 128, 256, 320];
const videoQualities = [144, 360, 480, 720, 1080];

const decodeData = (enc) => {
    try {
        const secret_key = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
        const data = Buffer.from(enc, 'base64');
        const iv = data.slice(0, 16);
        const content = data.slice(16);
        const key = Buffer.from(secret_key, 'hex');

        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        let decrypted = Buffer.concat([decipher.update(content), decipher.final()]);

        return JSON.parse(decrypted.toString());
    } catch (error) {
        throw new Error(error.message);
    }
};

async function savetubeDownload(link, quality, type) {
    try {
        // Get random CDN
        const cdnResponse = await fetch("https://media.savetube.vip/api/random-cdn", {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'
            }
        });
        const cdnData = await cdnResponse.json();
        const cdn = cdnData.cdn;

        // Get video info
        const infoResponse = await fetch('https://' + cdn + '/v2/info', {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'
            },
            body: JSON.stringify({ 'url': link })
        });
        const infoData = await infoResponse.json();
        const info = decodeData(infoData.data);

        // Get download URL
        const downloadResponse = await fetch('https://' + cdn + '/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'
            },
            body: JSON.stringify({
                'downloadType': type,
                'quality': `${quality}`,
                'key': info.key
            })
        });
        const downloadData = await downloadResponse.json();

        return {
            status: true,
            quality: `${quality}${type === "audio" ? "kbps" : "p"}`,
            availableQuality: type === "audio" ? audioQualities : videoQualities,
            url: downloadData.data.downloadUrl,
            filename: `${info.title} (${quality}${type === "audio" ? "kbps).mp3" : "p).mp4"}`,
            title: info.title,
            duration: info.duration
        };
    } catch (error) {
        console.error("Savetube error:", error);
        return {
            status: false,
            message: "Download failed: " + error.message
        };
    }
}

// ============= YOUTUBE METADATA =============

async function youtubeMetadata(link) {
    const id = getYoutubeId(link);
    if (!id) {
        return {
            status: false,
            message: "Invalid YouTube link!"
        };
    }

    try {
        const response = await fetch('https://ytapi.apps.mattw.io/v3/videos', {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://mattw.io/youtube-metadata/'
            }
        });

        const data = await response.json();
        
        if (data.items.length === 0) {
            return {
                status: false,
                message: "Failed to get metadata, please check your link!"
            };
        }

        const snippet = data.items[0].snippet;
        const statistics = data.items[0].statistics;

        return {
            status: true,
            id: id,
            channel_id: snippet.channelId,
            channel_title: snippet.channelTitle,
            title: snippet.title,
            description: snippet.description,
            thumbnails: Object.entries(snippet.thumbnails).map(([quality, data]) => ({
                quality,
                ...data
            })),
            tags: snippet.tags,
            published_date: snippet.publishedAt,
            published_format: formatDate(snippet.publishedAt),
            statistics: {
                like: statistics.likeCount,
                view: statistics.viewCount,
                favorite: statistics.favoriteCount,
                comment: statistics.commentCount
            }
        };
    } catch (error) {
        console.log(error);
        return {
            status: false,
            message: "System error occurred!"
        };
    }
}

async function youtubeSearch(query) {
    try {
        const data = await yts(query);
        return {
            status: true,
            creator: "FebryJW 🚀",
            results: data.all
        };
    } catch (error) {
        return {
            status: false,
            message: error.message
        };
    }
}

// ============= API ROUTES =============

// Home route
app.get('/', (req, res) => {
    res.json({
        name: "@𝐅𝐞𝐛𝐫𝐲𝐉𝐖",
        version: "1.0.0",
        description: "YouTube Downloader API by FebryJW",
        author: "FebryJW",
        endpoints: {
            audio: "/api/youtube/audio?url={youtube_url}&quality=128",
            video: "/api/youtube/video?url={youtube_url}&quality=360",
            info: "/api/youtube/info?url={youtube_url}",
            search: "/api/youtube/search?query={keyword}",
            playmp3: "/api/youtube/playmp3?query={keyword}&quality=128"
        },
        note: "Audio qualities: 92, 128, 256, 320 kbps | Video qualities: 144, 360, 480, 720, 1080p"
    });
});

// YouTube Audio Download
app.get('/api/youtube/audio', async (req, res) => {
    const { url, quality = 128 } = req.query;
    
    if (!url) {
        return res.status(400).json({ 
            status: false, 
            message: "URL parameter is required!" 
        });
    }

    const id = getYoutubeId(url);
    if (!id) {
        return res.status(400).json({ 
            status: false, 
            message: "Invalid YouTube URL!" 
        });
    }

    const format = audioQualities.includes(Number(quality)) ? Number(quality) : 128;
    const videoUrl = "https://youtube.com/watch?v=" + id;
    
    try {
        const metadata = await yts(videoUrl);
        const download = await savetubeDownload(videoUrl, format, "audio");
        
        if (!download.status) {
            return res.status(500).json(download);
        }

        res.json({
            status: true,
            creator: "FebryJW 🚀",
            metadata: metadata.all[0],
            download: download
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: false,
            message: "System error occurred!"
        });
    }
});

// YouTube Video Download
app.get('/api/youtube/video', async (req, res) => {
    const { url, quality = 360 } = req.query;
    
    if (!url) {
        return res.status(400).json({ 
            status: false, 
            message: "URL parameter is required!" 
        });
    }

    const id = getYoutubeId(url);
    if (!id) {
        return res.status(400).json({ 
            status: false, 
            message: "Invalid YouTube URL!" 
        });
    }

    const format = videoQualities.includes(Number(quality)) ? Number(quality) : 360;
    const videoUrl = "https://youtube.com/watch?v=" + id;
    
    try {
        const metadata = await yts(videoUrl);
        const download = await savetubeDownload(videoUrl, format, "video");
        
        if (!download.status) {
            return res.status(500).json(download);
        }

        res.json({
            status: true,
            creator: "FebryJW 🚀",
            metadata: metadata.all[0],
            download: download
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            status: false,
            message: "System error occurred!"
        });
    }
});

// YouTube Metadata
app.get('/api/youtube/info', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ 
            status: false, 
            message: "URL parameter is required!" 
        });
    }

    const result = await youtubeMetadata(url);
    
    if (!result.status) {
        return res.status(400).json(result);
    }

    res.json(result);
});

// YouTube Search
app.get('/api/youtube/search', async (req, res) => {
    const { query } = req.query;
    
    if (!query) {
        return res.status(400).json({ 
            status: false, 
            message: "Query parameter is required!" 
        });
    }

    const result = await youtubeSearch(query);
    
    if (!result.status) {
        return res.status(500).json(result);
    }

    res.json(result);
});

// ============= NEW ENDPOINT: PLAY MP3 =============
// Search first video and convert to audio
app.get('/api/youtube/playmp3', async (req, res) => {
    const { query, quality = 128 } = req.query;
    
    if (!query) {
        return res.status(400).json({ 
            status: false, 
            message: "Query parameter is required!" 
        });
    }

    const format = audioQualities.includes(Number(quality)) ? Number(quality) : 128;
    
    try {
        // Step 1: Search for videos
        const searchResult = await yts(query);
        
        if (!searchResult.all || searchResult.all.length === 0) {
            return res.status(404).json({
                status: false,
                message: "No videos found for your query!"
            });
        }

        // Step 2: Get the first video
        const firstVideo = searchResult.all[0];
        const videoUrl = firstVideo.url;
        const videoId = firstVideo.videoId;

        // Step 3: Download audio using savetube
        const download = await savetubeDownload(videoUrl, format, "audio");
        
        if (!download.status) {
            return res.status(500).json(download);
        }

        // Step 4: Return combined result
        res.json({
            status: true,
            creator: "FebryJW 🚀",
            query: query,
            selected_video: {
                title: firstVideo.title,
                videoId: firstVideo.videoId,
                url: firstVideo.url,
                duration: firstVideo.duration,
                seconds: firstVideo.seconds,
                timestamp: firstVideo.timestamp,
                views: firstVideo.views,
                thumbnail: firstVideo.thumbnail,
                author: {
                    name: firstVideo.author.name,
                    url: firstVideo.author.url
                }
            },
            download: download,
            note: "This is the first video result from your search query"
        });

    } catch (error) {
        console.log("PlayMP3 Error:", error);
        res.status(500).json({
            status: false,
            message: "System error occurred: " + error.message
        });
    }
});

// ============= START SERVER =============

app.listen(PORT, () => {
    console.log(`🚀 FebryJW YouTube Downloader API is running on port ${PORT}`);
    console.log(`📱 Endpoints:`);
    console.log(`   - Audio:     http://localhost:${PORT}/api/youtube/audio?url=YOUTUBE_URL&quality=128`);
    console.log(`   - Video:     http://localhost:${PORT}/api/youtube/video?url=YOUTUBE_URL&quality=360`);
    console.log(`   - Info:      http://localhost:${PORT}/api/youtube/info?url=YOUTUBE_URL`);
    console.log(`   - Search:    http://localhost:${PORT}/api/youtube/search?query=KEYWORD`);
    console.log(`   - Play MP3:  http://localhost:${PORT}/api/youtube/playmp3?query=KEYWORD&quality=128`);
});

// Export for Vercel
module.exports = app;