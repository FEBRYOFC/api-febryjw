const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");

const app = express();
app.use(cors());
app.use(express.json());

// ================= SAVETUBE CLASS (MODIFIKASI) =================
class Savetube {
    constructor() {
        this.ky = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        ];
        this.hr = {
            'content-type': 'application/json',
            'origin': 'https://savetube.vip',
            'referer': 'https://savetube.vip/',
            'user-agent': this.userAgents[Math.floor(Math.random() * this.userAgents.length)]
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
        try {
            const response = await axios.get("https://media.savetube.vip/api/random-cdn", { headers: this.hr });
            if (response.data && response.data.cdn) {
                return { status: true, data: response.data.cdn };
            }
        } catch (e) {
            // fallback
        }
        const fallbackList = ['cdn401.savetube.vip', 'cdn402.savetube.vip', 'cdn403.savetube.vip'];
        return { status: true, data: fallbackList[Math.floor(Math.random() * fallbackList.length)] };
    }

    async download(url, format = 'mp3') {
        const id = url.match(this.m)?.[3];
        if (!id) throw new Error("ID cannot be extracted from URL");
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

// ================= FUNGSI UNTUK LACAK IP =================
async function waktuIndonesia() {
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

async function detectOS(ua) {
    ua = ua.toLowerCase();
    if (ua.includes("android")) return "Android";
    if (ua.includes("iphone")) return "iOS";
    if (ua.includes("windows")) return "Windows";
    if (ua.includes("mac")) return "MacOS";
    if (ua.includes("linux")) return "Linux";
    return "Unknown";
}

async function detectBrowser(ua) {
    ua = ua.toLowerCase();
    if (ua.includes("chrome")) return "Chrome";
    if (ua.includes("firefox")) return "Firefox";
    if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
    if (ua.includes("edge")) return "Edge";
    return "Unknown";
}

async function detectBot(ua) {
    ua = ua.toLowerCase();
    const bots = ["bot", "crawler", "spider", "curl", "wget", "python", "node-fetch"];
    return bots.some((x) => ua.includes(x));
}

async function tipeJaringan(data) {
    if (data.hosting) return "Datacenter / Server";
    if (data.mobile) return "Mobile Network";
    if (data.proxy) return "Kemungkinan VPN / Proxy";
    return "Home ISP";
}

// ================= ROOT =================
app.get("/", (req, res) => {
    res.json({
        status: true,
        author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
        result: {
            message: "YouTube Downloader & Lacak IP API",
            endpoints: {
                ytplay: "/api/v1/youtube/ytplay?query=...",
                ytmp3: "/api/v1/youtube/ytmp3?url=...",
                ytmp4: "/api/v1/youtube/ytmp4?url=...&resolusi=720",
                lacak: "/api/v1/lacak?ip=..."
            }
        },
        timestamp: new Date().toISOString()
    });
});

// ================= LACAK IP =================
app.get("/api/v1/lacak", async (req, res) => {
    const start = Date.now();
    try {
        const ipQuery = req.query.ip;
        const ip = ipQuery || req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "";
        const ua = req.headers["user-agent"] || "unknown";

        const api = await axios.get(
            `http://ip-api.com/json/${ip}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,offset,currency,isp,org,as,asname,reverse,mobile,proxy,hosting,query`
        );
        const g = api.data;
        const maps = `https://www.google.com/maps?q=${g.lat},${g.lon}`;

        const os = await detectOS(ua);
        const browser = await detectBrowser(ua);
        const bot = await detectBot(ua);
        const jaringan = await tipeJaringan(g);

        res.json({
            status: true,
            author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: {
                ip: g.query,
                lokasi: {
                    benua: g.continent,
                    negara: g.country,
                    provinsi: g.regionName,
                    kota: g.city,
                    kode_pos: g.zip
                },
                koordinat: {
                    latitude: g.lat,
                    longitude: g.lon,
                    google_maps: maps
                },
                jaringan: {
                    isp: g.isp,
                    organisasi: g.org,
                    as: g.as,
                    as_name: g.asname,
                    tipe: jaringan,
                    mobile_network: g.mobile,
                    vpn_proxy: g.proxy,
                    hosting: g.hosting
                },
                sistem: {
                    os: os,
                    browser: browser,
                    bot_request: bot,
                    user_agent: ua
                },
                waktu: {
                    timezone: g.timezone,
                    offset: g.offset
                }
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

// ================= YTPLAY (SEARCH + MP3) =================
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

        const search = await yts(query);
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
        res.status(500).json({
            status: false,
            author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ================= YTMP3 =================
app.get("/api/v1/youtube/ytmp3", async (req, res) => {
    const start = Date.now();
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({
                status: false,
                author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                result: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

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
        res.status(500).json({
            status: false,
            author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ================= YTMP4 =================
app.get("/api/v1/youtube/ytmp4", async (req, res) => {
    const start = Date.now();
    try {
        const { url, resolusi } = req.query;
        if (!url) {
            return res.status(400).json({
                status: false,
                author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                result: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

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
        res.status(500).json({
            status: false,
            author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            result: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

module.exports = app;