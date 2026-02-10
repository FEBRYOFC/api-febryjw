// =========================
// IMPORT MODULE
// =========================
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { createDecipheriv } = require("crypto");
const yts = require("yt-search");
const fs = require("fs");
const FormData = require("form-data");
const multer = require("multer");
const app = express();
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Multer setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// HELPER FUNCTIONS
// ===============================
function get_id(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|v\/|embed\/|user\/[^/\n\s]+\/)?(?:watch\?v=|v%3D|embed%2F|video%2F)?|youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/playlist\?list=)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function make_id(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function format_date(input) {
    const date = new Date(input);
    const options = {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    };
    const formatter = new Intl.DateTimeFormat("id-ID", options);
    const formatted = formatter.format(date);
    return `${formatted.replace(".", ":")} WIB`;
}

function formatJsonResponse(res, data, statusCode = 200) {
    res.setHeader('Content-Type', 'application/json');
    res.status(statusCode).send(JSON.stringify(data, null, 4));
}

function errorResponse(res, statusCode, message, details = null) {
    const response = {
        success: false,
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        message: message,
        timestamp: new Date().toISOString()
    };
    
    if (details) {
        response.details = details;
    }
    
    formatJsonResponse(res, response, statusCode);
}

const audio = [92, 128, 256, 320];
const video = [144, 360, 480, 720, 1080];

const decode = (enc) => {
    try {
        const secret_key = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
        const data = Buffer.from(enc, 'base64');
        const iv = data.slice(0, 16);
        const content = data.slice(16);
        const key = Buffer.from(secret_key, 'hex');

        const decipher = createDecipheriv('aes-128-cbc', key, iv);
        let decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
        return JSON.parse(decrypted.toString());
    } catch (error) {
        return { error: true, message: "Decode failed: " + error.message };
    }
};

// ===============================
// SHORTLINK BYPASS (VERCEL OPTIMIZED)
// ===============================

async function bypassShortlink(targetUrl) {
    let browser = null;
    try {
        const executablePath = await chromium.executablePath();
        
        browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        
        // Block iklan agar tidak berat
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.evaluateOnNewDocument(() => {
            window.open = () => {};
            const NativeTo = window.setTimeout;
            const NativeIv = window.setInterval;
            window.setTimeout = (fn, ms) => NativeTo(fn, ms / 1e7);
            window.setInterval = (fn, ms) => NativeIv(fn, ms / 1e7);
        });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Injeksi script klik otomatis
        await page.evaluate(() => {
            const Click = (sel) => {
                const Iv = setInterval(() => {
                    const El = document.querySelector(sel);
                    if (El && El.offsetParent !== null) {
                        clearInterval(Iv);
                        El.click();
                    }
                }, 500);
            };

            Click('#submit-button');
            Click('#btn-2');
            Click('#btn-3');
            Click('#verify > a');
            Click('#first_open_button_page_1');

            // Khusus halaman terakhir sfl.gl
            setInterval(() => {
                const openLinkBtn = [...document.querySelectorAll('span, a, button')]
                    .find(el => el.textContent.trim() === 'OPEN LINK');
                if (openLinkBtn) openLinkBtn.click();
            }, 1000);
        });

        // TUNGGU SAMPAI REDIRECT KELUAR DARI SFL.GL
        // Kita menunggu maksimal 45 detik sampai URL berubah
        await page.waitForFunction(
            () => !window.location.href.includes('sfl.gl') && !window.location.href.includes('about:blank'),
            { timeout: 45000, polling: 1000 }
        );

        const finalUrl = page.url();

        return { 
            success: true, 
            resultUrl: finalUrl 
        };

    } catch (error) {
        return { success: false, message: error.message };
    } finally {
        if (browser !== null) await browser.close();
    }
}

async function savetube(link, quality, value) {
    try {
        const cdnResponse = await axios.get("https://media.savetube.vip/api/random-cdn");
        const cdn = cdnResponse.data.cdn;

        const infoget = await axios.post(`https://${cdn}/v2/info`, { 'url': link }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://yt.savetube.me/1kejjj1?id=362796039'
            }
        });

        const info = decode(infoget.data.data);

        const response = await axios.post(`https://${cdn}/download`, {
            'downloadType': value,
            'quality': `${quality}`,
            'key': info.key
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://yt.savetube.me/start-download?from=1kejjj1%3Fid%3D362796039'
            }
        });

        return {
            success: true,
            quality: `${quality}${value === "audio" ? "kbps" : "p"}`,
            availableQuality: value === "audio" ? audio : video,
            url: response.data.data.downloadUrl,
            filename: `${info.title} (${quality}${value === "audio" ? "kbps).mp3" : "p).mp4"}`,
            title: info.title,
            duration: info.duration,
            thumbnail: info.thumbnail,
            downloadType: value
        };
    } catch (error) {
        console.error("Savetube error:", error.message);
        return { success: false, message: "Converting error: " + error.message };
    }
}

// ===============================
// TIKTOK FUNCTIONS
// ===============================

async function tiktokDl(url) {
    return new Promise(async (resolve, reject) => {
        try {
            let data = []
            function formatNumber(integer) {
                let numb = parseInt(integer)
                return Number(numb).toLocaleString().replace(/,/g, '.')
            }
            
            function formatDate(n, locale = 'en') {
                let d = new Date(n)
                return d.toLocaleDateString(locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric'
                })
            }
            
            let domain = 'https://www.tikwm.com/api/';
            let res = await (await axios.post(domain, {}, {
                headers: {
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': 'https://www.tikwm.com',
                    'Referer': 'https://www.tikwm.com/',
                    'Sec-Ch-Ua': '"Not)A;Brand" ;v="24" , "Chromium" ;v="116"',
                    'Sec-Ch-Ua-Mobile': '?1',
                    'Sec-Ch-Ua-Platform': 'Android',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                params: {
                    url: url,
                    count: 10,
                    cursor: 0,
                    web: 1,
                    hd: 1
                }
            })).data.data
            if (res?.duration == 0) {
                res.images.map(v => {
                    data.push({ type: 'photo', url: v })
                })
            } else {
                data.push({
                    type: 'nowatermark',
                    url: 'https://www.tikwm.com' + res?.play || "/undefined",
                }, {
                    type: 'nowatermark_hd',
                    url: 'https://www.tikwm.com' + res?.hdplay || "/undefined"
                })
            }
            let json = {
                status: true,
                title: res.title,
                taken_at: formatDate(res.create_time).replace('1970', ''),
                region: res.region,
                id: res.id,
                durations: res.duration,
                duration: res.duration + ' Seconds',
                cover: 'https://www.tikwm.com' + res.cover,
                size_wm: res.wm_size,
                size_nowm: res.size,
                size_nowm_hd: res.hd_size,
                data: data,
                music_info: {
                    id: res.music_info.id,
                    title: res.music_info.title,
                    author: res.music_info.author,
                    album: res.music_info.album ? res.music_info.album : null,
                    url: 'https://www.tikwm.com' + res.music || res.music_info.play
                },
                stats: {
                    views: formatNumber(res.play_count),
                    likes: formatNumber(res.digg_count),
                    comment: formatNumber(res.comment_count),
                    share: formatNumber(res.share_count),
                    download: formatNumber(res.download_count)
                },
                author: {
                    id: res.author.id,
                    fullname: res.author.unique_id,
                    nickname: res.author.nickname,
                    avatar: 'https://www.tikwm.com' + res.author.avatar
                }
            }
            resolve(json)
        } catch (e) {
            reject({
                status: false,
                message: e.message
            })
        }
    });
}

async function tiktokMp3(url) {
    try {
        const result = await tiktokDl(url);
        
        return {
            success: result.status,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            metadata: {
                videoId: result.id,
                title: result.title,
                description: result.title,
                channelTitle: result.author.nickname,
                thumbnails: [
                    {
                        quality: "high",
                        url: result.cover,
                        width: 720,
                        height: 1280
                    }
                ],
                tags: [],
                publishedAt: result.taken_at,
                publishedFormat: result.taken_at,
                statistics: {
                    viewCount: result.stats.views,
                    likeCount: result.stats.likes,
                    commentCount: result.stats.comment,
                    shareCount: result.stats.share,
                    downloadCount: result.stats.download
                },
                duration: result.duration,
                durationSeconds: result.durations,
                url: url,
                author: {
                    id: result.author.id,
                    name: result.author.nickname,
                    username: result.author.fullname,
                    avatar: result.author.avatar
                }
            },
            download: {
                quality: "MP3",
                availableQuality: ["MP3"],
                url: result.music_info.url
            }
        };
    } catch (error) {
        console.error("TikTok MP3 error:", error);
        return {
            success: false,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message || 'Download failed',
            timestamp: new Date().toISOString()
        };
    }
}

async function tiktokMp4(url) {
    try {
        const result = await tiktokDl(url);
        
        const downloadUrl = result.data[0]?.url || result.data[1]?.url;
        
        return {
            success: result.status,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            metadata: {
                videoId: result.id,
                title: result.title,
                description: result.title,
                channelTitle: result.author.nickname,
                thumbnails: [
                    {
                        quality: "high",
                        url: result.cover,
                        width: 720,
                        height: 1280
                    }
                ],
                tags: [],
                publishedAt: result.taken_at,
                publishedFormat: result.taken_at,
                statistics: {
                    viewCount: result.stats.views,
                    likeCount: result.stats.likes,
                    commentCount: result.stats.comment,
                    shareCount: result.stats.share,
                    downloadCount: result.stats.download
                },
                duration: result.duration,
                durationSeconds: result.durations,
                url: url,
                author: {
                    id: result.author.id,
                    name: result.author.nickname,
                    username: result.author.fullname,
                    avatar: result.author.avatar
                }
            },
            download: {
                quality: "HD",
                availableQuality: ["SD", "HD"],
                url: downloadUrl
            }
        };
    } catch (error) {
        console.error("TikTok MP4 error:", error);
        return {
            success: false,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message || 'Download failed',
            timestamp: new Date().toISOString()
        };
    }
}

async function tiktokSearchVideo(query) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios({
                method: "POST",
                url: "https://tikwm.com/api/feed/search",
                headers: {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "cookie": "current_language=en",
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
                },
                data: {
                    keywords: query,
                    count: 10,
                    cursor: 0,
                    web: 1,
                    hd: 1,
                }
            });
            
            if (response.data && response.data.data) {
                const videos = response.data.data.videos || response.data.data;
                
                const formattedVideos = videos.map(video => ({
                    videoId: video.id || video.video_id,
                    title: video.title || '',
                    description: video.desc || '',
                    duration: video.duration || 0,
                    durationSeconds: video.duration || 0,
                    thumbnail: video.cover || video.thumbnail,
                    author: {
                        id: video.author?.id,
                        name: video.author?.nickname,
                        username: video.author?.unique_id,
                        avatar: video.author?.avatar
                    },
                    statistics: {
                        viewCount: video.play_count || 0,
                        likeCount: video.digg_count || 0,
                        commentCount: video.comment_count || 0,
                        shareCount: video.share_count || 0
                    },
                    url: `https://www.tiktok.com/@${video.author?.unique_id}/video/${video.id || video.video_id}`,
                    music: video.music_info ? {
                        title: video.music_info.title,
                        author: video.music_info.author,
                        url: video.music || video.music_info.play
                    } : null
                }));
                
                resolve({
                    success: true,
                    creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                    timestamp: new Date().toISOString(),
                    query: query,
                    results: {
                        videos: formattedVideos
                    },
                    counts: {
                        videos: formattedVideos.length,
                        total: formattedVideos.length
                    }
                });
            } else {
                resolve({
                    success: true,
                    creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                    timestamp: new Date().toISOString(),
                    query: query,
                    results: {
                        videos: []
                    },
                    counts: {
                        videos: 0,
                        total: 0
                    }
                });
            }
        } catch (error) {
            reject({
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
}

// ===============================
// TOP4TOP FUNCTIONS
// ===============================

async function top4top(fileBuffer, fileName) {
    try {
        const f = new FormData();
        
        // Menggunakan buffer file
        f.append('file_0_', Buffer.from(fileBuffer), {
            filename: fileName,
            contentType: 'application/octet-stream'
        });
        f.append('submitr', '[ رفع الملفات ]');

        const response = await axios.post(
            'https://top4top.io/index.php',
            f,
            {
                headers: {
                    ...f.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Origin': 'https://top4top.io',
                    'Referer': 'https://top4top.io/',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-User': '?1',
                    'Cache-Control': 'max-age=0'
                },
                timeout: 30000,
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        ).then(x => x.data).catch(error => {
            console.error("Top4Top API error:", error.message);
            return null;
        });

        if (!response) {
            return null;
        }

        // Fungsi untuk mencari pola regex
        const get = regex => {
            const match = response.match(regex);
            return match ? match[1] : null;
        };

        // Mencari URL hasil upload
        const result =
            get(/value="(https:\/\/[a-z]\.top4top\.io\/m_[^"]+)"/) ||
            get(/https:\/\/[a-z]\.top4top\.io\/m_[^"]+/) ||
            get(/value="(https:\/\/[a-z]\.top4top\.io\/p_[^"]+)"/) ||
            get(/https:\/\/[a-z]\.top4top\.io\/p_[^"]+/);

        // Mencari URL delete
        const deleteUrl =
            get(/value="(https:\/\/top4top\.io\/del[^"]+)"/) ||
            get(/https:\/\/top4top\.io\/del[^"]+/);

        return result ? { 
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            result: result, 
            delete: deleteUrl,
            filename: fileName
        } : {
            success: false,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            message: "Failed to extract upload URL from response"
        };
    } catch (error) {
        console.error("Top4Top error:", error);
        return {
            success: false,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            error: error.message
        };
    }
}

// ===============================
// CORE FUNCTIONS
// ===============================

async function ytmp3(link, quality = 128) {
    try {
        const videoId = get_id(link);
        const format = audio.includes(Number(quality)) ? Number(quality) : 128;

        if (!videoId) {
            return { 
                success: false, 
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: 'Invalid YouTube URL',
                timestamp: new Date().toISOString()
            };
        }

        const url = `https://youtube.com/watch?v=${videoId}`;
        const searchData = await yts({ videoId });
        const downloadResult = await savetube(url, format, "audio");

        if (!downloadResult.success) {
            return { 
                success: false, 
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: downloadResult.message,
                timestamp: new Date().toISOString()
            };
        }

        const metadataResult = await ytMetadata(url);
        
        const metadata = metadataResult.success ? {
            videoId: metadataResult.videoId,
            title: metadataResult.title,
            description: metadataResult.description,
            channelId: metadataResult.channelId,
            channelTitle: metadataResult.channelTitle,
            thumbnails: metadataResult.thumbnails,
            tags: metadataResult.tags || [],
            publishedAt: metadataResult.publishedAt,
            publishedFormat: metadataResult.publishedFormat,
            statistics: metadataResult.statistics,
            duration: searchData?.duration?.timestamp || `${Math.floor(downloadResult.duration / 60)}:${downloadResult.duration % 60}`,
            durationSeconds: searchData?.duration?.seconds || downloadResult.duration,
            url: url
        } : {
            videoId: videoId,
            title: searchData?.title || downloadResult.title,
            description: searchData?.description || '',
            channelTitle: searchData?.author?.name,
            thumbnails: [
                {
                    quality: "high",
                    url: searchData?.thumbnail || downloadResult.thumbnail,
                    width: 480,
                    height: 360
                }
            ],
            tags: [],
            publishedAt: searchData?.uploadedAt,
            statistics: {
                viewCount: searchData?.views || 0,
                likeCount: 0,
                commentCount: 0
            },
            duration: searchData?.duration?.timestamp || `${Math.floor(downloadResult.duration / 60)}:${downloadResult.duration % 60}`,
            durationSeconds: searchData?.duration?.seconds || downloadResult.duration,
            url: url
        };

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            metadata: metadata,
            download: {
                quality: downloadResult.quality,
                availableQuality: downloadResult.availableQuality,
                url: downloadResult.url
            }
        };
    } catch (error) {
        console.error("YTMP3 error:", error);
        return { 
            success: false, 
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

async function ytmp4(link, quality = 360) {
    try {
        const videoId = get_id(link);
        const format = video.includes(Number(quality)) ? Number(quality) : 360;

        if (!videoId) {
            return { 
                success: false, 
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: 'Invalid YouTube URL',
                timestamp: new Date().toISOString()
            };
        }

        const url = `https://youtube.com/watch?v=${videoId}`;
        const searchData = await yts({ videoId });
        const downloadResult = await savetube(url, format, "video");

        if (!downloadResult.success) {
            return { 
                success: false, 
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: downloadResult.message,
                timestamp: new Date().toISOString()
            };
        }

        const metadataResult = await ytMetadata(url);
        
        const metadata = metadataResult.success ? {
            videoId: metadataResult.videoId,
            title: metadataResult.title,
            description: metadataResult.description,
            channelId: metadataResult.channelId,
            channelTitle: metadataResult.channelTitle,
            thumbnails: metadataResult.thumbnails,
            tags: metadataResult.tags || [],
            publishedAt: metadataResult.publishedAt,
            publishedFormat: metadataResult.publishedFormat,
            statistics: metadataResult.statistics,
            duration: searchData?.duration?.timestamp || `${Math.floor(downloadResult.duration / 60)}:${downloadResult.duration % 60}`,
            durationSeconds: searchData?.duration?.seconds || downloadResult.duration,
            url: url
        } : {
            videoId: videoId,
            title: searchData?.title || downloadResult.title,
            description: searchData?.description || '',
            channelTitle: searchData?.author?.name,
            thumbnails: [
                {
                    quality: "high",
                    url: searchData?.thumbnail || downloadResult.thumbnail,
                    width: 480,
                    height: 360
                }
            ],
            tags: [],
            publishedAt: searchData?.uploadedAt,
            statistics: {
                viewCount: searchData?.views || 0,
                likeCount: 0,
                commentCount: 0
            },
            duration: searchData?.duration?.timestamp || `${Math.floor(downloadResult.duration / 60)}:${downloadResult.duration % 60}`,
            durationSeconds: searchData?.duration?.seconds || downloadResult.duration,
            url: url
        };

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            metadata: metadata,
            download: {
                quality: downloadResult.quality,
                availableQuality: downloadResult.availableQuality,
                url: downloadResult.url
            }
        };
    } catch (error) {
        console.error("YTMP4 error:", error);
        return { 
            success: false, 
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

async function youtubeSearch(query) {
    try {
        const searchResults = await yts(query);

        const videos = searchResults.videos.map(video => ({
            videoId: video.videoId,
            title: video.title,
            url: video.url,
            duration: video.duration.timestamp || video.duration.toString(),
            durationSeconds: video.duration.seconds,
            thumbnail: video.thumbnail,
            author: video.author.name,
            authorUrl: video.author.url,
            views: video.views,
            uploaded: video.uploadedAt,
            description: video.description
        }));

        const playlists = searchResults.playlists ? searchResults.playlists.map(playlist => ({
            playlistId: playlist.playlistId,
            title: playlist.title,
            url: playlist.url,
            thumbnail: playlist.thumbnail,
            author: playlist.author.name,
            videoCount: playlist.videoCount
        })) : [];

        const channels = searchResults.channels ? searchResults.channels.map(channel => ({
            channelId: channel.channelId,
            name: channel.name,
            url: channel.url,
            thumbnail: channel.thumbnail,
            description: channel.description,
            videoCount: channel.videoCount,
            subscriberCount: channel.subscriberCount
        })) : [];

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            query: query,
            results: {
                videos: videos,
                playlists: playlists,
                channels: channels
            },
            counts: {
                videos: videos.length,
                playlists: playlists.length,
                channels: channels.length,
                total: videos.length + playlists.length + channels.length
            }
        };
    } catch (error) {
        console.error("YouTube Search error:", error);
        return { 
            success: false, 
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

async function ytMetadata(url) {
    try {
        const videoId = get_id(url);

        if (!videoId) {
            return { 
                success: false, 
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: 'Invalid YouTube URL',
                timestamp: new Date().toISOString()
            };
        }

        const response = await axios.get('https://ytapi.apps.mattw.io/v3/videos', {
            params: {
                'key': 'foo1',
                'quotaUser': make_id(40),
                'part': 'snippet,statistics',
                'id': videoId
            },
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://mattw.io/youtube-metadata/'
            }
        });

        if (response.data.items.length === 0) {
            return { 
                success: false, 
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: 'Video not found',
                timestamp: new Date().toISOString()
            };
        }

        const snippet = response.data.items[0].snippet;
        const statistics = response.data.items[0].statistics;

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            videoId: videoId,
            title: snippet.title,
            description: snippet.description,
            channelId: snippet.channelId,
            channelTitle: snippet.channelTitle,
            thumbnails: Object.entries(snippet.thumbnails).map(([quality, data]) => ({ quality, ...data })),
            tags: snippet.tags || [],
            publishedAt: snippet.publishedAt,
            publishedFormat: format_date(snippet.publishedAt),
            statistics: {
                viewCount: statistics.viewCount || 0,
                likeCount: statistics.likeCount || 0,
                commentCount: statistics.commentCount || 0
            }
        };
    } catch (error) {
        console.error("Metadata error:", error);
        return { 
            success: false, 
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

async function ytChannel(input) {
    try {
        const searchResults = await yts(input);

        if (searchResults.channels && searchResults.channels.length > 0) {
            const channel = searchResults.channels[0];
            return {
                success: true,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                timestamp: new Date().toISOString(),
                channelId: channel.channelId,
                name: channel.name,
                url: channel.url,
                thumbnail: channel.thumbnail,
                description: channel.description,
                videoCount: channel.videoCount,
                subscriberCount: channel.subscriberCount
            };
        }

        return { 
            success: false, 
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: 'Channel not found. Try searching with @username format',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error("Channel error:", error);
        return { 
            success: false, 
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

async function ytplaymp3(query, quality = 128) {
    try {
        const searchResult = await youtubeSearch(query);

        if (!searchResult.success || searchResult.results.videos.length === 0) {
            return {
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: 'No videos found for query: ' + query,
                timestamp: new Date().toISOString()
            };
        }

        const firstVideo = searchResult.results.videos[0];
        
        const metadataResult = await ytMetadata(firstVideo.url);
        
        const downloadResult = await ytmp3(firstVideo.url, quality);

        if (!downloadResult.success) {
            return {
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: downloadResult.error,
                timestamp: new Date().toISOString()
            };
        }

        const simplifiedMetadata = metadataResult.success ? {
            videoId: metadataResult.videoId,
            title: metadataResult.title,
            description: metadataResult.description,
            channelTitle: metadataResult.channelTitle,
            thumbnail: metadataResult.thumbnails?.find(t => t.quality === "high")?.url || 
                      metadataResult.thumbnails?.[0]?.url,
            url: firstVideo.url,
            publishedAt: metadataResult.publishedAt,
            publishedFormat: metadataResult.publishedFormat,
            duration: firstVideo.duration,
            statistics: {
                viewCount: metadataResult.statistics.viewCount,
                likeCount: metadataResult.statistics.likeCount,
                commentCount: metadataResult.statistics.commentCount
            }
        } : {
            videoId: firstVideo.videoId,
            title: firstVideo.title,
            description: firstVideo.description || '',
            channelTitle: firstVideo.author,
            thumbnail: firstVideo.thumbnail,
            url: firstVideo.url,
            publishedAt: firstVideo.uploaded,
            duration: firstVideo.duration,
            statistics: {
                viewCount: firstVideo.views,
                likeCount: 0,
                commentCount: 0
            }
        };

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            query: query,
            metadata: simplifiedMetadata,
            download: {
                quality: downloadResult.download.quality,
                availableQuality: downloadResult.download.availableQuality,
                url: downloadResult.download.url
            }
        };
    } catch (error) {
        console.error("Ytplaymp3 error:", error);
        return {
            success: false,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

async function ytplaymp4(query, quality = 360) {
    try {
        const searchResult = await youtubeSearch(query);

        if (!searchResult.success || searchResult.results.videos.length === 0) {
            return {
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: 'No videos found for query: ' + query,
                timestamp: new Date().toISOString()
            };
        }

        const firstVideo = searchResult.results.videos[0];
        
        const metadataResult = await ytMetadata(firstVideo.url);
        
        const downloadResult = await ytmp4(firstVideo.url, quality);

        if (!downloadResult.success) {
            return {
                success: false,
                creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
                error: downloadResult.error,
                timestamp: new Date().toISOString()
            };
        }

        const simplifiedMetadata = metadataResult.success ? {
            videoId: metadataResult.videoId,
            title: metadataResult.title,
            description: metadataResult.description,
            channelTitle: metadataResult.channelTitle,
            thumbnail: metadataResult.thumbnails?.find(t => t.quality === "high")?.url || 
                      metadataResult.thumbnails?.[0]?.url,
            url: firstVideo.url,
            publishedAt: metadataResult.publishedAt,
            publishedFormat: metadataResult.publishedFormat,
            duration: firstVideo.duration,
            statistics: {
                viewCount: metadataResult.statistics.viewCount,
                likeCount: metadataResult.statistics.likeCount,
                commentCount: metadataResult.statistics.commentCount
            }
        } : {
            videoId: firstVideo.videoId,
            title: firstVideo.title,
            description: firstVideo.description || '',
            channelTitle: firstVideo.author,
            thumbnail: firstVideo.thumbnail,
            url: firstVideo.url,
            publishedAt: firstVideo.uploaded,
            duration: firstVideo.duration,
            statistics: {
                viewCount: firstVideo.views,
                likeCount: 0,
                commentCount: 0
            }
        };

        return {
            success: true,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            timestamp: new Date().toISOString(),
            query: query,
            metadata: simplifiedMetadata,
            download: {
                quality: downloadResult.download.quality,
                availableQuality: downloadResult.download.availableQuality,
                url: downloadResult.download.url
            }
        };
    } catch (error) {
        console.error("Ytplaymp4 error:", error);
        return {
            success: false,
            creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ===============================
// API ROUTES
// ===============================

// Root endpoint
app.get('/', (req, res) => {
    const data = {
        status: true,
        message: 'YouTube & TikTok Downloader & Search API',
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        version: '3.5.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            download: {
                youtube_audio_v2: '/api/v1/download/youtube/youtube-audiov2?url=URL',
                youtube_audio: '/api/v1/download/youtube/audio?url=URL&quality=128',
                youtube_video: '/api/v1/download/youtube/video?url=URL&quality=360',
                tiktok: '/api/v1/download/tiktok-download?url=TIKTOK_URL',
                tiktok_mp3: '/api/v1/download/tiktokmp3-download?url=TIKTOK_URL'
            },
            play: {
                youtube_audio: '/api/v1/play/youtube/audio?q=QUERY&quality=128',
                youtube_video: '/api/v1/play/youtube/video?q=QUERY&quality=360'
            },
            search: {
                youtube: '/api/v1/search/youtube-search?query=SEARCH_QUERY',
                tiktok: '/api/v1/search/tiktok-search?query=SEARCH_QUERY',
                metadata: '/api/v1/search/metadata?url=VIDEO_URL',
                channel: '/api/v1/search/channel?query=CHANNEL_QUERY'
            },
            tools: {
                top4top: 'POST /api/v1/tools/top4top (form-data: file)'
            },
            status: '/api/v1/status'
        },
        qualityOptions: {
            audio: [92, 128, 256, 320],
            video: [144, 360, 480, 720, 1080]
        }
    };
    formatJsonResponse(res, data);
});

// API Status
app.get('/api/v1/status', (req, res) => {
    const data = {
        status: true,
        message: 'API is running',
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        timestamp: new Date().toISOString(),
        serverTime: format_date(new Date()),
        version: '3.5.0'
    };
    formatJsonResponse(res, data);
});

// ===============================
// TOOLS ENDPOINTS - TOP4TOP
// ===============================

app.get('/api/v1/tools/bypass', async (req, res) => {
    const { url } = req.query;
    if (!url) return errorResponse(res, 400, 'URL parameter is required');

    const result = await bypassShortlink(url);
    if (!result.success) return errorResponse(res, 500, result.message);

    formatJsonResponse(res, {
        success: true,
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        data: result
    });
});

// Top4Top File Upload
app.post('/api/v1/tools/top4top', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return errorResponse(res, 400, 'File is required', {
                example: 'Send POST request with form-data containing file'
            });
        }

        const fileBuffer = req.file.buffer;
        const fileName = req.file.originalname || `file_${Date.now()}`;
        const fileSize = req.file.size;

        // Validasi ukuran file (maks 50MB)
        if (fileSize > 50 * 1024 * 1024) {
            return errorResponse(res, 400, 'File size too large. Maximum 50MB allowed');
        }

        // Log untuk debugging
        console.log(`Processing file: ${fileName} (${fileSize} bytes)`);

        const result = await top4top(fileBuffer, fileName);

        if (!result || !result.success) {
            return errorResponse(res, 500, 'Failed to upload file to Top4Top', {
                error: result?.error || 'Unknown error'
            });
        }

        formatJsonResponse(res, result);
    } catch (error) {
        console.error('Top4Top endpoint error:', error);
        errorResponse(res, 500, 'Internal server error', {
            error: error.message
        });
    }
});

// ===============================
// TIKTOK ENDPOINTS
// ===============================

// TikTok Search
app.get('/api/v1/search/tiktok-search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return errorResponse(res, 400, 'Parameter query is required', {
                example: '/api/v1/search/tiktok-search?query=trending'
            });
        }

        const result = await tiktokSearchVideo(query);
        
        formatJsonResponse(res, result);
    } catch (error) {
        console.error('TikTok Search endpoint error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
});

// TikTok Video Download (MP4)
app.get('/api/v1/download/tiktok-download', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return errorResponse(res, 400, 'Parameter url is required', {
                example: '/api/v1/download/tiktok-download?url=https://www.tiktok.com/@username/video/1234567890'
            });
        }

        const result = await tiktokMp4(url);
        
        if (!result.success) {
            formatJsonResponse(res, result, 400);
            return;
        }

        formatJsonResponse(res, result);
    } catch (error) {
        console.error('TikTok Download endpoint error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
});

// TikTok MP3 Download
app.get('/api/v1/download/tiktokmp3-download', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return errorResponse(res, 400, 'Parameter url is required', {
                example: '/api/v1/download/tiktokmp3-download?url=https://www.tiktok.com/@username/video/1234567890'
            });
        }

        const result = await tiktokMp3(url);
        
        if (!result.success) {
            formatJsonResponse(res, result, 400);
            return;
        }

        formatJsonResponse(res, result);
    } catch (error) {
        console.error('TikTok MP3 Download endpoint error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
});

// ===============================
// DOWNLOAD ENDPOINTS
// ===============================

// Download YouTube Audio by URL
app.get('/api/v1/download/youtube/audio', async (req, res) => {
    try {
        const { url, quality = 128 } = req.query;

        if (!url) {
            return errorResponse(res, 400, 'Parameter url is required', {
                example: '/api/v1/download/youtube/audio?url=https://youtube.com/watch?v=dQw4w9WgXcQ&quality=128'
            });
        }

        const result = await ytmp3(url, parseInt(quality));
        
        if (!result.success) {
            formatJsonResponse(res, result, 400);
            return;
        }

        formatJsonResponse(res, result);
    } catch (error) {
        console.error('Audio endpoint error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
});

// Download YouTube Video by URL
app.get('/api/v1/download/youtube/video', async (req, res) => {
    try {
        const { url, quality = 360 } = req.query;

        if (!url) {
            return errorResponse(res, 400, 'Parameter url is required', {
                example: '/api/v1/download/youtube/video?url=https://youtube.com/watch?v=dQw4w9WgXcQ&quality=720'
            });
        }

        const result = await ytmp4(url, parseInt(quality));
        
        if (!result.success) {
            formatJsonResponse(res, result, 400);
            return;
        }

        formatJsonResponse(res, result);
    } catch (error) {
        console.error('Video endpoint error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
});

// Play YouTube Audio (Search + Download)
app.get('/api/v1/play/youtube/audio', async (req, res) => {
    try {
        const { q, quality = 128 } = req.query;

        if (!q) {
            return errorResponse(res, 400, 'Parameter q is required', {
                example: '/api/v1/play/youtube/audio?q=music&quality=128'
            });
        }

        const result = await ytplaymp3(q, parseInt(quality));
        
        if (!result.success) {
            formatJsonResponse(res, result, 400);
            return;
        }

        formatJsonResponse(res, result);
    } catch (error) {
        console.error('Play audio endpoint error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
});

// Play YouTube Video (Search + Download)
app.get('/api/v1/play/youtube/video', async (req, res) => {
    try {
        const { q, quality = 360 } = req.query;

        if (!q) {
            return errorResponse(res, 400, 'Parameter q is required', {
                example: '/api/v1/play/youtube/video?q=tutorial&quality=720'
            });
        }

        const result = await ytplaymp4(q, parseInt(quality));
        
        if (!result.success) {
            formatJsonResponse(res, result, 400);
            return;
        }

        formatJsonResponse(res, result);
    } catch (error) {
        console.error('Play video endpoint error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
});

// ===============================
// SEARCH ENDPOINTS
// ===============================

// Search YouTube - ALL results (videos, playlists, channels)
app.get('/api/v1/search/youtube-search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return errorResponse(res, 400, 'Parameter query is required', {
                example: '/api/v1/search/youtube-search?query=music'
            });
        }

        const result = await youtubeSearch(query);
        
        if (!result.success) {
            formatJsonResponse(res, result, 400);
            return;
        }

        formatJsonResponse(res, result);
    } catch (error) {
        console.error('YouTube Search endpoint error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
});

// Get video metadata
app.get('/api/v1/search/metadata', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return errorResponse(res, 400, 'Parameter url is required', {
                example: '/api/v1/search/metadata?url=https://youtube.com/watch?v=dQw4w9WgXcQ'
            });
        }

        const result = await ytMetadata(url);
        
        if (!result.success) {
            formatJsonResponse(res, result, 400);
            return;
        }

        formatJsonResponse(res, result);
    } catch (error) {
        console.error('Metadata endpoint error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
});

// Get channel info
app.get('/api/v1/search/channel', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return errorResponse(res, 400, 'Parameter query is required', {
                example: '/api/v1/search/channel?query=@MrBeast'
            });
        }

        const result = await ytChannel(query);
        
        if (!result.success) {
            formatJsonResponse(res, result, 400);
            return;
        }

        formatJsonResponse(res, result);
    } catch (error) {
        console.error('Channel endpoint error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
});

// ===============================
// UTILITY ENDPOINTS
// ===============================

// Health check
app.get('/api/health', (req, res) => {
    const data = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        version: '3.5.0'
    };
    formatJsonResponse(res, data);
});

// Test endpoint
app.get('/api/test', (req, res) => {
    const data = {
        success: true,
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        version: '3.5.0'
    };
    formatJsonResponse(res, data);
});

// 404 Handler
app.use((req, res) => {
    const data = {
        success: false,
        message: 'Endpoint not found',
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            '/',
            '/api/v1/download/youtube/audio',
            '/api/v1/download/youtube/video',
            '/api/v1/download/tiktok-download',
            '/api/v1/download/tiktokmp3-download',
            '/api/v1/play/youtube/audio',
            '/api/v1/play/youtube/video',
            '/api/v1/search/youtube-search',
            '/api/v1/search/tiktok-search',
            '/api/v1/search/metadata',
            '/api/v1/search/channel',
            '/api/v1/tools/top4top',
            '/api/v1/status',
            '/api/health',
            '/api/test'
        ]
    };
    formatJsonResponse(res, data, 404);
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    const data = {
        success: false,
        message: 'Internal server error',
        creator: '𝐅𝐞𝐛𝐫𝐲-𝐉𝐖⚡',
        timestamp: new Date().toISOString()
    };
    formatJsonResponse(res, data, 500);
});

// Pastikan tidak ada app.listen() di dalam file ini untuk Vercel
module.exports = app;
