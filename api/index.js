const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");

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
const TIKWM_API = "https://tikwm.com/api";
const TIKTOK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
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

// ========== [ FUNGSI EKSTRAK URL TIKTOK ] ==========
function extractTikTokUrl(url) {
    if (!url) return null;

    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/(?:@[\w.-]+\/video\/(\d+)|v\/(\d+)|t\/([\w]+))/,
        /(?:https?:\/\/)?(?:www\.)?tiktoklite\.com\/(?:@[\w.-]+\/video\/(\d+)|v\/(\d+)|t\/([\w]+))/,
        /(?:https?:\/\/)?(?:vm\.tiktok\.com\/([\w]+))/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            const videoId = match[1] || match[2] || match[3];
            if (videoId) {
                return {
                    original: url,
                    videoId: videoId,
                    platform: url.includes("tiktoklite.com") ? "lite" : "standard"
                };
            }
        }
    }

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

// ========== [ FUNGSI DOWNLOAD TIKTOK DARI TIKWM ] ==========
async function downloadFromTikWM(url) {
    try {
        const response = await axios.post(
            TIKWM_API,
            `url=${encodeURIComponent(url)}&count=12&cursor=0&web=1&hd=1`,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    ...TIKTOK_HEADERS
                },
                timeout: 30000
            }
        );

        if (!response.data || response.data.code !== 0) {
            throw new Error(response.data?.msg || "Gagal mendapatkan data dari TikWM");
        }

        const data = response.data.data;

        return {
            id: data.id,
            title: data.title,
            description: data.title,
            duration: data.duration,
            create_time: data.create_time,
            cover: data.cover,
            origin_cover: data.origin_cover,
            play: data.play,
            wmplay: data.wmplay,
            hdplay: data.hdplay,
            music: data.music,
            author: {
                id: data.author?.id,
                unique_id: data.author?.unique_id,
                nickname: data.author?.nickname,
                avatar: data.author?.avatar,
                signature: data.author?.signature,
                verified: data.author?.verified
            },
            stats: {
                play_count: data.play_count,
                digg_count: data.digg_count,
                comment_count: data.comment_count,
                share_count: data.share_count
            }
        };
    } catch (error) {
        throw new Error(`Gagal download dari TikWM: ${error.message}`);
    }
}

// ========== [ FUNGSI SEARCH TIKTOK ] ==========
async function searchTikTok(query, count = 20) {
    try {
        const response = await axios.post(
            TIKWM_API,
            `query=${encodeURIComponent(query)}&count=${count}&cursor=0&type=0`,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    ...TIKTOK_HEADERS
                },
                timeout: 30000
            }
        );

        if (!response.data || response.data.code !== 0) {
            throw new Error(response.data?.msg || "Gagal melakukan pencarian");
        }

        const videos = response.data.data?.videos || [];

        return {
            query: query,
            count: videos.length,
            videos: videos.map(video => ({
                id: video.id,
                title: video.title,
                duration: video.duration,
                play_count: video.play_count,
                digg_count: video.digg_count,
                comment_count: video.comment_count,
                share_count: video.share_count,
                create_time: video.create_time,
                cover: video.cover,
                origin_cover: video.origin_cover,
                play: video.play,
                wmplay: video.wmplay,
                hdplay: video.hdplay,
                music: video.music,
                author: {
                    unique_id: video.author?.unique_id,
                    nickname: video.author?.nickname,
                    avatar: video.author?.avatar
                }
            }))
        };
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
                playmp3: "/api/v1/youtube/ytplaymp3?query=SEARCH_QUERY",
                cdn_status: "/api/v1/youtube/cdn-status"
            },
            tiktok: {
                mp3: "/FebryJW/api/v1/tiktok/tiktok-mp3?url=TIKTOK_URL",
                mp4: "/FebryJW/api/v1/tiktok/tiktok-mp4?url=TIKTOK_URL",
                nowm: "/FebryJW/api/v1/tiktok/tiktok-nowm?url=TIKTOK_URL",
                search: "/FebryJW/api/v1/tiktok/tiktok-search?query=QUERY",
                search_mp3: "/FebryJW/api/v1/tiktok/tiktok-search-mp3?query=QUERY",
                search_mp4: "/FebryJW/api/v1/tiktok/tiktok-search-mp4?query=QUERY",
                full: "/FebryJW/api/v1/tiktok/tiktok-mp3-mp4?url=TIKTOK_URL"
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

// ========== [ ENDPOINT CEK STATUS CDN ] ==========
app.get("/api/v1/youtube/cdn-status", async (req, res) => {
    const start = Date.now();

    try {
        const randomSamples = [];

        for (let i = 0; i < 3; i++) {
            try {
                const cdn = await getRandomCDN();
                randomSamples.push({
                    index: i + 1,
                    cdn: cdn
                });
            } catch (e) {
                randomSamples.push({
                    index: i + 1,
                    error: e.message
                });
            }
        }

        jsonResponse(res, 200, {
            status: true,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            random_cdn_source: RANDOM_CDN_API,
            samples: randomSamples,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, {
            status: false,
            creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ==================== [ TIKTOK ENDPOINTS ] ====================

// ========== [ ENDPOINT TIKTOK MP3 (AUDIO ONLY) ] ==========
app.get("/FebryJW/api/v1/tiktok/tiktok-mp3", async (req, res) => {
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

        const parsedUrl = extractTikTokUrl(url);
        if (!parsedUrl) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "FebryJW 🚀",
                error: "URL TikTok tidak valid",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadFromTikWM(url);

        jsonResponse(res, 200, {
            status: true,
            creator: "FebryJW 🚀",
            result: {
                id: result.id,
                title: result.title,
                duration: result.duration,
                audio_url: result.music,
                thumbnail: result.cover,
                author: result.author,
                platform: parsedUrl.platform
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok MP3 Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: "FebryJW 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT TIKTOK MP4 (VIDEO WITH WATERMARK) ] ==========
app.get("/FebryJW/api/v1/tiktok/tiktok-mp4", async (req, res) => {
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

        const parsedUrl = extractTikTokUrl(url);
        if (!parsedUrl) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "FebryJW 🚀",
                error: "URL TikTok tidak valid",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadFromTikWM(url);

        let videoUrl = result.play;
        let videoQuality = "Standard";

        if (result.hdplay && result.hdplay !== "") {
            videoUrl = result.hdplay;
            videoQuality = "HD";
        }

        jsonResponse(res, 200, {
            status: true,
            creator: "FebryJW 🚀",
            result: {
                id: result.id,
                title: result.title,
                description: result.description,
                duration: result.duration,
                video_url: videoUrl,
                video_quality: videoQuality,
                thumbnail: result.origin_cover,
                author: result.author,
                stats: result.stats,
                platform: parsedUrl.platform
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok MP4 Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: "FebryJW 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT TIKTOK NO WATERMARK (WITHOUT WATERMARK) ] ==========
app.get("/FebryJW/api/v1/tiktok/tiktok-nowm", async (req, res) => {
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

        const parsedUrl = extractTikTokUrl(url);
        if (!parsedUrl) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "FebryJW 🚀",
                error: "URL TikTok tidak valid",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadFromTikWM(url);

        jsonResponse(res, 200, {
            status: true,
            creator: "FebryJW 🚀",
            result: {
                id: result.id,
                title: result.title,
                description: result.description,
                duration: result.duration,
                video_url: result.play,
                video_hd: result.hdplay || null,
                thumbnail: result.origin_cover,
                author: result.author,
                stats: result.stats,
                platform: parsedUrl.platform
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok NoWM Error:", error.message);
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
app.get("/FebryJW/api/v1/tiktok/tiktok-search", async (req, res) => {
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

// ========== [ ENDPOINT TIKTOK SEARCH MP3 ] ==========
app.get("/FebryJW/api/v1/tiktok/tiktok-search-mp3", async (req, res) => {
    const start = Date.now();

    try {
        const { query, count = 10 } = req.query;

        if (!query) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "FebryJW 🚀",
                error: "Parameter 'query' diperlukan",
                timestamp: new Date().toISOString()
            });
        }

        const searchResult = await searchTikTok(query, parseInt(count));

        const audioResults = searchResult.videos.map(video => ({
            id: video.id,
            title: video.title,
            duration: video.duration,
            audio_url: video.music || null,
            thumbnail: video.cover,
            author: video.author,
            play_count: video.play_count
        }));

        jsonResponse(res, 200, {
            status: true,
            creator: "FebryJW 🚀",
            result: {
                query: query,
                count: audioResults.length,
                audios: audioResults
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok Search MP3 Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: "FebryJW 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT TIKTOK SEARCH MP4 ] ==========
app.get("/FebryJW/api/v1/tiktok/tiktok-search-mp4", async (req, res) => {
    const start = Date.now();

    try {
        const { query, count = 10 } = req.query;

        if (!query) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "FebryJW 🚀",
                error: "Parameter 'query' diperlukan",
                timestamp: new Date().toISOString()
            });
        }

        const searchResult = await searchTikTok(query, parseInt(count));

        const videoResults = searchResult.videos.map(video => {
            let videoUrl = video.play;
            let videoQuality = "Standard";

            if (video.hdplay && video.hdplay !== "") {
                videoUrl = video.hdplay;
                videoQuality = "HD";
            }

            return {
                id: video.id,
                title: video.title,
                duration: video.duration,
                video_url: videoUrl,
                video_quality: videoQuality,
                video_wm: video.wmplay,
                thumbnail: video.origin_cover,
                author: video.author,
                stats: {
                    plays: video.play_count,
                    likes: video.digg_count,
                    comments: video.comment_count,
                    shares: video.share_count
                }
            };
        });

        jsonResponse(res, 200, {
            status: true,
            creator: "FebryJW 🚀",
            result: {
                query: query,
                count: videoResults.length,
                videos: videoResults
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok Search MP4 Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: "FebryJW 🚀",
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT TIKTOK MP3 & MP4 (VIDEO + AUDIO) ] ==========
app.get("/FebryJW/api/v1/tiktok/tiktok-mp3-mp4", async (req, res) => {
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

        const parsedUrl = extractTikTokUrl(url);
        if (!parsedUrl) {
            return jsonResponse(res, 400, {
                status: false,
                creator: "FebryJW 🚀",
                error: "URL TikTok tidak valid",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadFromTikWM(url);

        let videoUrl = result.play;
        let videoQuality = "Standard";

        if (result.hdplay && result.hdplay !== "") {
            videoUrl = result.hdplay;
            videoQuality = "HD";
        }

        jsonResponse(res, 200, {
            status: true,
            creator: "FebryJW 🚀",
            result: {
                id: result.id,
                title: result.title,
                description: result.description,
                duration: result.duration,
                create_time: result.create_time,
                thumbnail: result.origin_cover,
                media: {
                    video: {
                        with_watermark: result.wmplay,
                        no_watermark: result.play,
                        hd: result.hdplay,
                        best: {
                            url: videoUrl,
                            quality: videoQuality
                        }
                    },
                    audio: {
                        url: result.music,
                        title: result.title,
                        duration: result.duration
                    }
                },
                author: result.author,
                stats: result.stats,
                platform: parsedUrl.platform
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok MP3 MP4 Error:", error.message);
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