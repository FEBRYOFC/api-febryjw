// api/index.js
const express = require('express');
const cors = require('cors');
const yts = require('yt-search');

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

// ============= MENDAPATKAN TOKEN CAPTCHA =============
async function getCaptchaToken() {
    try {
        // 1. Akses halaman utama untuk mendapatkan cookies dan session
        const homeResponse = await fetch('https://ezconv.cc/7ckh', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // Ambil cookies dari response (penting untuk session)
        const cookies = homeResponse.headers.get('set-cookie') || '';
        
        // 2. Dapatkan HTML untuk mengekstrak sitekey (jika diperlukan)
        const html = await homeResponse.text();
        
        // 3. Request ke challenge platform untuk mendapatkan token
        // URL challenge bisa berbeda-beda, ini contoh dari data yang Anda berikan
        const challengeResponse = await fetch('https://ezconv.cc/cdn-cgi/challenge-platform/h/g/rc/9dc15e05ed5f55c9', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                // Data ini bisa berbeda, Anda perlu menyesuaikan
                secondaryToken: "0.sgmyzI05ashInzvlmzopH8MqzVvgK5sYzKSn346KWTBbz7khtVP_kCx_WhMPput5NC1tcW9SS60nhtoJt2R2HRCfAmZkkSXMlru1kX7mp0NVg01U9E_VUHYPjfgUHdtsn7EUHwJUdtJCZMu-ZnKqdyn9YSNws5KL7H5Fll788sY1-EOHlI9CGXXdtuGbRMhZCdZt21akUHruV77xrY-0H-519MDz7O4bnrEfPTjsvIEZYXtUEzgDD-W1wQ6Z3bpD1FqEqZU3-GWwrePR56T6n8WOtBlVCZzbgs6dLKMfdsLyB3Ki-M5pqd-pAjyikkXzmQGJ0rJ4MiC4Z1E-iAKqYGuKd_09Lei9qaYvBSyyrXJZiLkK93gPxfBXyax9cE7OdST8kyvQJRX03UCUgakB_y21KMcpCRjHUgojezYRd-yn73AXwTa0MPtU7WBoZr4QQO10fjhgvXEq6NBTL8sBJcqJVScQGmGocEWGqfPfTXTARzo2JUzhirze_BifNiXkC4cNTOtMn9JMwWtsaYLG2iCdiC32oe4RpFFMqSc4sL3h-SJgg4ySZLlldpvRF0VOkVDKQJ_h1hgJO59VAaWLd-JbhrhZSKYZPLeKrZR-c1As0jEVIrW9V_PPcEtTJoP8wCS4HHo-f2gNJTk5XarRAc4BTYlKDX3r6Xtf1d5Ff42rnQqsEyRibnqcUiyjmFNyUAcWLadm28U3OzIzl-L1SgZkhsV71z8TRS09gNPDC6ApLlwhFq9PiLogTTqmb5VwsjjwM-3j6dtGNPCWZXMtTy4vlQBtdKNJdwR9iEt4Jo2rn36zmvv_Pe4zQZ1ze6Qlv4H8Y1Ie0kRzhVE7XZoavqe-weTsg_0e4l0dgAOuTdlP31bmfEU1PbsTLzt1FlhK.UHzS_ZZUI7S27McXLoZZPg.50a0fde2f6f664dce9366be3509bd6613a6f903c0a8cf2d2a52f2ab80a7633c0",
                sitekey: "0x4AAAAAAAi2NuZzwS99-7op"
            })
        });

        // Response challenge biasanya berupa token atau sukses
        // Dari data Anda, response-nya adalah 200 dengan content-length 0
        // Mungkin token disimpan di cookies atau headers
        
        // 4. Dapatkan token captcha dari cookies atau response
        // Token biasanya ada di cookies dengan nama tertentu
        const tokenMatch = cookies.match(/captcha_token=([^;]+)/);
        if (tokenMatch) {
            return tokenMatch[1];
        }

        // Jika tidak ada, mungkin perlu pendekatan lain
        // Alternatif: extract dari HTML atau dari response challenge
        const challengeData = await challengeResponse.text();
        console.log('Challenge response:', challengeData);

        // Fallback: gunakan token yang sudah ada (tapi ini akan kadaluarsa)
        return "0.sE_HOpvqB28EiNxixDaC4Sb_lssoYQH0YLtLOBmIBm7NsQGIz1YG8J1PhJdOf12n7cH67dsPGWwmuyaHQQhf5Yd8emkhll_YR79tZjsMRrrRwhfjA3HSlfkMh12cDYk5toyT0RdnFhK5tTho7UUikek0yVpwqwTo4OqU1h2F5KdvegsdFDEQI8wR73i2vwLXA0pg80NHZUcnvB4XyeLL2VdpJsOu-NEKfDIyR_PXaSHRHN2I_AfYLFSMgLwXpZEirMZV7hRj3eXMN5OqeGZx-pso3hMBls8Ol4Fqq9Q46Tn1v-zu_Utq6IlmDsj8GEO4rNhZOWeaIhpmrNir9LrKRhhbRDpa97Z3rxg9ydg1cUXg-HpbAlzh0QU3ztNrwGnRkptjEm7T1HBfifgjAbQ7vXCzopUe3P3CskOnLjIy3YMWYBLrDI0zoCDd7rtzRNT2i0q1nahnU4EAluK1OLRkGblNiThdGotCTE6emnX0b4z-zxi4y_K75jfvKS2PV60cZnDxvw56GWc7gnw4PBsQZjK6MrfqOBiqS-RORE8k6Piz70Tc0-b7lt_vPHaEeoXQhKKkkGUefvyxOMGZ5P1RXVv_NG12X_HI2D93CNlFsYWIAdwi-mMY1YfLqvuLDDL32dNA7IVaaolXUC0NrErXpzj3NSZMS5HiWlMFIxFPONq8k_-stJuK3SA5B6qk46aFBVez40qSaizH0GuDIvQbQTIjCCiBaISo9EnTILR9EJmGOM5oqJg_1BYFN6NdDyNpPvtlontAyr-3TmhpSqJasvSuI4Npy7m6PmPJpL551hdvytT6Pm2a3Qrb5YvnNlf_o2B-ILBUzCWLHCBmrzuGyxIQGqIwMJQJVrg79_5mj5VOrZwZEhP5n1qJCRg46DHl.s7TGhdkXFtzvF0Hg0yOkPA.af0ee148cb685916720a90c66cfdda5f0c851a74ee634652b66e48ede076af44";
    } catch (error) {
        console.error('Error getting captcha token:', error);
        return null;
    }
}

// ============= EZSRV DOWNLOADER DENGAN TOKEN DINAMIS =============
async function ezsrvDownload(link, quality = 128) {
    try {
        // Dapatkan token captcha terbaru
        const captchaToken = await getCaptchaToken();
        if (!captchaToken) {
            return { status: false, message: "Gagal mendapatkan token captcha" };
        }

        console.log('Using token:', captchaToken.substring(0, 50) + '...');

        const response = await fetch("https://ds1.ezsrv.net/api/convert", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                url: link,
                quality: quality,
                trim: false,
                startT: 0,
                endT: 0,
                captchaToken: captchaToken
            })
        });

        const data = await response.json();
        console.log('ezsrv response:', JSON.stringify(data, null, 2));

        if (data.status === "done" && data.url) {
            return {
                status: true,
                url: data.url,
                title: data.title || "Unknown Title",
                quality: quality + "kbps"
            };
        } else {
            return { 
                status: false, 
                message: data.message || "Gagal mendapatkan URL dari ezsrv",
                detail: data
            };
        }
    } catch (error) {
        console.error("ezsrv error:", error);
        return { status: false, message: error.message };
    }
}

// ============= ENDPOINTS =============
app.get('/', (req, res) => {
    res.json({
        name: "YouTube Audio Downloader API",
        version: "v3",
        description: "Menggunakan ezsrv.net dengan token dinamis dari ezconv.cc",
        endpoints: {
            audio: "/api/v1/youtube/audio?url={youtube_url}",
            playmp3: "/api/v1/youtube/ytplaymp3?query={keyword}"
        },
        quality: "128kbps (fixed)"
    });
});

// Download berdasarkan URL
app.get('/api/v1/youtube/audio', async (req, res) => {
    const { url, quality = 128 } = req.query;
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

        const download = await ezsrvDownload(videoUrl, parseInt(quality));
        if (!download.status) {
            return res.status(500).json({ 
                status: false, 
                message: download.message,
                detail: download.detail 
            });
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
    const { query, quality = 128 } = req.query;
    if (!query) {
        return res.status(400).json({ status: false, message: "Parameter 'query' wajib diisi" });
    }

    try {
        const search = await yts(query);
        if (!search.all || search.all.length === 0) {
            return res.status(404).json({ status: false, message: "Video tidak ditemukan" });
        }

        const first = search.all[0];
        
        const download = await ezsrvDownload(first.url, parseInt(quality));
        if (!download.status) {
            return res.status(500).json({ 
                status: false, 
                message: download.message,
                detail: download.detail 
            });
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