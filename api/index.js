const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");

const app = express();
app.use(cors());
app.use(express.json());

// ========== [ CLASS SAVETUBE ] ==========
class Savetube {
    constructor() {
        this.ky = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
        this.hr = {
            'content-type': 'application/json',
            'origin': 'https://yt.savetube.vip',
            'user-agent': 'Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0'
        };
        this.fmt = ['144', '240', '360', '480', '720', '1080', 'mp3'];
        this.m = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        this.cdnList = ['cdn400.savetube.vip', 'cdn401.savetube.vip', 'cdn402.savetube.vip', 'cdn403.savetube.vip'];
    }

    cleanUrl(url) {
        return url.split('?')[0].split('&')[0];
    }

    extractVideoId(url) {
        const match = url.match(this.m);
        return match ? match[1] : null;
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
                return { status: true, data: response.data.cdn };
            }
        } catch (error) {
            console.log("Random CDN API failed, using fallback list");
        }
        
        const randomCdn = this.cdnList[Math.floor(Math.random() * this.cdnList.length)];
        return { status: true, data: randomCdn };
    }

    async download(url, format = 'mp3') {
        const cleanVideoUrl = this.cleanUrl(url);
        const id = this.extractVideoId(cleanVideoUrl);
        
        if (!id) {
            throw new Error("Gagal mengekstrak ID YouTube dari URL");
        }
        
        if (!format || !this.fmt.includes(format)) {
            throw new Error(`Format tidak tersedia. Pilih: ${this.fmt.join(', ')}`);
        }
        
        const u = await this.getCdn();
        if (!u.status) throw new Error("Gagal mendapatkan CDN");
        
        const res = await axios.post(`https://${u.data}/v2/info`, {
            url: `https://www.youtube.com/watch?v=${id}`
        }, { 
            headers: this.hr,
            timeout: 15000 
        });
        
        if (!res.data || !res.data.data) {
            throw new Error("Respon tidak valid dari endpoint info");
        }
        
        const dec = await this.decrypt(res.data.data);
        
        const dl = await axios.post(`https://${u.data}/download`, {
            id: id,
            downloadType: format === 'mp3' ? 'audio' : 'video',
            quality: format === 'mp3' ? '128' : format,
            key: dec.key
        }, { 
            headers: this.hr,
            timeout: 20000 
        });

        if (!dl.data || !dl.data.data || !dl.data.data.downloadUrl) {
            throw new Error("Respon tidak valid dari endpoint download");
        }

        return {
            title: dec.title,
            format: format,
            thumbnail: dec.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: dec.duration,
            url: dl.data.data.downloadUrl
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
        result: {
            message: "YouTube Downloader API (Savetube)",
            endpoints: {
                ytmp3: "/api/v1/youtube/ytmp3?url=YOUTUBE_URL",
                ytmp4: "/api/v1/youtube/ytmp4?url=YOUTUBE_URL&resolusi=720",
                ytplay: "/api/v1/youtube/ytplay?query=stecu stecu"
            }
        },
        timestamp: new Date().toISOString(),
        response_time: "0ms"
    });
});

// ========== [ ENDPOINT YTMP3 ] ==========
app.get("/api/v1/youtube/ytmp3", async (req, res) => {
    const start = Date.now();
    
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                result: "Parameter 'url' diperlukan",
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
        res.status(500).json({
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT YTMP4 ] ==========
app.get("/api/v1/youtube/ytmp4", async (req, res) => {
    const start = Date.now();
    
    try {
        const { url, resolusi = "720" } = req.query;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                result: "Parameter 'url' diperlukan",
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
        res.status(500).json({
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT YTPLAY ] ==========
app.get("/api/v1/youtube/ytplay", async (req, res) => {
    const start = Date.now();
    
    try {
        const { query } = req.query;
        
        if (!query) {
            return res.status(400).json({
                status: false,
                creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                result: "Parameter 'query' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        // Cari video di YouTube
        const search = await yts(query);
        
        if (!search.videos || search.videos.length === 0) {
            return res.status(404).json({
                status: false,
                creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                result: "Tidak ditemukan video untuk kata kunci tersebut",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        const video = search.videos[0];
        
        // Download MP3 dari video pertama
        const download = await savetube.download(video.url, "mp3");

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
                download: {
                    title: download.title,
                    duration: download.duration,
                    thumbnail: download.thumbnail,
                    url: download.url,
                    format: "mp3",
                    quality: "128kbps"
                }
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

module.exports = app;