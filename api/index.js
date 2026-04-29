const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== [ KONSTANTA UMUM ] ====================
const CREATOR_NAME = "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀"; // Nama pembuat API
const RANDOM_CDN_API = "https://media.savetube.vip/api/random-cdn"; // API untuk rotasi server SaveTube

// ==================== [ KONSTANTA YOUTUBE METADATA PROXY ] ====================
const YT_PROXY_API = "https://ytapi.apps.mattw.io/v3"; // Base URL Scraper Metadata
const YT_PROXY_KEY = "foo1"; // Kunci API Dummy (dapat digunakan secara bebas)

// ==================== [ KONSTANTA SAVE TUBE (YOUTUBE) ] ====================
const SAVE_TUBE = {
    KEY: "C5D58EF67A7584E4A29F6C35BBC4EB12", // Kunci dekripsi AES statis SaveTube
    HEADERS: {
        "content-type": "application/json",
        origin: "https://save-tube.com",
        referer: "https://save-tube.com/",
        "user-agent": "Mozilla/5.0 (Android 10; Mobile; rv:148.0) Gecko/148.0 Firefox/148.0"
    }
};

// ==================== [ KONSTANTA TIKTOK NEXRAY ] ====================
const NEXRAY = {
    BASE_URL: "https://api.nexray.web.id",
    ENDPOINTS: { DOWNLOAD: "/downloader/tiktok" }
};

// ==================== [ FUNGSI UTILITAS ] ====================
// Fungsi untuk memformat respons JSON agar rapi
function jsonResponse(res, statusCode, data) {
    res.setHeader("Content-Type", "application/json");
    res.status(statusCode).send(JSON.stringify(data, null, 2));
}

// Fungsi untuk mengambil ID YouTube dari berbagai bentuk URL
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

// ==================== [ FUNGSI METADATA KUSTOM (SCRAPER SENDIRI) ] ====================
async function getCustomYouTubeMetadata(videoId) {
    try {
        const url = `${YT_PROXY_API}/videos?key=${YT_PROXY_KEY}&part=snippet,statistics,contentDetails&id=${videoId}`;
        const response = await axios.get(url, { timeout: 15000 });
        
        if (response.data && response.data.items && response.data.items.length > 0) {
            const item = response.data.items[0]; // Ambil data index pertama
            return {
                video_id: item.id, // ID unik video YouTube
                title: item.snippet.title, // Judul video
                description: item.snippet.description, // Deskripsi video
                published_at: item.snippet.publishedAt, // Tanggal publikasi
                channel_info: {
                    id: item.snippet.channelId, // ID channel pembuat
                    name: item.snippet.channelTitle // Nama channel
                },
                statistics: {
                    views: item.statistics.viewCount || "0", // Jumlah tayangan
                    likes: item.statistics.likeCount || "0", // Jumlah likes
                    comments: item.statistics.commentCount || "0" // Jumlah komentar
                },
                duration_iso: item.contentDetails.duration, // Durasi dalam format ISO (contoh: PT7M37S)
                thumbnails: item.snippet.thumbnails // Objek berisi berbagai resolusi thumbnail
            };
        }
        return null; // Return null jika tidak ada data dari proxy
    } catch (error) {
        console.error(`[Metadata Error] ID ${videoId}:`, error.message);
        return null;
    }
}

// ==================== [ FUNGSI INTI YOUTUBE DOWNLOADING ] ====================
// Mendekripsi payload response dari SaveTube (Wajib karena mereka pakai AES)
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
    const response = await axios.get(RANDOM_CDN_API, { timeout: 15000, headers: SAVE_TUBE.HEADERS });
    return response.data?.cdn;
}

// Melakukan bypass dan mengekstrak link asli dari SaveTube
async function downloadFromSavetube(url, format = "mp3") {
    const id = extractYoutubeId(url);
    if (!id) throw new Error("Gagal mengekstrak ID YouTube");

    const cdn = await getRandomCDN();

    // 1. Eksekusi permintaan Info ke CDN SaveTube
    const infoRes = await axios.post(`https://${cdn}/v2/info`, { url: `https://www.youtube.com/watch?v=${id}` }, { headers: SAVE_TUBE.HEADERS });
    const raw = infoRes.data?.data;
    const videoInfo = typeof raw === "string" ? await decryptData(raw) : raw;
    
    // Kunci token untuk lanjut ke langkah unduh
    const dKey = videoInfo.key || videoInfo.downloadKey || videoInfo.k;
    
    // 2. Eksekusi permintaan Convert ke CDN SaveTube
    const isAudio = format === "mp3";
    const dlRes = await axios.post(`https://${cdn}/download`, {
        downloadType: isAudio ? "audio" : "video",
        quality: isAudio ? "128" : String(format),
        key: dKey
    }, { headers: { "content-type": "application/json" }});

    return {
        url: dlRes.data?.data?.downloadUrl, // URL langsung ke file mp4/mp3
        cdn: cdn // Server yang dipakai
    };
}

// ==================== [ FUNGSI INTI TIKTOK DOWNLOADING ] ====================
async function downloadTikTokData(url) {
    try {
        const reqUrl = `${NEXRAY.BASE_URL}${NEXRAY.ENDPOINTS.DOWNLOAD}?url=${encodeURIComponent(url)}`;
        const response = await axios.get(reqUrl, { timeout: 20000 });
        
        if (response.data?.status) {
            const data = response.data.result;
            return {
                success: true,
                data: {
                    id: data.id, // ID Video TikTok
                    username: data.author?.username || '-', // Username akun
                    description: data.title || '-', // Caption / Title Video
                    duration: data.duration || '-', // Durasi video
                    stats: {
                        likes: data.stats?.likes || '0', // Jumlah like
                        comments: data.stats?.comment || '0', // Jumlah komentar
                        shares: data.stats?.share || '0', // Jumlah share
                        views: data.stats?.views || '0' // Jumlah tayangan
                    },
                    video_url: data.data || null, // Link video standar tanpa watermark
                    video_hd: data.hd || null, // Link video kualitas HD
                    video_watermark: data.watermark || null, // Link video dengan watermark
                    audio_url: data.music_info?.url || null, // Link audio/musik latar
                    thumbnail: data.cover || null, // Gambar cover video
                    slides: data.slides || [] // Kumpulan gambar (jika tipe konten adalah slideshow/foto)
                }
            };
        }
        return { success: false, error: "Gagal memproses data TikTok." };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// ==================== [ KONFIGURASI ROUTING EXPRESS (ENDPOINTS) ] ====================

app.get("/", (req, res) => {
    jsonResponse(res, 200, {
        status: true,
        creator: CREATOR_NAME,
        message: "Media Downloader API",
        endpoints: {
            youtube: {
                audio: "/api/v1/youtube/audio?url=YOUTUBE_URL",
                video: "/api/v1/youtube/video?url=YOUTUBE_URL&resolusi=720",
                play_mp3: "/api/v1/youtube/youtube-play-mp3?query=SEARCH_QUERY"
            },
            tiktok: {
                audio_video: "/api/v1/tiktok/tiktok-audio-video?url=TIKTOK_URL",
                video: "/api/v1/tiktok/video?url=TIKTOK_URL",
                audio: "/api/v1/tiktok/audio?url=TIKTOK_URL"
            }
        }
    });
});

// ========== [ ENDPOINT YOUTUBE AUDIO (METADATA + DOWNLOAD) ] ==========
app.get("/api/v1/youtube/audio", async (req, res) => {
    const start = Date.now();
    try {
        const { url } = req.query;
        if (!url) throw new Error("Parameter 'url' diperlukan");
        
        const videoId = extractYoutubeId(url);
        if (!videoId) throw new Error("URL Youtube tidak valid");

        // Optimasi: Menarik Metadata dan link unduhan secara bersamaan (paralel)
        const [metadata, download] = await Promise.all([
            getCustomYouTubeMetadata(videoId),
            downloadFromSavetube(url, "mp3")
        ]);
        
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                metadata: metadata, // Elemen detail video
                download: {
                    audio_url: download.url, // Link MP3 siap didownload klien
                    format: "mp3",
                    cdn_used: download.cdn // Informasi server yg merespons
                }
            },
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, { status: false, error: error.message });
    }
});

// ========== [ ENDPOINT YOUTUBE VIDEO (METADATA + DOWNLOAD) ] ==========
app.get("/api/v1/youtube/video", async (req, res) => {
    const start = Date.now();
    try {
        const { url, resolusi = "720" } = req.query;
        if (!url) throw new Error("Parameter 'url' diperlukan");
        
        const videoId = extractYoutubeId(url);
        if (!videoId) throw new Error("URL Youtube tidak valid");

        // Optimasi: Menarik Metadata dan link unduhan secara bersamaan (paralel)
        const [metadata, download] = await Promise.all([
            getCustomYouTubeMetadata(videoId),
            downloadFromSavetube(url, resolusi)
        ]);
        
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                metadata: metadata, // Elemen detail video
                download: {
                    video_url: download.url, // Link MP4 siap didownload klien
                    quality: resolusi + "p", // Kualitas terpilih (default: 720p)
                    format: "mp4",
                    cdn_used: download.cdn
                }
            },
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, { status: false, error: error.message });
    }
});

// ========== [ ENDPOINT YOUTUBE PLAY MP3 (PENCARIAN + METADATA + DOWNLOAD) ] ==========
app.get("/api/v1/youtube/youtube-play-mp3", async (req, res) => {
    const start = Date.now();
    try {
        const { query } = req.query;
        if (!query) throw new Error("Parameter 'query' pencarian diperlukan");

        // 1. Eksekusi pencarian keyword YouTube
        const search = await yts(query);
        if (!search.videos || search.videos.length === 0) throw new Error("Video tidak ditemukan");
        const video = search.videos[0]; // Ambil hasil paling atas (ranking 1)

        // 2. Eksekusi paralel: Ambil Metadata Ekstra (Mattw Proxy) & Extract SaveTube MP3
        const [customMetadata, downloadResult] = await Promise.all([
            getCustomYouTubeMetadata(video.videoId),
            downloadFromSavetube(video.url, "mp3")
        ]);

        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                query_search: query, // Kata kunci yang dicari user
                metadata: customMetadata || { // Fallback jika proxy error
                    video_id: video.videoId,
                    title: video.title,
                    channel_info: { name: video.author.name },
                    views: video.views
                },
                download: {
                    audio_url: downloadResult.url, // Link file audio 
                    format: "mp3",
                    quality: "128kbps"
                }
            },
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, { status: false, error: error.message });
    }
});


// ==================== [ TIKTOK ENDPOINTS ] ====================

// ========== [ ENDPOINT TIKTOK ALL-IN-ONE (RESTORED) ] ==========
app.get("/api/v1/tiktok/tiktok-audio-video", async (req, res) => {
    const start = Date.now();
    try {
        const { url } = req.query;
        if (!url) throw new Error("Parameter 'url' diperlukan");

        const result = await downloadTikTokData(url);
        if (!result.success) throw new Error(result.error);

        const data = result.data;
        const isSlideshow = data.slides && data.slides.length > 0;

        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                metadata: {
                    id: data.id, // ID Konten TikTok
                    username: data.username, // Pemilik akun TikTok
                    description: data.description, // Caption 
                    duration: data.duration, // Durasi konten
                    stats: data.stats // Views, likes, comments, shares
                },
                media: {
                    is_slideshow: isSlideshow, // Boolean untuk mendeteksi mode foto geser
                    video: data.video_url ? { 
                        url_standard: data.video_url, 
                        url_hd: data.video_hd, 
                        url_watermark: data.video_watermark 
                    } : null,
                    audio: data.audio_url ? { url: data.audio_url } : null, // Suara latar / musik TikTok
                    thumbnail: data.thumbnail, // Gambar pratinjau
                    slides: data.slides // Array gambar jika konten berupa slideshow foto
                }
            },
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, { status: false, error: error.message });
    }
});

// ========== [ ENDPOINT TIKTOK VIDEO ONLY ] ==========
app.get("/api/v1/tiktok/video", async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) throw new Error("Parameter 'url' dibutuhkan");
        
        const result = await downloadTikTokData(url);
        if(!result.success) throw new Error(result.error);
        
        const data = result.data;
        // Prioritaskan kualitas HD jika ada, jika tidak pakai standar
        const videoTarget = data.video_hd || data.video_url; 
        
        if (!videoTarget) throw new Error("URL Video tidak ditemukan (Mungkin ini slideshow foto)");

        jsonResponse(res, 200, { 
            status: true, 
            creator: CREATOR_NAME,
            result: { 
                username: data.username,
                description: data.description,
                video_url: videoTarget, // Hasil akhir link video
                is_hd: !!data.video_hd // Indikator boolean HD
            } 
        });
    } catch (error) {
        jsonResponse(res, 500, { status: false, error: error.message });
    }
});

// ========== [ ENDPOINT TIKTOK AUDIO ONLY ] ==========
app.get("/api/v1/tiktok/audio", async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) throw new Error("Parameter 'url' dibutuhkan");
        
        const result = await downloadTikTokData(url);
        if(!result.success || !result.data.audio_url) throw new Error("Audio TikTok tidak ditemukan pada link tersebut");
        
        jsonResponse(res, 200, { 
            status: true, 
            creator: CREATOR_NAME,
            result: { 
                username: result.data.username,
                audio_url: result.data.audio_url // Hasil akhir link audio (MP3)
            } 
        });
    } catch (error) {
        jsonResponse(res, 500, { status: false, error: error.message });
    }
});

module.exports = app;
