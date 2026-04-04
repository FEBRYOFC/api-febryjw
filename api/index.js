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

// ==================== [ KONSTANTA UMUM ] ====================
const CREATOR_NAME = "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀";
const RANDOM_CDN_API = "https://media.savetube.vip/api/random-cdn";

// ==================== [ KONSTANTA SAVE TUBE (YOUTUBE) ] ====================
const SAVE_TUBE = {
    KEY: "C5D58EF67A7584E4A29F6C35BBC4EB12",
    ORIGIN: "https://save-tube.com",
    REFERER: "https://save-tube.com/",
    HEADERS: {
        "content-type": "application/json",
        origin: "https://save-tube.com",
        referer: "https://save-tube.com/",
        "user-agent": "Mozilla/5.0 (Android 10; Mobile; rv:148.0) Gecko/148.0 Firefox/148.0"
    },
    FORMATS: ["144", "240", "360", "480", "720", "1080", "mp3"]
};

// ==================== [ KONSTANTA TIKTOK NEXRAY ] ====================
const NEXRAY = {
    BASE_URL: "https://api.nexray.web.id",
    ENDPOINTS: {
        DOWNLOAD: "/downloader/tiktok"
    },
    HEADERS: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
};

// ==================== [ KONSTANTA TIKTOK SAVETT ] ====================
const SAVETT = {
    BASE_URL: "https://savett.cc",
    ENDPOINTS: {
        DOWNLOAD: "/en1/download"
    },
    HEADERS: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Origin": "https://savett.cc",
        "Referer": "https://savett.cc/en1/download",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10) Chrome/139.0.0.0 Mobile Safari/537.36"
    }
};

// ==================== [ KONSTANTA AI COPILOT ] ====================
const AI_COPILOT = {
    BASE_URL: "https://api.zenzxz.my.id",
    ENDPOINTS: {
        CHAT: "/ai/copilot"
    },
    HEADERS: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    DEFAULT_MODEL: "gpt-5"
};

// ==================== [ KONSTANTA AI CHATGPT ] ====================
const AI_CHATGPT = {
    BASE_URL: "https://api.zenzxz.my.id",
    ENDPOINTS: {
        CHAT: "/ai/chatgpt"
    },
    HEADERS: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Origin": "https://api.zenzxz.my.id",
        "Referer": "https://api.zenzxz.my.id/"
    },
    SYSTEM_PROMPT: `Kamu adalah FebryJW 🚀, asisten AI yang ramah. Gunakan bahasa Indonesia santai. Berikan jarak 2 baris antar paragraf.`
};


// ==================== [ KONSTANTA AI MLBB ] ====================
const MLBB_SYSTEM_PROMPT = `Kamu adalah FebryJW 🚀, MLBB Pro-Analyst & Coach. 
Tugasmu memberikan saran strategi kemenangan di Land of Dawn.

Keahlianmu:
1. **Counter Pick:** Menyarankan hero untuk melawan hero tertentu (contoh: Diggie counter Atlas).
2. **Itemization:** Menjelaskan fungsi item (contoh: Sea Halberd untuk lawan regenerasi tinggi).
3. **Drafting:** Memberikan saran komposisi tim yang seimbang (Tank, Jungler, Mage, Goldlane, Explane).
4. **Micro/Macro:** Tips mekanik hero dan cara rotasi objektif (Turtle/Lord).

Aturan Jawaban:
- Gunakan istilah: 'Ganking', 'Freeze Lane', 'Laning Phase', 'Snowball', 'Poke', 'Burst'.
- Format jawaban: Nama Hero/Item dibold (contoh: **Blade of Despair**).
- Jika ditanya build, berikan 6 item + 1 pilihan Spare Item.
- Gunakan bahasa Indonesia santai tapi edukatif. Berikan jarak 2 baris antar paragraf.`;

// ==================== [ KONSTANTA AI GEMINI ] ====================
const AI_GEMINI = {
    BASE_URL: "https://api.nexray.web.id",
    ENDPOINTS: {
        CHAT: "/ai/gemini"
    },
    HEADERS: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    },
    SYSTEM_PROMPT: `Kamu adalah FebryJW 🚀. 
    Kamu adalah asisten AI yang ramah, cerdas, dan santai. 
    Selalu gunakan bahasa Indonesia yang akrab. 
    Berikan jarak 2 baris antar paragraf agar rapi. 
    Gunakan format *teks* untuk penekanan.`
};

// ==================== [ FUNGSI UNTUK RESPON JSON YANG RAPI ] ====================
function jsonResponse(res, statusCode, data) {
    res.setHeader("Content-Type", "application/json");
    res.status(statusCode).send(JSON.stringify(data, null, 2));
}

// ==================== [ FUNGSI EKSTRAK ID YOUTUBE ] ====================
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

// ==================== [ FUNGSI DECRYPT SAVE TUBE ] ====================
async function decryptData(enc) {
    try {
        const sr = Buffer.from(enc, "base64");
        const key = Buffer.from(SAVE_TUBE.KEY, "hex");
        const iv = sr.slice(0, 16);
        const data = sr.slice(16);
        const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        return JSON.parse(decrypted.toString());
    } catch (e) {
        throw new Error(`Gagal decrypt data: ${e.message}`);
    }
}

// ==================== [ FUNGSI RANDOM CDN ] ====================
async function getRandomCDN() {
    try {
        const response = await axios.get(RANDOM_CDN_API, {
            timeout: 10000,
            headers: {
                "accept": "application/json",
                "user-agent": SAVE_TUBE.HEADERS["user-agent"]
            }
        });

        const cdn = response.data?.cdn;
        if (!cdn) throw new Error("Response random CDN tidak valid");
        return cdn;
    } catch (error) {
        throw new Error(`Gagal ambil random CDN: ${error.message}`);
    }
}

// ==================== [ FUNGSI NORMALISASI PAYLOAD INFO ] ====================
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

// ==================== [ FUNGSI DAPATKAN INFO VIDEO YOUTUBE ] ====================
async function getVideoInfo(cdn, youtubeId) {
    const response = await axios.post(
        `https://${cdn}/v2/info`,
        {
            url: `https://www.youtube.com/watch?v=${youtubeId}`
        },
        {
            headers: SAVE_TUBE.HEADERS,
            timeout: 20000
        }
    );

    const raw = response.data?.data;
    const info = await normalizeInfoPayload(raw);

    if (!info) throw new Error("Info video gagal diproses");
    return info;
}

// ==================== [ FUNGSI REQUEST DOWNLOAD YOUTUBE ] ====================
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

// ==================== [ FUNGSI UTAMA DOWNLOAD YOUTUBE ] ====================
async function downloadFromSavetube(url, format = "mp3", attempt = 0, maxAttempt = 5) {
    const id = extractYoutubeId(url);
    if (!id) {
        throw new Error("Gagal mengekstrak ID YouTube dari URL");
    }

    if (!SAVE_TUBE.FORMATS.includes(format)) {
        throw new Error(`Format tidak tersedia. Pilih: ${SAVE_TUBE.FORMATS.join(", ")}`);
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

// ==================== [ FUNGSI TIKTOK DARI NEXRAY ] ====================
async function getTikTokFromNexRay(url) {
    try {
        const apiUrl = `${NEXRAY.BASE_URL}${NEXRAY.ENDPOINTS.DOWNLOAD}?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, {
            timeout: 30000,
            headers: NEXRAY.HEADERS
        });

        if (response.data?.status) {
            const data = response.data.result;
            return {
                success: true,
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
        return { success: false };
    } catch (error) {
        return { success: false };
    }
}

// ==================== [ FUNGSI TIKTOK DARI SAVETT (SCRAPE) ] ====================
async function getTikTokFromSaveTT(url) {
    try {
        const page = await axios.get(`${SAVETT.BASE_URL}${SAVETT.ENDPOINTS.DOWNLOAD}`, {
            headers: SAVETT.HEADERS
        });

        const csrf = page.data.match(/name="csrf_token" value="([^"]+)"/)?.[1];
        const cookie = page.headers['set-cookie']?.map(v => v.split(';')[0]).join('; ');

        if (!csrf) {
            throw new Error('CSRF token tidak ditemukan');
        }

        const post = await axios.post(
            `${SAVETT.BASE_URL}${SAVETT.ENDPOINTS.DOWNLOAD}`,
            `csrf_token=${encodeURIComponent(csrf)}&url=${encodeURIComponent(url)}`,
            {
                headers: {
                    ...SAVETT.HEADERS,
                    Cookie: cookie || ''
                },
                timeout: 30000
            }
        );

        const $ = cheerio.load(post.data);

        const username = $('#video-info h3').first().text().trim() || '-';
        const desc = $('.desc-video').first().text().trim() || '-';
        
        const stats = {};
        $('.info-download li').each((_, el) => {
            const text = $(el).text().toLowerCase();
            if (text.includes('like')) stats.likes = text.match(/\d+/)?.[0] || '0';
            if (text.includes('comment')) stats.comments = text.match(/\d+/)?.[0] || '0';
            if (text.includes('share')) stats.shares = text.match(/\d+/)?.[0] || '0';
            if (text.includes('view')) stats.views = text.match(/\d+/)?.[0] || '0';
        });

        let mp4Urls = [];
        let mp3Urls = [];
        let slides = [];

        $('.carousel-item[data-data]').each((_, el) => {
            try {
                const json = JSON.parse($(el).attr('data-data').replace(/&quot;/g, '"'));
                json.URL?.forEach(u => slides.push(u));
            } catch (e) {}
        });

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

        const duration = $('#duration').text().trim() || '-';

        return {
            success: true,
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
        return { success: false };
    }
}

// ==================== [ FUNGSI UTAMA TIKTOK ] ====================
async function downloadTikTok(url) {
    const nexray = await getTikTokFromNexRay(url);
    
    if (nexray.success && nexray.data) {
        return nexray.data;
    }

    const savett = await getTikTokFromSaveTT(url);
    
    if (savett.success) {
        return savett.data;
    }

    throw new Error('Gagal mengambil data TikTok');
}

// ==================== [ FUNGSI AI COPILOT ] ====================
async function getAICopilot(query) {
    try {
        const apiUrl = `${AI_COPILOT.BASE_URL}${AI_COPILOT.ENDPOINTS.CHAT}?message=${encodeURIComponent(query)}&model=${AI_COPILOT.DEFAULT_MODEL}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 60000,
            headers: AI_COPILOT.HEADERS
        });

        const data = response.data;

        if (data && data.status === true && data.result && data.result.text) {
            return {
                success: true,
                answer: data.result.text,
                model: AI_COPILOT.DEFAULT_MODEL,
                citations: data.result.citations || []
            };
        } else {
            throw new Error(data?.message || "Response tidak valid dari API");
        }
    } catch (error) {
        console.error("AI Copilot Error:", error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==================== [ FUNGSI AI CHATGPT DENGAN SYSTEM PROMPT ] ====================
async function getAIChatGPT(query) {
    try {
        const fullQuery = `${AI_CHATGPT.SYSTEM_PROMPT}\n\nUser: ${query}\n\nFebryJW:`;
        
        const response = await axios.get(`${AI_CHATGPT.BASE_URL}${AI_CHATGPT.ENDPOINTS.CHAT}`, {
            params: { q: fullQuery }, // Menggunakan params lebih aman
            timeout: 60000,
            headers: AI_CHATGPT.HEADERS // WAJIB dikirim
        });

        if (response.data && response.data.status === true) {
            let answer = response.data.result;
            answer = answer.replace(/^FebryJW:\s*/i, '').replace(/^FebryJW🚀:\s*/i, '');
            return { success: true, answer: answer };
        } 
        throw new Error("Respon API tidak valid");
    } catch (error) {
        // Cek jika error karena diblokir (403)
        const errorMsg = error.response ? `Error ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
        console.error("AI ChatGPT Error:", errorMsg);
        return { success: false, error: errorMsg };
    }
}

// ==================== [ KONSTANTA AI CHATGPT ] ====================
async function getMLBBAssistant(query) {
    try {
        const fullQuery = `${MLBB_SYSTEM_PROMPT}\n\nUser: ${query}\n\nFebryJW Analyst:`;
        
        const response = await axios.get(`${AI_CHATGPT.BASE_URL}${AI_CHATGPT.ENDPOINTS.CHAT}`, {
            params: { q: fullQuery },
            timeout: 60000,
            headers: AI_CHATGPT.HEADERS // WAJIB dikirim
        });

        if (response.data && response.data.status === true) {
            let answer = response.data.result;
            answer = answer.replace(/^FebryJW Analyst:\s*/i, '');
            return { success: true, answer: answer };
        }
        throw new Error("Gagal mendapatkan analisis MLBB");
    } catch (error) {
        const errorMsg = error.response ? `Error ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
        console.error("MLBB Coach Error:", errorMsg);
        return { success: false, error: errorMsg };
    }
}

async function getAIGemini(query) {
    try {
        // Gabungkan System Prompt dengan Pertanyaan User
        const fullText = `${AI_GEMINI.SYSTEM_PROMPT}\n\nUser: ${query}\n\nFebryJW:`;
        
        const response = await axios.get(`${AI_GEMINI.BASE_URL}${AI_GEMINI.ENDPOINTS.CHAT}`, {
            params: { text: fullText },
            timeout: 60000,
            headers: AI_GEMINI.HEADERS
        });

        // Hanya ambil 'result' jika status true
        if (response.data && response.data.status === true) {
            let answer = response.data.result;
            
            // Bersihkan sisa-sisa prefix jika AI menulis ulang nama asisten
            answer = answer.replace(/^FebryJW:\s*/i, '');
            
            return {
                success: true,
                answer: answer
            };
        }
        throw new Error("Gagal mendapatkan respon AI");
    } catch (error) {
        console.error("AI Gemini Error:", error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==================== [ FUNGSI WAKTU INDONESIA ] ====================
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

// ==================== [ ENDPOINT UTAMA ] ====================
app.get("/", (req, res) => {
    jsonResponse(res, 200, {
        status: true,
        creator: CREATOR_NAME,
        message: "YouTube & TikTok & AI Downloader API",
        endpoints: {
            youtube: {
                audio: "/api/v1/youtube/audio?url=YOUTUBE_URL",
                video: "/api/v1/youtube/video?url=YOUTUBE_URL&resolusi=720",
                playmp3: "/api/v1/youtube/ytplaymp3?query=SEARCH_QUERY"
            },
            tiktok: {
                audio_video: "/api/v1/tiktok/tiktok-audio-video?url=TIKTOK_URL",
                video: "/api/v1/tiktok/video?url=TIKTOK_URL&hd=true",
                audio: "/api/v1/tiktok/audio?url=TIKTOK_URL"
            },
            ai: {
                copilot: "/api/v1/ai/copilot-ai?query=YOUR_QUESTION",
                chatgpt: "/api/v1/ai/chatgpt-ai?query=YOUR_QUESTION"
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
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        const result = await downloadFromSavetube(url, "mp3");

        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
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
            creator: CREATOR_NAME,
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
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        }

        const result = await downloadFromSavetube(url, resolusi);

        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
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
            creator: CREATOR_NAME,
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
                creator: CREATOR_NAME,
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
            creator: CREATOR_NAME,
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
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ==================== [ TIKTOK ENDPOINTS ] ====================

// ========== [ ENDPOINT TIKTOK AUDIO & VIDEO ] ==========
app.get("/api/v1/tiktok/tiktok-audio-video", async (req, res) => {
    const start = Date.now();

    try {
        const { url } = req.query;

        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadTikTok(url);
        
        let videoUrl = result.video_url;
        let videoQuality = "Standard";
        
        if (result.video_hd) {
            videoUrl = result.video_hd;
            videoQuality = "HD";
        }

        const isSlideshow = result.slides && result.slides.length > 0;

        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                id: result.id,
                username: result.username,
                description: result.description,
                duration: result.duration,
                stats: result.stats,
                media: {
                    video: videoUrl ? {
                        url: videoUrl,
                        quality: videoQuality,
                        watermark: result.video_watermark
                    } : null,
                    audio: result.audio_url ? {
                        url: result.audio_url
                    } : null,
                    thumbnail: result.thumbnail,
                    is_slideshow: isSlideshow,
                    slides: result.slides || []
                }
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok Audio Video Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT TIKTOK VIDEO ] ==========
app.get("/api/v1/tiktok/video", async (req, res) => {
    const start = Date.now();

    try {
        const { url, hd = "false" } = req.query;

        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadTikTok(url);
        
        let videoUrl = result.video_url;
        let videoQuality = "Standard";
        
        if (hd === "true" && result.video_hd) {
            videoUrl = result.video_hd;
            videoQuality = "HD";
        }

        if (!videoUrl && result.slides && result.slides.length > 0) {
            return jsonResponse(res, 200, {
                status: true,
                creator: CREATOR_NAME,
                type: "slideshow",
                result: {
                    username: result.username,
                    description: result.description,
                    slides: result.slides,
                    audio: result.audio_url
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
            creator: CREATOR_NAME,
            result: {
                title: result.description?.substring(0, 100) || "TikTok Video",
                username: result.username,
                duration: result.duration,
                video_url: videoUrl,
                video_quality: videoQuality,
                thumbnail: result.thumbnail,
                stats: result.stats
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok Video Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ========== [ ENDPOINT TIKTOK AUDIO ] ==========
app.get("/api/v1/tiktok/audio", async (req, res) => {
    const start = Date.now();

    try {
        const { url } = req.query;

        if (!url) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'url' diperlukan",
                timestamp: new Date().toISOString()
            });
        }

        const result = await downloadTikTok(url);

        if (!result.audio_url) {
            throw new Error("Audio tidak ditemukan untuk video ini");
        }

        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                title: result.description?.substring(0, 100) || "TikTok Audio",
                username: result.username,
                duration: result.duration,
                audio_url: result.audio_url,
                thumbnail: result.thumbnail
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } catch (error) {
        console.error("TikTok Audio Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message,
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ==================== [ AI COPILOT ENDPOINTS ] ====================

// ========== [ ENDPOINT AI COPILOT ] ==========
app.get("/api/v1/ai/copilot-ai", async (req, res) => {
    const start = Date.now();

    try {
        const { query } = req.query;

        if (!query) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'query' diperlukan",
                example: "/api/v1/ai/copilot-ai?query=halo",
                timestamp: new Date().toISOString()
            });
        }

        const result = await getAICopilot(query);

        if (result.success) {
            jsonResponse(res, 200, {
                status: true,
                creator: CREATOR_NAME,
                result: {
                    query: query,
                    answer: result.answer,
                    model: result.model,
                    citations: result.citations
                },
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        console.error("AI Copilot Endpoint Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message || "Terjadi kesalahan pada server",
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

// ==================== [ AI CHATGPT ENDPOINTS ] ====================

// ========== [ ENDPOINT AI CHATGPT ] ==========
app.get("/api/v1/ai/chatgpt-ai", async (req, res) => {
    const start = Date.now();

    try {
        const { query } = req.query;

        if (!query) {
            return jsonResponse(res, 400, {
                status: false,
                creator: CREATOR_NAME,
                error: "Parameter 'query' diperlukan",
                example: "/api/v1/ai/chatgpt-ai?query=halo",
                timestamp: new Date().toISOString()
            });
        }

        const result = await getAIChatGPT(query);

        if (result.success) {
            jsonResponse(res, 200, {
                status: true,
                creator: CREATOR_NAME,
                result: {
                    query: query,
                    answer: result.answer,
                    model: result.model,
                    citations: result.citations
                },
                timestamp: new Date().toISOString(),
                response_time: `${Date.now() - start}ms`
            });
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        console.error("AI ChatGPT Endpoint Error:", error.message);
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: error.message || "Terjadi kesalahan pada server",
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    }
});

app.get("/api/v1/ai/mlbb-coach", async (req, res) => {
    const start = Date.now();
    const { query } = req.query;

    if (!query) {
        return jsonResponse(res, 400, {
            status: false,
            error: "Tanyakan apapun tentang MLBB! Contoh: ?query=cara counter nolan"
        });
    }

    const result = await getMLBBAssistant(query);

    if (result.success) {
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                user_ask: query,
                analysis: result.answer,
                game: "Mobile Legends: Bang Bang"
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } else {
        jsonResponse(res, 500, { status: false, error: result.error });
    }
});

// ========== [ ENDPOINT AI GEMINI ] ==========
app.get("/api/v1/ai/ai-gemini", async (req, res) => {
    const start = Date.now();
    const { query } = req.query;

    if (!query) {
        return jsonResponse(res, 400, {
            status: false,
            creator: CREATOR_NAME,
            error: "Parameter 'query' diperlukan."
        });
    }

    const result = await getAIGemini(query);

    if (result.success) {
        // Response bersih tanpa menyebutkan source nexray
        jsonResponse(res, 200, {
            status: true,
            creator: CREATOR_NAME,
            result: {
                query: query,
                answer: result.answer
            },
            timestamp: new Date().toISOString(),
            response_time: `${Date.now() - start}ms`
        });
    } else {
        jsonResponse(res, 500, {
            status: false,
            creator: CREATOR_NAME,
            error: "Maaf, asisten sedang beristirahat. Coba lagi nanti.",
            timestamp: new Date().toISOString()
        });
    }
});


module.exports = app;