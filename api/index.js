const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");

const app = express();
app.use(cors());
app.use(express.json());

// ================= SAVETUBE CLASS (DARI ANDA) =================
class Savetube {
    constructor() {
        this.ky = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
        this.hr = {
            'content-type': 'application/json',
            'origin': 'https://yt.savetube.vip',
            'user-agent': 'Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0'
        };
        this.fmt = ['144', '240', '360', '480', '720', '1080', 'mp3'];
        this.m = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/;
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
        const response = await axios.get("https://media.savetube.vip/api/random-cdn", { headers: this.hr });
        if (!response.status) return response;
        return {
            status: true,
            data: response.data.cdn
        };
    }

    async download(url, format = 'mp3') {
        const id = url.match(this.m)?.[3];
        if (!id) {
            throw new Error("ID cannot be extracted from URL");
        }
        if (!format || !this.fmt.includes(format)) {
            throw new Error(`Format not found. Available formats: ${this.fmt.join(', ')}`);
        }
        const u = await this.getCdn();
        if (!u.status) throw new Error("Failed to fetch CDN");
        const res = await axios.post(`https://${u.data}/v2/info`, {
            url: `https://www.youtube.com/watch?v=${id}`
        }, { headers: this.hr });
        const dec = await this.decrypt(res.data.data);
        const dl = await axios.post(`https://${u.data}/download`, {
            id: id,
            downloadType: format === 'mp3' ? 'audio' : 'video',
            quality: format === 'mp3' ? '128' : format,
            key: dec.key
        }, { headers: this.hr });

        return {
            title: dec.title,
            format: format,
            thumbnail: dec.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: dec.duration,
            url: dl.data.data.downloadUrl
        };
    }
}

const savetube = new Savetube();

// ================= ENDPOINT YTPLAY (SEARCH + MP3) =================
// ================= ENDPOINT YTPLAY (SEARCH + MP3) =================
app.get("/api/v1/youtube/ytplay", async (req, res) => {
    const start = Date.now();
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({
                status: false,
                author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                result: "Parameter 'query' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        // Lakukan pencarian dengan yts
        const search = await yts(query);
        
        // Ambil video pertama
        const video = search.videos?.[0];
        if (!video) {
            return res.status(404).json({
                status: false,
                author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                result: "Tidak ditemukan video untuk kata kunci tersebut",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        // Unduh audio menggunakan savetube
        const download = await savetube.download(video.url, "mp3");

        res.json({
            status: true,
            author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: {
                query: query,
                video: {
                    title: video.title,
                    videoId: video.videoId,
                    duration: video.duration,
                    thumbnail: video.thumbnail,
                    url: video.url
                },
                download: {
                    title: download.title,
                    format: download.format,
                    thumbnail: download.thumbnail,
                    duration: download.duration,
                    url: download.url
                }
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("Error di ytplay:", error);
        res.status(500).json({
            status: false,
            author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: error.message || "Terjadi kesalahan internal",
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ================= ENDPOINT YTMP3 =================
app.get("/api/v1/youtube/ytmp3", async (req, res) => {
    const start = Date.now();
    try {
        const { url } = req.query;
        if (!url) throw new Error("Parameter 'url' diperlukan");

        const download = await savetube.download(url, "mp3");

        res.json({
            status: true,
            author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: {
                title: download.title,
                format: download.format,
                thumbnail: download.thumbnail,
                duration: download.duration,
                url: download.url
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        res.json({
            status: false,
            author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ================= ENDPOINT YTMP4 =================
app.get("/api/v1/youtube/ytmp4", async (req, res) => {
    const start = Date.now();
    try {
        const { url, resolusi } = req.query;
        if (!url) throw new Error("Parameter 'url' diperlukan");

        const quality = resolusi || "720";
        const download = await savetube.download(url, quality);

        res.json({
            status: true,
            author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: {
                title: download.title,
                format: download.format,
                thumbnail: download.thumbnail,
                duration: download.duration,
                url: download.url
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        res.json({
            status: false,
            author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ================= ROOT =================
app.get("/", (req, res) => {
    res.json({
        status: true,
        author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
        result: {
            message: "YouTube Downloader API",
            endpoints: {
                ytplay: "/api/v1/youtube/ytplay?query=...",
                ytmp3: "/api/v1/youtube/ytmp3?url=...",
                ytmp4: "/api/v1/youtube/ytmp4?url=...&resolusi=720"
            }
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = app;