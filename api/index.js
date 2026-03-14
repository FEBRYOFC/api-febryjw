// api/index.js
const express = require('express');
const cors = require('cors');
const yts = require('yt-search');
const crypto = require('crypto');

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

// ============= DECODE SAVETUBE =============
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

// ============= EZSRV DOWNLOADER (UTAMA) =============
const CAPTCHA_TOKEN = "0.gTx3EWwdD-a4mVSKCcbCbwWeHIbNPiOLyqM_zhvxdcFf5KXomDnPPqBGtU4myAt3uD_EhD6FHpsdcRsSDTNSxjUr6B0yBrEH0hBSh13XwdFv0dMYfnqhw5DNKDWB8Hd6EkhawP9c2mg3eMTi1f6xm7kJZlHmttAbBPoo9pGXDjxwu9DNlO-TnMT2VkpDhZqNcoaQ4-qf4-WvHtcAXsZWTw2-Ndpe14Qb8aM-IfAFea-WHpMNuweEcsMf0fEwbcV9Jsd-U4DeW9_nBx223PjbLDc44DggHuV9qN1Hm4ZUCfwdD3y7lVL8wpPV5Ni0GvRPs4ay1vWkxc6KtOahv3RrjLskiHLRfvsVz_gJVijyYlj5avihCpJTiV4Glnmzxb6VW-C7QaNd4kVoPgT6xm36OSzgdKvBzSJPhLScDhAGTP2f_7cwQnnypq4T2RlQWCK_AK_TVf7fvYDBhHeZrNJpTXBIBibo3r9xiTsVIuKP-B_GBEgQb9E9IwF8s-o2NvE2jgS2t2-y039ee-4LgAQRfhnAa-083vgtbIgeOAv1xy7kIqDD_WvMnuEWXk3kagWJqSGUOpTyHLlKQJXTaRerpELIGq9xMGOr-0tyCNvm1n_OoBTyBSDWvNRjBv4W4aZZaA1kX11j_VFohEovk0guCX__F0O-Td7q9YQu6PU8Fwenw8p1ElWxJ8I_V2ob8FgFdbVq-W-DzvG4_gDA19oDrgJ6ucEdGVSj2NxvVTui3_5DhordNdLph7eCJEOKtJ9ryPvGMpbitxv988-R1fR93mXfc3cmoeTBCO7TqbBw4wa83wGWoKKR-vxmIoxWK6Mh5OmcaZTpPsFx64KSss_pVMz_ezxLMPTiMIPJkW0JRJ5oCWdTfIZazfNijj4araPM.FbzXl1j7uoQU0TLFo2YiBw.5417692ea9ebf0c75ffcf35384fa97c67efc59624644df1eaafd8a3da091d905";

async function ezsrvDownload(link, quality = 128) {
    try {
        const response = await fetch("https://ds1.ezsrv.net/api/convert", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                url: link,
                quality: quality,
                trim: false,
                startT: 0,
                endT: 0,
                captchaToken: CAPTCHA_TOKEN
            })
        });

        const data = await response.json();
        
        if (data.status === "done" && data.url) {
            return {
                status: true,
                url: data.url,
                title: data.title || "Unknown Title",
                quality: quality + "kbps"
            };
        } else {
            return { status: false, message: "ezsrv: Gagal mendapatkan URL" };
        }
    } catch (error) {
        console.error("ezsrv error:", error);
        return { status: false, message: "ezsrv: " + error.message };
    }
}

// ============= SAVETUBE DOWNLOADER (FALLBACK) =============
async function savetubeDownload(link) {
    try {
        const cdnRes = await fetch("https://media.savetube.vip/api/random-cdn", {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
            }
        });
        const { cdn } = await cdnRes.json();

        const infoRes = await fetch(`https://${cdn}/v2/info`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: link })
        });
        const infoData = await infoRes.json();
        const info = decodeData(infoData.data);

        const downRes = await fetch(`https://${cdn}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                downloadType: "audio",
                quality: "128",
                key: info.key
            })
        });
        const downData = await downRes.json();
        const downloadUrl = downData.data.downloadUrl;

        return {
            status: true,
            url: downloadUrl,
            title: info.title,
            quality: "128kbps"
        };
    } catch (error) {
        console.error("savetube error:", error);
        return { status: false, message: "savetube: " + error.message };
    }
}

// ============= ENDPOINTS =============
app.get('/', (req, res) => {
    res.json({
        name: "YouTube Audio Downloader API",
        version: "v2",
        description: "Menggunakan ezsrv.net (utama) dan fallback ke savetube.vip",
        endpoints: {
            audio: "/api/v1/youtube/audio?url={youtube_url}",
            playmp3: "/api/v1/youtube/ytplaymp3?query={keyword}"
        },
        quality: "128kbps (fixed)"
    });
});

// Download berdasarkan URL
app.get('/api/v1/youtube/audio', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ status: false, message: "Parameter 'url' wajib diisi" });
    }

    const id = getYoutubeId(url);
    if (!id) {
        return res.status(400).json({ status: false, message: "URL YouTube tidak valid" });
    }

    try {
        const videoUrl = `https://youtube.com/watch?v=${id}`;
        const metadata = await yts(videoUrl);
        const video = metadata.all[0] || null;

        // Coba ezsrv dulu
        let download = await ezsrvDownload(videoUrl);
        if (!download.status) {
            console.log("ezsrv gagal, fallback ke savetube");
            download = await savetubeDownload(videoUrl);
        }

        if (!download.status) {
            return res.status(500).json({ status: false, message: "Semua sumber download gagal" });
        }

        res.json({
            status: true,
            metadata: video ? {
                title: video.title,
                videoId: video.videoId,
                duration: video.duration,
                thumbnail: video.thumbnail,
                author: video.author?.name
            } : null,
            download: {
                url: download.url,
                title: download.title,
                quality: download.quality
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: "Kesalahan sistem: " + error.message });
    }
});

// Search + download (ytplaymp3)
app.get('/api/v1/youtube/ytplaymp3', async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ status: false, message: "Parameter 'query' wajib diisi" });
    }

    try {
        const search = await yts(query);
        if (!search.all || search.all.length === 0) {
            return res.status(404).json({ status: false, message: "Video tidak ditemukan" });
        }

        const first = search.all[0];
        
        // Coba ezsrv dulu
        let download = await ezsrvDownload(first.url);
        if (!download.status) {
            console.log("ezsrv gagal, fallback ke savetube");
            download = await savetubeDownload(first.url);
        }

        if (!download.status) {
            return res.status(500).json({ status: false, message: "Semua sumber download gagal" });
        }

        res.json({
            status: true,
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
                title: download.title,
                quality: download.quality
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: "Kesalahan sistem: " + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`YouTube Downloader API running on port ${PORT}`);
    console.log(`- Audio:    /api/v1/youtube/audio?url=...`);
    console.log(`- Play MP3: /api/v1/youtube/ytplaymp3?query=...`);
});

module.exports = app;