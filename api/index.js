const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");

const app = express();
app.use(cors());
app.use(express.json());

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

// ========== [ CLASS SAVETUBE ] ==========
class Savetube {
    constructor() {
        this.ky = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
        this.hr = {
            'content-type': 'application/json',
            'origin': 'https://savetube.vip',
            'user-agent': 'Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0'
        };
        this.fmt = ['144', '240', '360', '480', '720', '1080', 'mp3'];
        this.cdnList = ['cdn400.savetube.vip', 'cdn401.savetube.vip', 'cdn402.savetube.vip', 'cdn403.savetube.vip'];
    }

    async decrypt(enc) {
        try {
            const [sr, ky] = [Buffer.from(enc, 'base64'), Buffer.from(this.ky, 'hex')];
            const [iv, dt] = [sr.slice(0, 16), sr.slice(16)];
            const dc = crypto.createDecipheriv('aes-128-cbc', ky, iv);
            return JSON.parse(Buffer.concat([dc.update(dt), dc.final()]).toString());
        } catch (e) {
            throw new Error(`Error while decrypting data: ${e.message}`);
        }
    }

    async getCdn() {
        try {
            const response = await axios.get("https://media.savetube.vip/api/random-cdn", { 
                headers: this.hr,
                timeout: 5000 
            });
            if (response.data && response.data.cdn) {
                console.log("CDN from API:", response.data.cdn);
                return response.data.cdn;
            }
        } catch (error) {
            console.log("Random CDN API failed, using fallback list");
        }
        
        const randomCdn = this.cdnList[Math.floor(Math.random() * this.cdnList.length)];
        console.log("Using fallback CDN:", randomCdn);
        return randomCdn;
    }

    async download(url, format = 'mp3') {
        const id = extractYoutubeId(url);
        if (!id) {
            throw new Error("Gagal mengekstrak ID YouTube dari URL");
        }
        
        if (!format || !this.fmt.includes(format)) {
            throw new Error(`Format tidak tersedia. Pilih: ${this.fmt.join(', ')}`);
        }
        
        const cdn = await this.getCdn();
        console.log(`Using CDN: ${cdn} for video ID: ${id}`);
        
        const info = await axios.post(`https://${cdn}/v2/info`, {
            url: `https://www.youtube.com/watch?v=${id}`
        }, { 
            headers: this.hr,
            timeout: 15000 
        });
        
        if (!info.data || !info.data.data) {
            throw new Error("Respon tidak valid dari endpoint info");
        }
        
        const dec = await this.decrypt(info.data.data);
        
        const download = await axios.post(`https://${cdn}/download`, {
            id: id,
            downloadType: format === 'mp3' ? 'audio' : 'video',
            quality: format === 'mp3' ? '128' : format,
            key: dec.key
        }, { 
            headers: this.hr,
            timeout: 20000 
        });

        if (!download.data || !download.data.data || !download.data.data.downloadUrl) {
            throw new Error("Respon tidak valid dari endpoint download");
        }

        return {
            title: dec.title,
            format: format,
            thumbnail: dec.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: dec.duration,
            url: download.data.data.downloadUrl
        };
    }
}

// ========== [ INISIALISASI ] ==========
const savetube = new Savetube();

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

// ========== [ ENDPOINT AUDIO / YTMP3 ] ==========
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

        const result = await savetube.download(url, "mp3");

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

// ========== [ ENDPOINT VIDEO / YTMP4 ] ==========
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

        const result = await savetube.download(url, resolusi);

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
        const result = await savetube.download(video.url, "mp3");

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