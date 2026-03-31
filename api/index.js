const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");
const cheerio = require("cheerio");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== [ KONSTANTA SAVE TUBE ] ==========
const SAVE_TUBE_KEY = "C5D58EF67A7584E4A29F6C35BBC4EB12";
const SAVE_TUBE_ORIGIN = "https://save-tube.com";
const SAVE_TUBE_REFERER = "https://save-tube.com/";
const RANDOM_CDN_API = "https://media.savetube.vip/api/random-cdn";

const SAVE_TUBE_HEADERS = {
    "content-type": "application/json",
    origin: SAVE_TUBE_ORIGIN,
    referer: SAVE_TUBE_REFERER,
    "user-agent": "Mozilla/5.0 (Android 10; Mobile; rv:148.0) Gecko/148.0 Firefox/148.0"
};

const FORMATS = ["144", "240", "360", "480", "720", "1080", "mp3"];

// ========== [ KONSTANTA TIKTOK ] ==========
const NEXRAY_API = "https://api.nexray.web.id/downloader/tiktok";
const SAVETT_URL = "https://savett.cc/en1/download";
const SAVETT_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Origin': 'https://savett.cc',
    'Referer': 'https://savett.cc/en1/download',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) Chrome/139.0.0.0 Mobile Safari/537.36'
};

// ========== [ FUNGSI UNTUK RESPON JSON YANG RAPI ] ==========
function jsonResponse(res, statusCode, data) {
    res.setHeader("Content-Type", "application/json");
    res.status(statusCode).send(JSON.stringify(data, null, 2));
}

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
        if (match && match[1]) return match[1];
    }

    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
            if (urlObj.hostname.includes("youtu.be")) {
                const id = urlObj.pathname.slice(1);
                return id.length === 11 ? id : null;
            }
            const v = urlObj.searchParams.get("v");
            if (v && v.length === 11) return v;
        }
    } catch (e) {}

    return null;
}

// ========== [ FUNGSI DECRYPT ] ==========
async function decryptData(enc) {
    try {
        const sr = Buffer.from(enc, "base64");
        const key = Buffer.from(SAVE_TUBE_KEY, "hex");
        const iv = sr.slice(0, 16);
        const data = sr.slice(16);
        const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        return JSON.parse(decrypted.toString());
    } catch (e) {
        throw new Error(`Gagal decrypt data: ${e.message}`);
    }
}

// ========== [ RANDOM CDN DARI API RESMI ] ==========
async function getRandomCDN() {
    try {
        const response = await axios.get(RANDOM_CDN_API, {
            timeout: 10000,
            headers: {
                "accept": "application/json",
                "user-agent": SAVE_TUBE_HEADERS["user-agent"]
            }
        });

        const cdn = response.data?.cdn;
        if (!cdn) throw new Error("Response random CDN tidak valid");
        return cdn;
    } catch (error) {
        throw new Error(`Gagal ambil random CDN: ${error.message}`);
    }
}

// ========== [ NORMALISASI RESPON INFO ] ==========
async function normalizeInfoPayload(payload) {
    if (!payload) {
        throw new Error("Payload info kosong");
    }

    if (typeof payload === "string") {
        return await decryptData(payload);
    }

    if (typeof payload === "object") {
        return payload;
    }

    throw new Error("Format payload info tidak dikenali");
}

// ========== [ FUNGSI DAPATKAN INFO VIDEO ] ==========
async function getVideoInfo(cdn, youtubeId) {
    const response = await axios.post(
        `https://${cdn}/v2/info`,
        {
            url: `https://www.youtube.com/watch?v=${youtubeId}`
        },
        {
            headers: SAVE_TUBE_HEADERS,
            timeout: 20000
        }
    );

    const raw = response.data?.data;
    const info = await normalizeInfoPayload(raw);

    if (!info) throw new Error("Info video gagal diproses");
    return info;
}

// ========== [ FUNGSI REQUEST DOWNLOAD ] ==========
async function requestDownload(cdn, format, videoInfo) {
    const isAudio = format === "mp3";
    const quality = isAudio ? "128" : String(format);

    const key = videoInfo.key || videoInfo.downloadKey || videoInfo.k;
    if (!key) {
        throw new Error("Key convert tidak ditemukan dari info video");
    }

    const response = await axios.post(
        `https://${cdn}/download`,
        {
            downloadType: isAudio ? "audio" : "video",
            quality: quality,
            key: key
        },
        {
            headers: {
                "content-type": "application/json"
            },
            timeout: 25000
        }
    );

    const downloadUrl = response.data?.data?.downloadUrl;
    if (!downloadUrl) {
        throw new Error("downloadUrl tidak ditemukan di response download");
    }

    return downloadUrl;
}

// ========== [ FUNGSI UTAMA DOWNLOAD YOUTUBE ] ==========
async function downloadFromSavetube(url, format = "mp3", attempt = 0, maxAttempt = 5) {
    const id = extractYoutubeId(url);
    if (!id) {
        throw new Error("Gagal mengekstrak ID YouTube dari URL");
    }

    if (!FORMATS.includes(format)) {
        throw new Error(`Format tidak tersedia. Pilih: ${FORMATS.join(", ")}`);
    }

    const cdn = await getRandomCDN();

    try {
        const videoInfo = await getVideoInfo(cdn, id);
        const downloadUrl = await requestDownload(cdn, format, videoInfo);

        return {
            title: videoInfo.title || videoInfo.name || "Unknown Title",
            format: format,
            thumbnail: videoInfo.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            duration: videoInfo.duration || videoInfo.length || null,
            url: downloadUrl,
            cdn: cdn
        };
    } catch (error) {
        console.error(`Gagal dengan random CDN ${cdn}: ${error.message}`);

        if (attempt < maxAttempt - 1) {
            return downloadFromSavetube(url, format, attempt + 1, maxAttempt);
        }

        throw new Error(`Gagal convert dari SaveTube setelah beberapa percobaan: ${error.message}`);
    }
}

// ========== [ FUNGSI TIKTOK DARI NEXRAY API ] ==========
async function getTikTokFromNexRay(url) {
    try {
        const response = await axios.get(`${NEXRAY_API}?url=${encodeURIComponent(url)}`, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (response.data?.status) {
            return {
                success: true,
                data: response.data.result,
                source: 'nexray'
            };
        }
        return { success: false, error: 'NexRay API gagal' };
    } catch (error) {
        console.error('NexRay API error:', error.message);
        return { success: false, error: error.message };
    }
}

// ========== [ FUNGSI TIKTOK DARI SAVETT (SCRAPE) ] ==========
async function getTikTokFromSaveTT(url) {
    try {
        // Ambil halaman utama untuk mendapatkan CSRF token dan cookie
        const page = await axios.get(SAVETT_URL, {
            headers: SAVETT_HEADERS
        });

        const csrf = page.data.match(/name="csrf_token" value="([^"]+)"/)?.[1];
        const cookie = page.headers['set-cookie']?.map(v => v.split(';')[0]).join('; ');

        if (!csrf) {
            throw new Error('CSRF token tidak ditemukan');
        }

        // Kirim request download
        const post = await axios.post(
            SAVETT_URL,
            `csrf_token=${encodeURIComponent(csrf)}&url=${encodeURIComponent(url)}`,
            {
                headers: {
                    ...SAVETT_HEADERS,
                    Cookie: cookie || ''
                },
                timeout: 30000
            }
        );

        const $ = cheerio.load(post.data);

        // Ekstrak data
        const username = $('#video-info h3').first().text().trim() || '-';
        const desc = $('.desc-video').first().text().trim() || '-';
        
        // Ekstrak stats
        const stats = {};
        $('.info-download li').each((_, el) => {
            const text = $(el).text().toLowerCase();
            if (text.includes('like')) stats.likes = text.match(/\d+/)?.[0] || '0';
            if (text.includes('comment')) stats.comments = text.match(/\d+/)?.[0] || '0';
            if (text.includes('share')) stats.shares = text.match(/\d+/)?.[0] || '0';
            if (text.includes('view')) stats.views = text.match(/\d+/)?.[0] || '0';
        });

        // Ekstrak video dan audio
        let mp4Urls = [];
        let mp3Urls = [];
        let slides = [];

        // Cek slideshow
        $('.carousel-item[data-data]').each((_, el) => {
            try {
                const json = JSON.parse($(el).attr('data-data').replace(/&quot;/g, '"'));
                json.URL?.forEach(u => slides.push(u));
            } catch (e) {}
        });

        // Ekstrak format
        $('#formatselect option').each((_, el) => {
            const label = $(el).text().toLowerCase();
            const raw = $(el).attr('value');
            if (!raw) return;

            try {
                const json = JSON.parse(raw.replace(/&quot;/g, '"'));
                if (label.includes('mp4') && !label.includes('watermark')) {
                    mp4Urls.push(...json.URL);
                }
                if (label.includes('mp3')) {
                    mp3Urls.push(...json.URL);
                }
            } catch (e) {}
        });

        // Ambil durasi
        const duration = $('#duration').text().trim() || '-';

        return {
            success: true,
            source: 'savett',
            data: {
                username: username,
                description: desc,
                duration: duration,
                stats: {
                    likes: stats.likes || '0',
                    comments: stats.comments || '0',
                    shares: stats.shares || '0',
                    views: stats.views || '0'
                },
                video_url: mp4Urls[0] || null,
                video_hd: mp4Urls[1] || null,
                audio_url: mp3Urls[0] || null,
                thumbnail: $('img.thumbnail').attr('src') || null,
                slides: slides
            }
        };
    } catch (error) {
        console.error('SaveTT error:', error.message);
        return { success: false, error: error.message };
    }
}

// ========== [ FUNGSI UTAMA TIKTOK (GABUNGAN) ] ==========
async function downloadTikTok(url) {
    // Coba dari NexRay API dulu
    const nexray = await getTikTokFromNexRay(url);
    
    if (nexray.success && nexray.data) {
        const data = nexray.data;
        return {
            success: true,
            source: 'nexray',
            data: {
                id: data.id,
                username: data.author?.fullname || data.author?.username || '-',
                nickname: data.author?.username || '-',
                description: data.title || '-',
                duration: data.duration || '-',
                stats: {
                    likes: data.stats?.likes || '0',
                    comments: data.stats?.comment || '0',
                    shares: data.stats?.share || '0',
                    views: data.stats?.views || '0'
                },
                video_url: data.data || null,
                video_hd: data.hd || null,
                video_watermark: data.watermark || null,
                audio_url: data.music_info?.url || null,
                thumbnail: data.thumbnail || data.cover || null,
                slides: []
            }
        };
    }

    // Jika NexRay gagal, coba dari SaveTT
    const savett = await getTikTokFromSaveTT(url);
    
    if (savett.success) {
        return savett;
    }

    throw new Error('Gagal mengambil data TikTok dari semua sumber');
}

// ========== [ FUNGSI SEARCH TIKTOK ] ==========
async function searchTikTok(query, count = 20) {
    // Untuk search, menggunakan API alternatif
    try {
        const response = await axios.get(`https://api.nexray.web.id/search/tiktok?query=${encodeURIComponent(query)}&count=${count}`, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (response.data?.status) {
            return {
                success: true,
                query: query,
                count: response.data.result?.length || 0,
                videos: response.data.result?.map(video => ({
                    id: video.id,
                    title: video.title,
                    duration: video.duration,
                    play_count: video.play_count,
                    digg_count: video.digg_count,
                    comment_count: video.comment_count,
                    share_count: video.share_count,
                    thumbnail: video.cover,
                    author: {
                        unique_id: video.author?.unique_id,
                        nickname: video.author?.nickname,
                        avatar: video.author?.avatar
                    }
                })) || []
            };
        }
        throw new Error('Search API gagal');
    } catch (error) {
        throw new Error(`Gagal search TikTok: ${error.message}`);
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
    jsonResponse(res, 200, {
        status: true,
        creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
        message: "YouTube & TikTok Downloader API",
        random_cdn_source: RANDOM_CDN_API,
        endpoints: {
            youtube: {
                audio: "/api/v1/youtube/audio?url=YOUTUBE_URL",
                video: "/api/v1/youtube/video?url=YOUTUBE_URL&resolusi=720",
                playmp3: "/api/v1/youtube/ytplaymp3?query=SEARCH_QUERY"
            },
            tiktok: {
                download: "/FebryJW/api/v1/tiktok/download?url=TIKTOK_URL",
                audio: "/FebryJW/api/v1/tiktok/audio?url=TIKTOK_URL",
                video: "/FebryJW/api/v1/tiktok/video?url=TIKTOK_URL",
                search: "/FebryJW/api/v1/tiktok/search?query=QUERY&count=20"
            }
        },
        timestamp: new Date().toISOString()
    });
});

// ==================== [ YOUTUBE ENDPOINTS ] ====================

// ========== [ ENDPOINT YOUTUBE AUDIO ] ==========
app.get("/api/v1/youtube/audio", async (req, res) => {
    const start = Date.now();

    try {
        const { url } = req.query;

        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        const result = await downloadFromSavetube(url, "mp3");

        jsonResponse(res, 200, {
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

        jsonResponse(res, 500, {
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT YOUTUBE VIDEO ] ==========
app.get("/api/v1/youtube/video", async (req, res) => {
    const start = Date.now();

    try {
        const { url, resolusi = "720" } = req.query;

        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        const result = await downloadFromSavetube(url, resolusi);

        jsonResponse(res, 200, {
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

        jsonResponse(res, 500, {
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT YOUTUBE PLAY MP3 ] ==========
app.get("/api/v1/youtube/ytplaymp3", async (req, res) => {
    const start = Date.now();

    try {
        const { query } = req.query;

        if (!query) {
            return jsonResponse(res, 400, {
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

        jsonResponse(res, 200, {
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

        jsonResponse(res, 500, {
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ==================== [ TIKTOK ENDPOINTS ] ====================

// ========== [ ENDPOINT TIKTOK DOWNLOAD (VIDEO + AUDIO LENGKAP) ] ==========
app.get("/FebryJW/api/v1/tiktok/download", async (req, res) => {
    const start = Date.now();

    try {
        const { url } = req.query;

        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "FebryJW 🚀",
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadTikTok(url);

        jsonResponse(res, 200, {
            status: true,
            creator: "FebryJW 🚀",
            source: result.source,
            result: {
                id: result.data.id,
                username: result.data.username,
                nickname: result.data.nickname,
                description: result.data.description,
                duration: result.data.duration,
                stats: result.data.stats,
                video: {
                    no_watermark: result.data.video_url,
                    with_watermark: result.data.video_watermark,
                    hd: result.data.video_hd
                },
                audio: result.data.audio_url,
                thumbnail: result.data.thumbnail,
                is_slideshow: result.data.slides?.length > 0,
                slides: result.data.slides || []
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok Download Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: "FebryJW 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT TIKTOK VIDEO (MP4) ] ==========
app.get("/FebryJW/api/v1/tiktok/video", async (req, res) => {
    const start = Date.now();

    try {
        const { url, hd = "false" } = req.query;

        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "FebryJW 🚀",
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadTikTok(url);
        
        // Pilih video berdasarkan parameter hd
        let videoUrl = result.data.video_url;
        let videoQuality = "Standard";
        
        if (hd === "true" && result.data.video_hd) {
            videoUrl = result.data.video_hd;
            videoQuality = "HD";
        }

        if (!videoUrl && result.data.slides?.length > 0) {
            return jsonResponse(res, 200, {
                status: true,
                creator: "FebryJW 🚀",
                type: "slideshow",
                result: {
                    username: result.data.username,
                    description: result.data.description,
                    slides: result.data.slides,
                    audio: result.data.audio
                },
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        if (!videoUrl) {
            throw new Error("Video tidak ditemukan");
        }

        jsonResponse(res, 200, {
            status: true,
            creator: "FebryJW 🚀",
            result: {
                title: result.data.description?.substring(0, 100) || "TikTok Video",
                username: result.data.username,
                duration: result.data.duration,
                video_url: videoUrl,
                video_quality: videoQuality,
                thumbnail: result.data.thumbnail,
                stats: result.data.stats
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok Video Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: "FebryJW 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT TIKTOK AUDIO (MP3) ] ==========
app.get("/FebryJW/api/v1/tiktok/audio", async (req, res) => {
    const start = Date.now();

    try {
        const { url } = req.query;

        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "FebryJW 🚀",
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadTikTok(url);

        if (!result.data.audio_url) {
            throw new Error("Audio tidak ditemukan untuk video ini");
        }

        jsonResponse(res, 200, {
            status: true,
            creator: "FebryJW 🚀",
            result: {
                title: result.data.description?.substring(0, 100) || "TikTok Audio",
                username: result.data.username,
                duration: result.data.duration,
                audio_url: result.data.audio_url,
                thumbnail: result.data.thumbnail
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok Audio Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: "FebryJW 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT TIKTOK SEARCH ] ==========
app.get("/FebryJW/api/v1/tiktok/search", async (req, res) => {
    const start = Date.now();

    try {
        const { query, count = 20 } = req.query;

        if (!query) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "FebryJW 🚀",
                error: "Parameter 'query' diperlukan",
                timestamp: new Date().toISOString()
            });
        }

        const result = await searchTikTok(query, parseInt(count));

        jsonResponse(res, 200, {
            status: true,
            creator: "FebryJW 🚀",
            result: result,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok Search Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: "FebryJW 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

module.exports = app;