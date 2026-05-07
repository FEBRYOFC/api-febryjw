const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const yts = require("yt-search");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== [ KONSTANTA UMUM ] ====================
const CREATOR_NAME = "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀";
const RANDOM_CDN_API = "https://media.savetube.vip/api/random-cdn";

// ==================== [ KONSTANTA YOUTUBE METADATA PROXY ] ====================
const YT_PROXY_API = "https://ytapi.apps.mattw.io/v3";
const YT_PROXY_KEY = "foo1";

// ==================== [ KONSTANTA SAVE TUBE (YOUTUBE) ] ====================
const SAVE_TUBE = {
    KEY: "C5D58EF67A7584E4A29F6C35BBC4EB12",
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

// ==================== [ FUNGSI FETCH WRAPPER ] ====================
async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
}

// ==================== [ FUNGSI UTILITAS ] ====================
function jsonResponse(res, statusCode, data) {
    res.setHeader("Content-Type", "application/json");
    res.status(statusCode).send(JSON.stringify(data, null, 2));
}

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

// ==================== [ FUNGSI PARSING DURASI ISO ] ====================
function parseDuration(isoDuration) {
    if (!isoDuration) return null;
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return null;
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
}

// ==================== [ FUNGSI METADATA DARI MATTHEW API ] ====================
async function getMetadataFromMatthew(videoId) {
    try {
        const url = `${YT_PROXY_API}/videos?key=${YT_PROXY_KEY}&part=snippet,statistics,contentDetails&id=${videoId}`;
        const data = await fetchJson(url);
        
        if (data && data.items && data.items.length > 0) {
            const item = data.items[0];
            return {
                video_id: item.id,
                title: item.snippet.title,
                description: item.snippet.description,
                published_at: item.snippet.publishedAt,
                channel_info: {
                    id: item.snippet.channelId,
                    name: item.snippet.channelTitle,
                    url: `https://youtube.com/channel/${item.snippet.channelId}`
                },
                statistics: {
                    views: item.statistics.viewCount || "0",
                    likes: item.statistics.likeCount || "0",
                    comments: item.statistics.commentCount || "0"
                },
                duration_iso: item.contentDetails.duration,
                duration_seconds: parseDuration(item.contentDetails.duration),
                thumbnails: {
                    default: item.snippet.thumbnails.default?.url,
                    medium: item.snippet.thumbnails.medium?.url,
                    high: item.snippet.thumbnails.high?.url,
                    standard: item.snippet.thumbnails.standard?.url,
                    maxres: item.snippet.thumbnails.maxres?.url
                },
                url: `https://youtube.com/watch?v=${item.id}`
            };
        }
        return null;
    } catch (error) {
        console.error(`[Matthew Metadata Error] ID ${videoId}:`, error.message);
        return null;
    }
}

// ==================== [ FUNGSI SEARCH YOUTUBE ] ====================
async function searchYouTubeWithMetadata(query, limit = 20) {
    try {
        const searchResults = await yts(query);
        
        if (!searchResults.videos || searchResults.videos.length === 0) {
            return { success: true, query: query, total_results: 0, results: [] };
        }
        
        const limitedVideos = searchResults.videos.slice(0, limit);
        
        const resultsWithMetadata = await Promise.all(
            limitedVideos.map(async (video) => {
                const matthewMeta = await getMetadataFromMatthew(video.videoId);
                
                if (matthewMeta) {
                    return {
                        video_id: matthewMeta.video_id,
                        title: matthewMeta.title,
                        description: matthewMeta.description,
                        published_at: matthewMeta.published_at,
                        duration: {
                            seconds: matthewMeta.duration_seconds,
                            timestamp: video.duration?.timestamp || formatDuration(matthewMeta.duration_seconds)
                        },
                        channel_info: matthewMeta.channel_info,
                        statistics: matthewMeta.statistics,
                        thumbnails: matthewMeta.thumbnails,
                        url: matthewMeta.url
                    };
                } else {
                    return {
                        video_id: video.videoId,
                        title: video.title,
                        description: video.description || "",
                        published_at: video.ago || null,
                        duration: {
                            seconds: video.duration?.seconds || 0,
                            timestamp: video.duration?.timestamp || "0:00"
                        },
                        channel_info: {
                            id: video.author?.channelId || null,
                            name: video.author?.name || "Unknown",
                            url: video.author?.url || null
                        },
                        statistics: {
                            views: video.views || "0",
                            likes: null,
                            comments: null
                        },
                        thumbnails: {
                            default: video.thumbnail,
                            medium: video.thumbnail,
                            high: video.thumbnail,
                            standard: video.thumbnail,
                            maxres: video.thumbnail
                        },
                        url: video.url
                    };
                }
            })
        );
        
        return {
            success: true,
            query: query,
            total_results: searchResults.videos.length,
            limit: limit,
            results: resultsWithMetadata
        };
    } catch (error) {
        console.error("[Search Error]:", error.message);
        return { success: false, error: error.message };
    }
}

// ==================== [ FUNGSI FORMAT DURASI ] ====================
function formatDuration(seconds) {
    if (!seconds) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ==================== [ FUNGSI CUSTOM METADATA ] ====================
async function getCustomYouTubeMetadata(videoId) {
    return getMetadataFromMatthew(videoId);
}

// ==================== [ FUNGSI INTI YOUTUBE DOWNLOADING ] ====================
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
    const response = await fetch(RANDOM_CDN_API, { headers: SAVE_TUBE.HEADERS });
    const data = await response.json();
    return data?.cdn;
}

async function downloadFromSavetube(url, format = "mp3") {
    const id = extractYoutubeId(url);
    if (!id) throw new Error("Gagal mengekstrak ID YouTube");

    const cdn = await getRandomCDN();

    const infoRes = await fetch(`https://${cdn}/v2/info`, {
        method: "POST",
        headers: SAVE_TUBE.HEADERS,
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${id}` })
    });
    const infoData = await infoRes.json();
    
    const raw = infoData?.data;
    const videoInfo = typeof raw === "string" ? await decryptData(raw) : raw;
    const dKey = videoInfo.key || videoInfo.downloadKey || videoInfo.k;
    
    const isAudio = format === "mp3";
    const dlRes = await fetch(`https://${cdn}/download`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            downloadType: isAudio ? "audio" : "video",
            quality: isAudio ? "128" : String(format),
            key: dKey
        })
    });
    const dlData = await dlRes.json();

    return {
        url: dlData?.data?.downloadUrl,
        cdn: cdn
    };
}

// ==================== [ FUNGSI INTI TIKTOK DOWNLOADING ] ====================
async function downloadTikTokData(url) {
    try {
        const reqUrl = `${NEXRAY.BASE_URL}${NEXRAY.ENDPOINTS.DOWNLOAD}?url=${encodeURIComponent(url)}`;
        const response = await fetch(reqUrl);
        const data = await response.json();
        
        if (data?.status) {
            const d = data.result;
            return {
                success: true,
                data: {
                    id: d.id,
                    username: d.author?.username || '-',
                    description: d.title || '-',
                    duration: d.duration || '-',
                    stats: {
                        likes: d.stats?.likes || '0',
                        comments: d.stats?.comment || '0',
                        shares: d.stats?.share || '0',
                        views: d.stats?.views || '0'
                    },
                    video_url: d.data || null,
                    video_hd: d.hd || null,
                    video_watermark: d.watermark || null,
                    audio_url: d.music_info?.url || null,
                    thumbnail: d.cover || null,
                    slides: d.slides || []
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
                search: "/api/v1/youtube/youtube-search?query=KEYWORD&limit=20",
                audio: "/api/v1/youtube/youtube-audio?url=YOUTUBE_URL",
                video: "/api/v1/youtube/youtube-video?url=YOUTUBE_URL&resolusi=720",
                audio_with_metadata: "/api/v1/youtube/audio?url=YOUTUBE_URL",
                video_with_metadata: "/api/v1/youtube/video?url=YOUTUBE_URL&resolusi=720",
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

// ========== [ ENDPOINT YOUTUBE SEARCH ] ==========
app.get("/api/v1/youtube/youtube-search", async (req, res) => {
    const start = Date.now();
    try {
        const { query, limit = 20 } = req.query;
        
        if (!query) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'query' diperlukan",
                example: "/api/v1/youtube/youtube-search?query=rick+roll&limit=10",
                timestamp: new Date().toISOString()
            });
        }

        const result = await searchYouTubeWithMetadata(query, parseInt(limit));

        if (result.success) {
            jsonResponse(res, 200, {
                status: true,
                creator: CREATOR_NAME,
                result: {
                    query: result.query,
                    total_results: result.total_results,
                    limit: result.limit,
                    results: result.results
                },
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        console.error("YouTube Search Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message || "Terjadi kesalahan pada server",
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT YOUTUBE AUDIO (DOWNLOAD ONLY - TANPA METADATA) ] ==========
app.get("/api/v1/youtube/youtube-audio", async (req, res) => {
    const start = Date.now();
    try {
        const { url } = req.query;
        
        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                example: "/api/v1/youtube/youtube-audio?url=https://youtube.com/watch?v=xxx",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadFromSavetube(url, "mp3");

        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                download_url: result.url,
                format: "mp3",
                quality: "128kbps",
                cdn_used: result.cdn
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });

    } catch (error) {
        console.error("YouTube Audio Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT YOUTUBE VIDEO (DOWNLOAD ONLY - TANPA METADATA) ] ==========
app.get("/api/v1/youtube/youtube-video", async (req, res) => {
    const start = Date.now();
    try {
        const { url, resolusi = "720" } = req.query;
        
        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                example: "/api/v1/youtube/youtube-video?url=https://youtube.com/watch?v=xxx&resolusi=720",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadFromSavetube(url, resolusi);

        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                download_url: result.url,
                format: "mp4",
                quality: resolusi + "p",
                cdn_used: result.cdn
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });

    } catch (error) {
        console.error("YouTube Video Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT YOUTUBE AUDIO (DENGAN METADATA) - LEGACY ] ==========
app.get("/api/v1/youtube/audio", async (req, res) => {
    const start = Date.now();
    try {
        const { url } = req.query;
        if (!url) throw new Error("Parameter 'url' diperlukan");
        
        const videoId = extractYoutubeId(url);
        if (!videoId) throw new Error("URL Youtube tidak valid");

        const [metadata, download] = await Promise.all([
            getCustomYouTubeMetadata(videoId),
            downloadFromSavetube(url, "mp3")
        ]);
        
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                metadata: metadata,
                download: {
                    audio_url: download.url,
                    format: "mp3",
                    cdn_used: download.cdn
                }
            },
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, { status: false, error: error.message });
    }
});

// ========== [ ENDPOINT YOUTUBE VIDEO (DENGAN METADATA) - LEGACY ] ==========
app.get("/api/v1/youtube/video", async (req, res) => {
    const start = Date.now();
    try {
        const { url, resolusi = "720" } = req.query;
        if (!url) throw new Error("Parameter 'url' diperlukan");
        
        const videoId = extractYoutubeId(url);
        if (!videoId) throw new Error("URL Youtube tidak valid");

        const [metadata, download] = await Promise.all([
            getCustomYouTubeMetadata(videoId),
            downloadFromSavetube(url, resolusi)
        ]);
        
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                metadata: metadata,
                download: {
                    video_url: download.url,
                    quality: resolusi + "p",
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

// ========== [ ENDPOINT YOUTUBE PLAY MP3 ] ==========
app.get("/api/v1/youtube/youtube-play-mp3", async (req, res) => {
    const start = Date.now();
    try {
        const { query } = req.query;
        if (!query) throw new Error("Parameter 'query' pencarian diperlukan");

        const search = await yts(query);
        if (!search.videos || search.videos.length === 0) throw new Error("Video tidak ditemukan");
        const video = search.videos[0];

        const [customMetadata, downloadResult] = await Promise.all([
            getCustomYouTubeMetadata(video.videoId),
            downloadFromSavetube(video.url, "mp3")
        ]);

        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                query_search: query,
                metadata: customMetadata || {
                    video_id: video.videoId,
                    title: video.title,
                    channel_info: { name: video.author.name },
                    views: video.views
                },
                download: {
                    audio_url: downloadResult.url,
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
                    id: data.id,
                    username: data.username,
                    description: data.description,
                    duration: data.duration,
                    stats: data.stats
                },
                media: {
                    is_slideshow: isSlideshow,
                    video: data.video_url ? { 
                        url_standard: data.video_url, 
                        url_hd: data.video_hd, 
                        url_watermark: data.video_watermark 
                    } : null,
                    audio: data.audio_url ? { url: data.audio_url } : null,
                    thumbnail: data.thumbnail,
                    slides: data.slides
                }
            },
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        jsonResponse(res, 500, { status: false, error: error.message });
    }
});

app.get("/api/v1/tiktok/video", async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) throw new Error("Parameter 'url' dibutuhkan");
        
        const result = await downloadTikTokData(url);
        if(!result.success) throw new Error(result.error);
        
        const data = result.data;
        const videoTarget = data.video_hd || data.video_url; 
        
        if (!videoTarget) throw new Error("URL Video tidak ditemukan (Mungkin ini slideshow foto)");

        jsonResponse(res, 200, { 
            status: true, 
            creator: CREATOR_NAME,
            result: { 
                username: data.username,
                description: data.description,
                video_url: videoTarget,
                is_hd: !!data.video_hd
            } 
        });
    } catch (error) {
        jsonResponse(res, 500, { status: false, error: error.message });
    }
});

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
                audio_url: result.data.audio_url
            } 
        });
    } catch (error) {
        jsonResponse(res, 500, { status: false, error: error.message });
    }
});

module.exports = app;