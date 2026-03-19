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
const CDNS = ['cdn403.savetube.vip', 'cdn400.savetube.vip']; // Daftar CDN yang work
const BLOCKED_CDNS = ['cdn401.savetube.vip', 'cdn402.savetube.vip']; // CDN yang error

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

// ========== [ FUNGSI CEK CDN ] ==========
async function checkCDN(cdn) {
    try {
        await axios.get(`https://${cdn}`, {
            timeout: 5000,
            headers: HEADERS
        });
        return true;
    } catch (error) {
        console.log(`CDN ${cdn} tidak dapat diakses: ${error.message}`);
        return false;
    }
}

// ========== [ FUNGSI REPLACE CDN URL ] ==========
function replaceCDNinUrl(downloadUrl, targetCDN) {
    try {
        // Cari domain CDN di URL
        const urlObj = new URL(downloadUrl);
        const currentHost = urlObj.hostname;
        
        // Cek apakah host saat ini termasuk dalam BLOCKED_CDNS
        if (BLOCKED_CDNS.includes(currentHost)) {
            console.log(`Mengganti CDN dari ${currentHost} ke ${targetCDN}`);
            urlObj.hostname = targetCDN;
            return urlObj.toString();
        }
        
        return downloadUrl;
    } catch (error) {
        console.log("Gagal mengganti CDN di URL:", error.message);
        return downloadUrl;
    }
}

// ========== [ FUNGSI DAPATKAN CDN WORK ] ==========
async function getWorkingCDN() {
    // Urutan prioritas CDN
    const priorityCDNs = ['cdn403.savetube.vip', 'cdn400.savetube.vip'];
    
    for (const cdn of priorityCDNs) {
        const isWorking = await checkCDN(cdn);
        if (isWorking) {
            console.log(`Menggunakan CDN: ${cdn}`);
            return cdn;
        }
    }
    
    // Jika semua CDN prioritas gagal, coba dari daftar lengkap
    for (const cdn of CDNS) {
        if (!priorityCDNs.includes(cdn)) {
            const isWorking = await checkCDN(cdn);
            if (isWorking) {
                console.log(`Menggunakan CDN alternatif: ${cdn}`);
                return cdn;
            }
        }
    }
    
    throw new Error("Tidak ada CDN yang tersedia");
}

// ========== [ FUNGSI UTAMA DOWNLOAD ] ==========
async function downloadFromSavetube(url, format = 'mp3', cdnAttempt = 0) {
    const id = extractYoutubeId(url);
    if (!id) {
        throw new Error("Gagal mengekstrak ID YouTube dari URL");
    }
    
    if (!FORMATS.includes(format)) {
        throw new Error(`Format tidak tersedia. Pilih: ${FORMATS.join(', ')}`);
    }
    
    // Dapatkan CDN yang work
    const currentCDN = await getWorkingCDN();
    console.log(`Mencoba dengan CDN: ${currentCDN} untuk video ID: ${id} (Percobaan ke-${cdnAttempt + 1})`);
    
    try {
        // Request info video
        const infoResponse = await axios.post(`https://${currentCDN}/v2/info`, {
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
        const downloadResponse = await axios.post(`https://${currentCDN}/download`, {
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

        let downloadUrl = downloadResponse.data.data.downloadUrl;
        
        // Ganti CDN di URL download jika menggunakan CDN yang diblokir
        downloadUrl = replaceCDNinUrl(downloadUrl, currentCDN);
        
        console.log("Download URL berhasil didapatkan dari CDN:", currentCDN);
        
        return {
            title: videoInfo.title,
            format: format,
            thumbnail: videoInfo.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: videoInfo.duration,
            url: downloadUrl,
            cdn: currentCDN
        };
        
    } catch (error) {
        console.error(`Gagal dengan CDN ${currentCDN}:`, error.message);
        
        // Cek apakah error karena CDN mati (401, 402, atau error koneksi)
        if (error.response) {
            const statusCode = error.response.status;
            if (statusCode === 401 || statusCode === 402 || statusCode >= 500) {
                console.log(`CDN ${currentCDN} error dengan kode ${statusCode}, mencoba CDN lain...`);
                
                // Paksa refresh CDN dengan mencoba ulang tanpa batasan percobaan
                if (cdnAttempt < CDNS.length * 2) { // Maksimal percobaan 2x jumlah CDN
                    return downloadFromSavetube(url, format, cdnAttempt + 1);
                }
            }
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            console.log(`CDN ${currentCDN} tidak dapat dihubungi, mencoba CDN lain...`);
            
            if (cdnAttempt < CDNS.length * 2) {
                return downloadFromSavetube(url, format, cdnAttempt + 1);
            }
        }
        
        throw new Error(`Gagal download dari semua CDN: ${error.message}`);
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
        message: "YouTube Downloader API (Savetube) dengan Multiple CDN",
        available_cdns: CDNS,
        blocked_cdns: BLOCKED_CDNS,
        endpoints: {
            audio: "/api/v1/youtube/audio?url=YOUTUBE_URL",
            video: "/api/v1/youtube/video?url=YOUTUBE_URL&resolusi=720",
            playmp3: "/api/v1/youtube/ytplaymp3?query=SEARCH_QUERY",
            cdn_status: "/api/v1/youtube/cdn-status"
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
                quality: "128kbps",
                cdn_used: result.cdn
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
                quality: resolusi + "p",
                cdn_used: result.cdn
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

        const search = await yts(query);
        if (!search.videos || search.videos.length === 0) {
            throw new Error("Tidak ada video ditemukan untuk pencarian ini");
        }
        
        const video = search.videos[0];
        console.log(`Video ditemukan: ${video.title} (${video.url})`);
        
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
                    quality: "128kbps",
                    cdn_used: result.cdn
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

// ========== [ ENDPOINT CEK STATUS CDN ] ==========
app.get("/api/v1/youtube/cdn-status", async (req, res) => {
    const results = {};
    
    // Cek semua CDN termasuk yang diblokir
    const allCDNs = [...CDNS, ...BLOCKED_CDNS];
    
    for (const cdn of allCDNs) {
        try {
            await axios.get(`https://${cdn}`, {
                timeout: 5000,
                headers: HEADERS
            });
            results[cdn] = "Online";
        } catch (error) {
            results[cdn] = `Offline (${error.message})`;
        }
    }
    
    res.json({
        status: true,
        creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
        cdns: results,
        timestamp: new Date().toISOString()
    });
});

module.exports = app;