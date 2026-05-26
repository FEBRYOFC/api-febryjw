const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const yts = require("yt-search");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CREATOR_NAME = "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀";
const RANDOM_CDN_API = "https://media.savetube.vip/api/random-cdn";
const YT_PROXY_API = "https://ytapi.apps.mattw.io/v3";
const YT_PROXY_KEY = "foo1";

const SAVE_TUBE = {
    KEY: "C5D58EF67A7584E4A29F6C35BBC4EB12",
    HEADERS: {
        "content-type": "application/json",
        origin: "https://save-tube.com",
        referer: "https://save-tube.com/",
        "user-agent": "Mozilla/5.0 (Android 10; Mobile; rv:148.0) Gecko/148.0 Firefox/148.0"
    }
};

const SAVETT = {
    BASE_URL: "https://savett.cc",
    HEADERS: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin': 'https://savett.cc',
        'Referer': 'https://savett.cc/en1/download',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
    }
};

const SPOTIFY = {
    BASE_URL: "https://spotmate.online",
    HEADERS: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
    }
};

function jsonResponse(res, statusCode, data) {
    res.setHeader("Content-Type", "application/json");
    res.status(statusCode).send(JSON.stringify(data, null, 2));
}

function extractYoutubeId(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*[?&]v=([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
}

function parseDuration(isoDuration) {
    if (!isoDuration) return null;
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return null;
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(seconds) {
    if (!seconds) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ==================== [ YOUTUBE METADATA ] ====================
async function getYoutubeMetadata(videoId) {
    try {
        const url = `${YT_PROXY_API}/videos?key=${YT_PROXY_KEY}&part=snippet,statistics,contentDetails&id=${videoId}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.items && data.items.length > 0) {
            const item = data.items[0];
            return {
                title: item.snippet.title,
                duration: parseDuration(item.contentDetails.duration),
                channel: item.snippet.channelTitle
            };
        }
        return null;
    } catch (error) {
        return null;
    }
}

// ==================== [ YOUTUBE DOWNLOAD CONVERT ] ====================
async function decryptData(enc) {
    const sr = Buffer.from(enc, "base64");
    const key = Buffer.from(SAVE_TUBE.KEY, "hex");
    const iv = sr.slice(0, 16);
    const data = sr.slice(16);
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString());
}

async function getRandomCDN() {
    const response = await fetch(RANDOM_CDN_API, { headers: SAVE_TUBE.HEADERS });
    const data = await response.json();
    return data?.cdn;
}

async function convertYoutube(url, format = "mp3") {
    const id = extractYoutubeId(url);
    if (!id) throw new Error("ID YouTube tidak ditemukan");
    const cdn = await getRandomCDN();
    const infoRes = await fetch(`https://${cdn}/v2/info`, {
        method: "POST",
        headers: SAVE_TUBE.HEADERS,
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${id}` })
    });
    const infoData = await infoRes.json();
    const raw = infoData?.data;
    const videoInfo = typeof raw === "string" ? await decryptData(raw) : raw;
    const dKey = videoInfo.key || videoInfo.downloadKey || videoInfo.k;
    const isAudio = format === "mp3";
    const dlRes = await fetch(`https://${cdn}/download`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            downloadType: isAudio ? "audio" : "video",
            quality: isAudio ? "128" : String(format === "mp4" ? "720" : format),
            key: dKey
        })
    });
    const dlData = await dlRes.json();
    return { url: dlData?.data?.downloadUrl };
}

// ==================== [ YOUTUBE SEARCH ] ====================
async function searchYoutube(query, limit = 5) {
    try {
        const searchResults = await yts(query);
        if (!searchResults.videos || searchResults.videos.length === 0) {
            return [];
        }
        const limitedVideos = searchResults.videos.slice(0, limit);
        const results = [];
        for (const video of limitedVideos) {
            results.push({
                ytsearch: video.title,
                url: video.url
            });
        }
        return results;
    } catch (error) {
        return [];
    }
}

// ==================== [ TIKTOK SAVETT ] ====================
async function getSavettSession() {
    const res = await axios.get('https://savett.cc/en1/download', {
        headers: SAVETT.HEADERS
    });
    return {
        csrf: res.data.match(/name="csrf_token" value="([^"]+)"/)?.[1],
        cookie: res.headers['set-cookie'].map(v => v.split(';')[0]).join('; ')
    };
}

async function downloadSavett(url, csrf, cookie) {
    const res = await axios.post('https://savett.cc/en1/download',
        `csrf_token=${encodeURIComponent(csrf)}&url=${encodeURIComponent(url)}`,
        { headers: { ...SAVETT.HEADERS, Cookie: cookie } }
    );
    return res.data;
}

async function getTikTok(url) {
    const { csrf, cookie } = await getSavettSession();
    const html = await downloadSavett(url, csrf, cookie);
    const $ = cheerio.load(html);
    const stats = [];
    $('#video-info .my-1 span').each((_, el) => {
        stats.push($(el).text().trim());
    });
    const username = $('#video-info h3').first().text().trim();
    const slides = $('.carousel-item[data-data]');
    if (slides.length) {
        const images = [];
        slides.each((_, el) => {
            try {
                const json = JSON.parse($(el).attr('data-data').replace(/&quot;/g, '"'));
                if (Array.isArray(json.URL)) {
                    json.URL.forEach(url => images.push(url));
                }
            } catch (e) {}
        });
        return {
            username: username,
            type: "photo",
            images: images
        };
    }
    let videoUrl = null;
    $('#formatselect option').each((_, el) => {
        const label = $(el).text().toLowerCase();
        const raw = $(el).attr('value');
        if (!raw) return;
        try {
            const json = JSON.parse(raw.replace(/&quot;/g, '"'));
            if (!json.URL) return;
            if (label.includes('mp4') && !label.includes('watermark')) {
                if (json.URL.length > 0 && !videoUrl) {
                    videoUrl = json.URL[0];
                }
            }
        } catch (e) {}
    });
    let audioUrl = null;
    $('#formatselect option').each((_, el) => {
        const label = $(el).text().toLowerCase();
        const raw = $(el).attr('value');
        if (!raw) return;
        try {
            const json = JSON.parse(raw.replace(/&quot;/g, '"'));
            if (!json.URL) return;
            if (label.includes('mp3')) {
                if (json.URL.length > 0 && !audioUrl) {
                    audioUrl = json.URL[0];
                }
            }
        } catch (e) {}
    });
    return {
        username: username,
        type: "video",
        video_url: videoUrl,
        audio_url: audioUrl,
        views: stats[0] || null,
        likes: stats[1] || null
    };
}

// ==================== [ SPOTIFY DOWNLOAD ] ====================
async function getSpotifySession() {
    const res = await axios.get('https://spotmate.online/en1', {
        headers: SPOTIFY.HEADERS
    });
    const $ = cheerio.load(res.data);
    const token = $('meta[name="csrf-token"]').attr('content');
    const cookies = res.headers['set-cookie'] || [];
    return {
        token,
        cookieStr: cookies.map(c => c.split(';')[0]).join('; ')
    };
}

async function getSpotifyTrackData(url, session) {
    const res = await axios.post('https://spotmate.online/getTrackData',
        { spotify_url: url },
        {
            headers: {
                'content-type': 'application/json',
                'x-csrf-token': session.token,
                'cookie': session.cookieStr,
                'origin': 'https://spotmate.online',
                'referer': 'https://spotmate.online/en1',
                'user-agent': SPOTIFY.HEADERS['user-agent']
            }
        }
    );
    return res.data;
}

async function convertSpotify(url, session) {
    const res = await axios.post('https://spotmate.online/convert',
        { urls: url },
        {
            headers: {
                'content-type': 'application/json',
                'x-csrf-token': session.token,
                'cookie': session.cookieStr,
                'origin': 'https://spotmate.online',
                'referer': 'https://spotmate.online/en1',
                'user-agent': SPOTIFY.HEADERS['user-agent']
            }
        }
    );
    return res.data;
}

async function checkSpotifyTask(taskId, session) {
    const res = await axios.get(`https://spotmate.online/tasks/${taskId}`, {
        headers: {
            'x-csrf-token': session.token,
            'cookie': session.cookieStr,
            'origin': 'https://spotmate.online',
            'referer': 'https://spotmate.online/en1',
            'user-agent': SPOTIFY.HEADERS['user-agent']
        }
    });
    return res.data;
}

async function downloadSpotify(url) {
    const session = await getSpotifySession();
    const trackInfo = await getSpotifyTrackData(url, session);
    if (!trackInfo || trackInfo.status === 'error') {
        throw new Error('Gagal mendapatkan informasi lagu');
    }
    const convertInfo = await convertSpotify(url, session);
    if (convertInfo.error === false && convertInfo.url) {
        return {
            title: trackInfo.name,
            artist: trackInfo.artists?.[0]?.name,
            download_url: convertInfo.url
        };
    }
    const taskid = convertInfo.task_id || convertInfo.taskid;
    if (!taskid) {
        throw new Error(convertInfo.status || convertInfo.message || 'Gagal memulai konversi');
    }
    let taskResult;
    do {
        await new Promise(r => setTimeout(r, 3000));
        taskResult = await checkSpotifyTask(taskid, session);
    } while (taskResult && (taskResult.status === 'pending' || taskResult.status === 'processing'));
    return {
        title: trackInfo.name,
        artist: trackInfo.artists?.[0]?.name,
        download_url: taskResult.url
    };
}

// ==================== [ ENDPOINT UTAMA ] ====================
app.get("/", (req, res) => {
    jsonResponse(res, 200, {
        status: true,
        creator: CREATOR_NAME,
        message: "OKEY?"
    });
});

// ==================== [ YOUTUBE DOWNLOAD ENDPOINT ] ====================
app.get("/api/v1/downloader/youtube", async (req, res) => {
    const start = Date.now();
    try {
        const { url, format = "mp3" } = req.query;
        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString()
            });
        }
        if (format === "mp4") {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Maaf, format video (mp4) belum tersedia saat ini. Silakan gunakan format mp3 untuk download audio.",
                timestamp: new Date().toISOString()
            });
        }
        const videoId = extractYoutubeId(url);
        if (!videoId) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "URL YouTube tidak valid",
                timestamp: new Date().toISOString()
            });
        }
        const [metadata, download] = await Promise.all([
            getYoutubeMetadata(videoId),
            convertYoutube(url, "mp3")
        ]);
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            duration: metadata?.duration ? formatDuration(metadata.duration) : "0:00",
            download_url: download.url,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ==================== [ YOUTUBE SEARCH ENDPOINT ] ====================
app.get("/api/v1/search/youtube-search", async (req, res) => {
    const start = Date.now();
    try {
        const { query, limit = 5 } = req.query;
        if (!query) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'query' diperlukan",
                timestamp: new Date().toISOString()
            });
        }
        const results = await searchYoutube(query, parseInt(limit));
        const formattedResults = {};
        for (let i = 0; i < results.length; i++) {
            formattedResults[`hasil${i + 1}`] = results[i];
        }
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            ...formattedResults,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ==================== [ YOUTUBE METADATA ENDPOINT ] ====================
app.get("/api/v1/tools/youtube-metadata", async (req, res) => {
    const start = Date.now();
    try {
        const { url } = req.query;
        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString()
            });
        }
        const videoId = extractYoutubeId(url);
        if (!videoId) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "URL YouTube tidak valid",
                timestamp: new Date().toISOString()
            });
        }
        const metadata = await getYoutubeMetadata(videoId);
        if (!metadata) {
            return jsonResponse(res, 404, {
                status: false,
                creator: CREATOR_NAME,
                error: "Metadata tidak ditemukan",
                timestamp: new Date().toISOString()
            });
        }
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            title: metadata.title,
            channel: metadata.channel,
            duration: formatDuration(metadata.duration),
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ==================== [ TIKTOK ENDPOINT ] ====================
app.get("/api/v1/downloader/tiktok", async (req, res) => {
    const start = Date.now();
    try {
        const { url } = req.query;
        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString()
            });
        }
        const result = await getTikTok(url);
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: result,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ==================== [ SPOTIFY ENDPOINT ] ====================
app.get("/api/v1/downloader/spotify", async (req, res) => {
    const start = Date.now();
    try {
        const { url } = req.query;
        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString()
            });
        }
        const result = await downloadSpotify(url);
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            title: result.title,
            artist: result.artist,
            download_url: result.download_url,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = app;