const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

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
        this.m = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/;
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
        // Coba ambil dari API random-cdn
        try {
            const response = await axios.get("https://media.savetube.vip/api/random-cdn", { 
                headers: this.hr,
                timeout: 5000 
            });
            if (response.data && response.data.cdn) {
                console.log("CDN from API:", response.data.cdn);
                return {
                    status: true,
                    data: response.data.cdn
                };
            }
        } catch (error) {
            console.log("Random CDN API failed, using fallback list");
        }
        
        // Fallback: pilih random dari daftar CDN yang diketahui
        const randomCdn = this.cdnList[Math.floor(Math.random() * this.cdnList.length)];
        console.log("Using fallback CDN:", randomCdn);
        return {
            status: true,
            data: randomCdn
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
        
        console.log(`Using CDN: ${u.data} for video ID: ${id}`);
        
        const res = await axios.post(`https://${u.data}/v2/info`, {
            url: `https://www.youtube.com/watch?v=${id}`
        }, { 
            headers: this.hr,
            timeout: 15000 
        });
        
        if (!res.data || !res.data.data) {
            throw new Error("Invalid response from info endpoint");
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
            throw new Error("Invalid response from download endpoint");
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
        message: "YouTube Downloader API (Savetube)",
        endpoints: {
            ytmp3: "/api/ytmp3?url=YOUTUBE_URL",
            ytmp4: "/api/ytmp4?url=YOUTUBE_URL&quality=720",
            info: "/api/info?url=YOUTUBE_URL"
        },
        timestamp: new Date().toISOString()
    });
});

// ========== [ ENDPOINT YTMP3 ] ==========
app.get("/api/ytmp3", async (req, res) => {
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
        console.error("YTMP3 Error:", error.message);
        
        res.status(500).json({
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT YTMP4 ] ==========
app.get("/api/ytmp4", async (req, res) => {
    const start = Date.now();
    
    try {
        const { url, quality = "720" } = req.query;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        const result = await savetube.download(url, quality);

        res.json({
            status: true,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: {
                title: result.title,
                duration: result.duration,
                thumbnail: result.thumbnail,
                url: result.url,
                format: "mp4",
                quality: quality + "p"
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });

    } catch (error) {
        console.error("YTMP4 Error:", error.message);
        
        res.status(500).json({
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT INFO ] ==========
app.get("/api/info", async (req, res) => {
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

        const id = url.match(savetube.m)?.[3];
        if (!id) {
            throw new Error("ID cannot be extracted from URL");
        }

        const u = await savetube.getCdn();
        const info = await axios.post(`https://${u.data}/v2/info`, {
            url: `https://www.youtube.com/watch?v=${id}`
        }, { 
            headers: savetube.hr,
            timeout: 10000 
        });

        const dec = await savetube.decrypt(info.data.data);

        res.json({
            status: true,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: {
                title: dec.title,
                duration: dec.duration,
                thumbnail: dec.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                formats: savetube.fmt
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });

    } catch (error) {
        console.error("INFO Error:", error.message);
        
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