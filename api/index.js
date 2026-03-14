// ========== [ IMPORT MODULE ] ==========
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

// ========== [ INISIALISASI APP ] ==========
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// ========== [ FUNGSI EKSTRAK INFO DARI HTML ] ==========
function extractVideoInfo(html) {
  const $ = cheerio.load(html);
  
  // Ekstrak judul video - dari screenshot terlihat judul di h2
  let title = $('h2').first().text() || 
              $('.video-title').text() || 
              $('title').text().replace(' - SSYouTube.online', '');
  
  // Ekstrak durasi - dari screenshot "Duration: 00:01:14"
  let duration = 0;
  const durationText = $('p:contains("Duration")').text() || 
                       $('.duration').text() ||
                       $('body').text().match(/Duration:?\s*(\d{2}:\d{2}:\d{2})/)?.[1] || '';
  
  const durationMatch = durationText.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (durationMatch) {
    duration = parseInt(durationMatch[1]) * 3600 + 
               parseInt(durationMatch[2]) * 60 + 
               parseInt(durationMatch[3]);
  }

  return { title, duration };
}

// ========== [ FUNGSI EKSTRAK NONCE & COOKIE ] ==========
async function extractNonceAndCookie() {
  try {
    // Ambil dari halaman form (id4/youtube-to-mp3-id1)
    const response = await axios.get("https://ssyoutube.online/id4/youtube-to-mp3-id1/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const cookies = response.headers["set-cookie"] || [];
    const cookieString = cookies.map(c => c.split(";")[0]).join("; ");

    const $ = cheerio.load(response.data);
    
    // Cari nonce dari script new-analytics-tracker-js-extra
    let nonce = null;
    const scriptContent = $('script#new-analytics-tracker-js-extra').html();
    if (scriptContent) {
      const match = scriptContent.match(/nonce":"([^"]+)"/);
      if (match) nonce = match[1];
    }

    return { nonce, cookieString };
  } catch (error) {
    console.error("Gagal mengekstrak nonce:", error.message);
    return { nonce: null, cookieString: "" };
  }
}

// ========== [ ENDPOINT UTAMA / ] ==========
app.get("/", (req, res) => {
  res.json({
    status: true,
    author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
    result: {
      message: "YouTube MP3 Downloader (via ssyoutube.online)",
      endpoint: {
        ytmp3: "/api/v1/youtube/ytmp3?url=... (YouTube links only)"
      }
    },
    timestamp: new Date().toISOString(),
    response_time: "0ms"
  });
});

// ========== [ ENDPOINT YTMP3 ] ==========
app.get("/api/v1/youtube/ytmp3", async (req, res) => {
  const start = Date.now();
  const cookieJar = { cookies: "" };
  
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        status: false,
        author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
        result: "Parameter 'url' diperlukan",
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }

    // Validasi URL YouTube
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!youtubeRegex.test(url)) {
      return res.status(400).json({
        status: false,
        author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
        result: "URL tidak valid. Hanya YouTube yang didukung",
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`
      });
    }

    // ========== LANGKAH 1: Dapatkan nonce dan cookie dari halaman FORM ==========
    const { nonce, cookieString } = await extractNonceAndCookie();
    cookieJar.cookies = cookieString;
    
    if (!nonce) {
      throw new Error("Gagal mendapatkan nonce dari halaman");
    }

    // ========== LANGKAH 2: Submit URL ke yt-video-detail (seperti mengisi form) ==========
    const formData = new URLSearchParams();
    formData.append("videoURL", url);

    console.log("Submitting URL to yt-video-detail...");
    const submitResponse = await axios.post(
      "https://ssyoutube.online/yt-video-detail/",
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Cookie": cookieJar.cookies,
          "Referer": "https://ssyoutube.online/id4/youtube-to-mp3-id1/"
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      }
    );

    // Update cookie dari response submit
    if (submitResponse.headers["set-cookie"]) {
      const newCookies = submitResponse.headers["set-cookie"].map(c => c.split(";")[0]).join("; ");
      cookieJar.cookies = cookieJar.cookies ? `${cookieJar.cookies}; ${newCookies}` : newCookies;
    }

    // ========== LANGKAH 3: Sekarang kita di halaman yt-video-detail ==========
    // Ekstrak judul dan durasi dari halaman hasil
    const videoInfo = extractVideoInfo(submitResponse.data);
    console.log("Video Info:", videoInfo);

    // ========== LANGKAH 4: Minta URL download via admin-ajax.php ==========
    console.log("Requesting download URL...");
    const ajaxResponse = await axios.post(
      "https://ssyoutube.online/wp-admin/admin-ajax.php",
      new URLSearchParams({
        action: "new_analytics_track",
        nonce: nonce,
        quality: "MP3",
        quality_version: "0-100 MB"
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Cookie": cookieJar.cookies,
          "Referer": "https://ssyoutube.online/yt-video-detail/",
          "X-Requested-With": "XMLHttpRequest"
        }
      }
    );

    // Update cookie
    if (ajaxResponse.headers["set-cookie"]) {
      const newCookies = ajaxResponse.headers["set-cookie"].map(c => c.split(";")[0]).join("; ");
      cookieJar.cookies = `${cookieJar.cookies}; ${newCookies}`;
    }

    // ========== LANGKAH 5: Dapatkan tunnel URL final ==========
    console.log("Getting tunnel URL...");
    const tunnelResponse = await axios.post(
      "https://ssyoutube.online/wp-admin/admin-ajax.php",
      new URLSearchParams({
        action: "new_analytics_track",
        nonce: nonce
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Cookie": cookieJar.cookies,
          "Referer": "https://ssyoutube.online/yt-video-detail/",
          "X-Requested-With": "XMLHttpRequest"
        }
      }
    );

    const tunnelData = tunnelResponse.data;
    console.log("Tunnel response:", tunnelData);
    
    if (!tunnelData.success || !tunnelData.data) {
      throw new Error(tunnelData.data?.error || "Gagal mendapatkan URL download");
    }

    // ========== SUSUN RESPONS ==========
    const downloadUrl = tunnelData.data.url || tunnelData.data.proxiedUrl;
    const filename = tunnelData.data.filename || "audio.mp3";
    const title = videoInfo.title || filename.replace(/\.mp3$/, "").replace(/\s*\(youtube\)\s*$/, "");
    const duration = videoInfo.duration || tunnelData.data.duration || 0;

    const result = {
      status: true,
      author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
      result: {
        title: title,
        filename: filename,
        duration: duration,
        url: downloadUrl,
        format: "mp3",
        quality: "128kbps"
      },
      timestamp: new Date().toISOString(),
      response_time: `${Date.now() - start}ms`
    };

    res.json(result);

  } catch (error) {
    console.error("ytmp3 error:", error.response?.data || error.message);
    
    res.status(500).json({
      status: false,
      author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
      result: error.message || "Terjadi kesalahan saat memproses permintaan",
      timestamp: new Date().toISOString(),
      response_time: `${Date.now() - start}ms`
    });
  }
});

// ========== [ EXPORT MODULE ] ==========
module.exports = app;