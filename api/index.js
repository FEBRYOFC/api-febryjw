const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");

const app = express();
app.use(cors());
app.use(express.json());

// ========== [ KONSTANTA ] ==========
const KEY = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
const HEADERS = {
    'content-type': 'application/json',
    'origin': 'https://yt.savetube.vip',
    'user-agent': 'Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0'
};
const FORMATS = ['144', '240', '360', '480', '720', '1080', 'mp3'];
const CDN_LIST = ['cdn400.savetube.vip', 'cdn401.savetube.vip', 'cdn402.savetube.vip', 'cdn403.savetube.vip'];

// ========== [ FUNGSI EKSTRAK ID YOUTUBE ] ==========
function extractYoutubeId(url) {
    if (!url) return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*[?&]v=([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            if (urlObj.hostname.includes('youtu.be')) {
                return urlObj.pathname.slice(1);
            }
            const v = urlObj.searchParams.get('v');
            if (v) return v;
        }
    } catch (e) {}
    
    return null;
}

// ========== [ FUNGSI DECRYPT ] ==========
async function decryptData(enc) {
    try {
        const sr = Buffer.from(enc, 'base64');
        const key = Buffer.from(KEY, 'hex');
        const iv = sr.slice(0, 16);
        const data = sr.slice(16);
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        return JSON.parse(decrypted.toString());
    } catch (e) {
        throw new Error(`Gagal decrypt data: ${e.message}`);
    }
}

// ========== [ FUNGSI DAPATKAN CDN ] ==========
async function getCdn() {
    try {
        const response = await axios.get("https://media.savetube.vip/api/random-cdn", { 
            headers: HEADERS,
            timeout: 5000 
        });
        if (response.data && response.data.cdn) {
            console.log("CDN from API:", response.data.cdn);
            return response.data.cdn;
        }
    } catch (error) {
        console.log("Random CDN API failed, using fallback list");
    }
    
    const randomCdn = CDN_LIST[Math.floor(Math.random() * CDN_LIST.length)];
    console.log("Using fallback CDN:", randomCdn);
    return randomCdn;
}

// ========== [ FUNGSI VALIDASI URL ] ==========
async function validateUrl(url, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.head(url, { 
                timeout: 5000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            if (response.status === 200) {
                console.log(`URL valid pada percobaan ke-${i + 1}`);
                return true;
            }
        } catch (error) {
            console.log(`Percobaan ${i + 1} gagal: ${error.message}`);
        }
        if (i < retries - 1) {
            console.log(`Menunggu ${delay/1000} detik sebelum mencoba lagi...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return false;
}

// ========== [ FUNGSI DOWNLOAD UTAMA ] ==========
async function downloadFromSavetube(url, format = 'mp3', retryCount = 0) {
    const id = extractYoutubeId(url);
    if (!id) {
        throw new Error("Gagal mengekstrak ID YouTube dari URL");
    }
    
    if (!FORMATS.includes(format)) {
        throw new Error(`Format tidak tersedia. Pilih: ${FORMATS.join(', ')}`);
    }
    
    const cdn = await getCdn();
    console.log(`Menggunakan CDN: ${cdn} untuk video ID: ${id}`);
    
    try {
        // Request info video
        const infoResponse = await axios.post(`https://${cdn}/v2/info`, {
            url: `https://www.youtube.com/watch?v=${id}`
        }, { 
            headers: HEADERS,
            timeout: 15000 
        });
        
        if (!infoResponse.data || !infoResponse.data.data) {
            throw new Error("Respon tidak valid dari endpoint info");
        }
        
        const videoInfo = await decryptData(infoResponse.data.data);
        
        // Request download URL
        const downloadResponse = await axios.post(`https://${cdn}/download`, {
            id: id,
            downloadType: format === 'mp3' ? 'audio' : 'video',
            quality: format === 'mp3' ? '128' : format,
            key: videoInfo.key
        }, { 
            headers: HEADERS,
            timeout: 20000 
        });

        if (!downloadResponse.data || !downloadResponse.data.data || !downloadResponse.data.data.downloadUrl) {
            throw new Error("Respon tidak valid dari endpoint download");
        }

        const downloadUrl = downloadResponse.data.data.downloadUrl;
        
        // Validasi URL
        console.log("Memvalidasi URL download...");
        const isValid = await validateUrl(downloadUrl);
        
        if (!isValid) {
            if (retryCount < 2) {
                console.log(`URL tidak valid, mencoba dengan CDN berbeda (percobaan ${retryCount + 1})...`);
                return downloadFromSavetube(url, format, retryCount + 1);
            } else {
                throw new Error("URL download tidak valid setelah beberapa percobaan dengan CDN berbeda");
            }
        }

        return {
            title: videoInfo.title,
            format: format,
            thumbnail: videoInfo.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: videoInfo.duration,
            url: downloadUrl
        };
        
    } catch (error) {
        if (retryCount < 2) {
            console.log(`Error dengan CDN ${cdn}, mencoba CDN lain (percobaan ${retryCount + 1})...`);
            return downloadFromSavetube(url, format, retryCount + 1);
        } else {
            throw error;
        }
    }
}

// ========== [ FUNGSI WAKTU INDONESIA ] ==========
function waktuIndonesia() {
    return new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

// ========== [ ENDPOINT UTAMA ] ==========
app.get("/", (req, res) => {
    res.json({
        status: true,
        creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
        message: "YouTube Downloader API (Savetube)",
        endpoints: {
            audio: "/api/v1/youtube/audio?url=YOUTUBE_URL",
            video: "/api/v1/youtube/video?url=YOUTUBE_URL&resolusi=720",
            playmp3: "/api/v1/youtube/ytplaymp3?query=SEARCH_QUERY"
        },
        timestamp: new Date().toISOString()
    });
});

// ========== [ ENDPOINT AUDIO ] ==========
app.get("/api/v1/youtube/audio", async (req, res) => {
    const start = Date.now();
    
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        const result = await downloadFromSavetube(url, "mp3");

        res.json({
            status: true,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: {
                title: result.title,
                duration: result.duration,
                thumbnail: result.thumbnail,
                url: result.url,
                format: "mp3",
                quality: "128kbps"
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });

    } catch (error) {
        console.error("Audio Error:", error.message);
        
        res.status(500).json({
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT VIDEO ] ==========
app.get("/api/v1/youtube/video", async (req, res) => {
    const start = Date.now();
    
    try {
        const { url, resolusi = "720" } = req.query;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        const result = await downloadFromSavetube(url, resolusi);

        res.json({
            status: true,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: {
                title: result.title,
                duration: result.duration,
                thumbnail: result.thumbnail,
                url: result.url,
                format: "mp4",
                quality: resolusi + "p"
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });

    } catch (error) {
        console.error("Video Error:", error.message);
        
        res.status(500).json({
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT YTPLAYMP3 ] ==========
app.get("/api/v1/youtube/ytplaymp3", async (req, res) => {
    const start = Date.now();
    
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({
                status: false,
                creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                error: "Parameter 'query' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        // Cari video di YouTube
        const search = await yts(query);
        if (!search.videos || search.videos.length === 0) {
            throw new Error("Tidak ada video ditemukan untuk pencarian ini");
        }
        
        const video = search.videos[0];
        console.log(`Video ditemukan: ${video.title} (${video.url})`);
        
        // Download audio dari video pertama
        const result = await downloadFromSavetube(video.url, "mp3");

        res.json({
            status: true,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: {
                query: query,
                video: {
                    title: video.title,
                    videoId: video.videoId,
                    duration: video.duration,
                    thumbnail: video.thumbnail,
                    url: video.url
                },
                audio: {
                    title: result.title,
                    duration: result.duration,
                    url: result.url,
                    format: "mp3",
                    quality: "128kbps"
                }
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });

    } catch (error) {
        console.error("Ytplaymp3 Error:", error.message);
        
        res.status(500).json({
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

module.exports = app;