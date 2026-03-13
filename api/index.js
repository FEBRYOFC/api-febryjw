// api/index.js
const express = require('express');
const cors = require('cors');
const yts = require('yt-search');
const crypto = require('crypto'); // tetap disertakan sesuai permintaan

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============= UTILITY =============
function getYoutubeId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|v\/|embed\/|user\/[^\/\n\s]+\/)?(?:watch\?v=|v%3D|embed%2F|video%2F)?|youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/playlist\?list=)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// ============= FUNGSI DECODE DARI SAVETUBE =============
const decodeData = (enc) => {
    try {
        const secret_key = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
        const data = Buffer.from(enc, 'base64');
        const iv = data.slice(0, 16);
        const content = data.slice(16);
        const key = Buffer.from(secret_key, 'hex');

        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        let decrypted = Buffer.concat([decipher.update(content), decipher.final()]);

        return JSON.parse(decrypted.toString());
    } catch (error) {
        throw new Error(error.message);
    }
};

// ============= VALIDASI URL DENGAN RETRY =============
async function checkUrlWithRetry(url, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) {
                console.log(`✅ URL valid pada percobaan ke-${attempt}`);
                return true;
            }
            console.log(`⏳ Percobaan ${attempt}: URL belum siap (status ${response.status})`);
        } catch (error) {
            console.log(`⚠️ Percobaan ${attempt}: Error saat memeriksa URL - ${error.message}`);
        }

        if (attempt < maxRetries) {
            const waitTime = attempt * 3000; // exponential backoff: 3, 6, 9, 12 detik
            console.log(`🕒 Menunggu ${waitTime / 1000} detik sebelum mencoba lagi...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return false;
}

// ============= FUNGSI DOWNLOAD DARI SAVETUBE =============
async function savetubeDownload(link) {
    try {
        // 1. Dapatkan CDN acak
        const cdnRes = await fetch("https://media.savetube.vip/api/random-cdn", {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'
            }
        });
        const { cdn } = await cdnRes.json();
        console.log(`📡 Menggunakan CDN: ${cdn}`);

        // 2. Dapatkan info video (key)
        const infoRes = await fetch(`https://${cdn}/v2/info`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'
            },
            body: JSON.stringify({ url: link })
        });
        const infoData = await infoRes.json();
        const info = decodeData(infoData.data);

        // 3. Minta URL download (audio 128kbps)
        const downRes = await fetch(`https://${cdn}/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36'
            },
            body: JSON.stringify({
                downloadType: "audio",
                quality: "128",
                key: info.key
            })
        });
        const downData = await downRes.json();
        const downloadUrl = downData.data.downloadUrl;
        console.log(`🔗 Mendapatkan URL: ${downloadUrl}`);

        // 4. Validasi URL dengan retry
        const isValid = await checkUrlWithRetry(downloadUrl);
        if (!isValid) {
            return {
                status: false,
                message: "Gagal mengakses file audio dari server Savetube setelah beberapa kali percobaan. Mungkin video tidak dapat dikonversi atau server sedang sibuk. Silakan coba lagi nanti atau dengan video lain."
            };
        }

        // 5. Sukses
        return {
            status: true,
            url: downloadUrl,
            filename: `${info.title} (128kbps).mp3`,
            title: info.title,
            duration: info.duration
        };
    } catch (error) {
        console.error("❌ Savetube error:", error);
        return {
            status: false,
            message: "Terjadi kesalahan saat memproses permintaan: " + error.message
        };
    }
}

// ============= ENDPOINT UTAMA =============
app.get('/', (req, res) => {
    res.json({
        name: "@𝐅𝐞𝐛𝐫𝐲𝐉𝐖",
        version: "v1 (fixed)",
        description: "YouTube Audio Downloader API (Savetube) dengan validasi tautan",
        author: "FebryJW",
        endpoints: {
            audio: "/api/v1/youtube/audio?url={youtube_url}",
            playmp3: "/api/v1/youtube/ytplaymp3?query={keyword}"
        },
        note: "Kualitas audio tetap 128kbps. Tautan divalidasi sebelum dikembalikan."
    });
});

// Endpoint download berdasarkan URL
app.get('/api/v1/youtube/audio', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ status: false, message: "Parameter 'url' wajib diisi!" });
    }

    const id = getYoutubeId(url);
    if (!id) {
        return res.status(400).json({ status: false, message: "URL YouTube tidak valid!" });
    }

    try {
        const metadata = await yts(`https://youtube.com/watch?v=${id}`);
        const video = metadata.all[0] || null;

        const download = await savetubeDownload(`https://youtube.com/watch?v=${id}`);
        if (!download.status) {
            return res.status(500).json(download);
        }

        res.json({
            status: true,
            creator: "FebryJW 🚀",
            metadata: video ? {
                title: video.title,
                videoId: video.videoId,
                duration: video.duration,
                thumbnail: video.thumbnail,
                author: video.author?.name
            } : null,
            download: {
                url: download.url,
                filename: download.filename,
                title: download.title,
                duration: download.duration,
                quality: "128kbps"
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ status: false, message: "Kesalahan sistem: " + error.message });
    }
});

// Endpoint search + download (ytplaymp3)
app.get('/api/v1/youtube/ytplaymp3', async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ status: false, message: "Parameter 'query' wajib diisi!" });
    }

    try {
        const search = await yts(query);
        if (!search.all || search.all.length === 0) {
            return res.status(404).json({ status: false, message: "Tidak ditemukan video untuk kata kunci tersebut." });
        }

        const first = search.all[0];
        const download = await savetubeDownload(first.url);
        if (!download.status) {
            return res.status(500).json(download);
        }

        res.json({
            status: true,
            creator: "FebryJW 🚀",
            query,
            selected_video: {
                title: first.title,
                videoId: first.videoId,
                url: first.url,
                duration: first.duration,
                thumbnail: first.thumbnail,
                author: first.author?.name
            },
            download: {
                url: download.url,
                filename: download.filename,
                title: download.title,
                duration: download.duration,
                quality: "128kbps"
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ status: false, message: "Kesalahan sistem: " + error.message });
    }
});

// ============= START SERVER =============
app.listen(PORT, () => {
    console.log(`🚀 FebryJW YouTube Downloader API v1 (fixed) running on port ${PORT}`);
    console.log(`   - Audio:    /api/v1/youtube/audio?url=...`);
    console.log(`   - Play MP3: /api/v1/youtube/ytplaymp3?query=...`);
});

module.exports = app;