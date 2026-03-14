// ========== [ IMPORT MODULE ] ==========
const express = require("express");
const cors = require("cors");
const axios = require("axios");

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

    // ========== PAKAI ENDPOINT YANG SUDAH TERBUKTI BERHASIL ==========
    // Dari data network: POST ke admin-ajax.php dengan nonce 524cb0966c
    // yang mengembalikan {"success":true,"data":{"proxiedUrl":"https://..."}}
    
    const formData = new URLSearchParams();
    formData.append("action", "new_analytics_track");
    formData.append("nonce", "524cb0966c"); // Pakai nonce yang sudah terbukti work
    formData.append("quality", "MP3");
    formData.append("quality_version", "0-100 MB");

    console.log("Mengirim request ke admin-ajax.php...");
    
    const response = await axios.post(
      "https://ssyoutube.online/wp-admin/admin-ajax.php",
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://ssyoutube.online/yt-video-detail/",
          "X-Requested-With": "XMLHttpRequest"
        }
      }
    );

    console.log("Response status:", response.status);
    console.log("Response data:", JSON.stringify(response.data, null, 2));

    const data = response.data;
    
    if (!data.success || !data.data) {
      throw new Error(data.data?.error || "Gagal mendapatkan URL download");
    }

    // Dari data network, respons bisa berupa:
    // 1. {success: true, data: {proxiedUrl: "https://..."}}
    // 2. {success: true, data: {status: "tunnel", url: "https://...", filename: "...", duration: ...}}
    
    let downloadUrl = data.data.proxiedUrl || data.data.url;
    let filename = data.data.filename || "audio.mp3";
    let title = filename.replace(/\.mp3$/, "").replace(/\s*\(youtube\)\s*$/, "");
    let duration = data.data.duration || 0;

    // Jika ada status tunnel, mungkin perlu request kedua
    if (data.data.status === "tunnel") {
      console.log("Mendapatkan tunnel URL...");
      
      const tunnelResponse = await axios.post(
        "https://ssyoutube.online/wp-admin/admin-ajax.php",
        new URLSearchParams({
          action: "new_analytics_track",
          nonce: "524cb0966c"
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://ssyoutube.online/yt-video-detail/",
            "X-Requested-With": "XMLHttpRequest"
          }
        }
      );
      
      const tunnelData = tunnelResponse.data;
      console.log("Tunnel response:", tunnelData);
      
      if (tunnelData.success && tunnelData.data) {
        downloadUrl = tunnelData.data.url || tunnelData.data.proxiedUrl;
        filename = tunnelData.data.filename || filename;
        title = filename.replace(/\.mp3$/, "").replace(/\s*\(youtube\)\s*$/, "");
        duration = tunnelData.data.duration || duration;
      }
    }

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
    console.error("ERROR DETAILS:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
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