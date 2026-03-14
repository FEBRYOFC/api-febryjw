// ========== [ IMPORT MODULE ] ==========
const express = require("express");
const cors = require("cors");
const axios = require("axios");

// ========== [ INISIALISASI APP ] ==========
const app = express();
app.use(cors());
app.use(express.json());

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
    second: "2-digit",
  });
}

// ========== [ ENDPOINT UTAMA / ] ==========
app.get("/", (req, res) => {
  res.json({
    status: true,
    author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
    message: "Multi-platform Downloader (TikTok & YouTube)",
    endpoint: {
      download: "/api/v1/all-in-one-downloader?url=... (supports TikTok & YouTube links)",
    },
    timestamp: new Date().toISOString(),
  });
});

// ========== [ ENDPOINT ALL-IN-ONE DOWNLOADER ] ==========
app.get("/api/v1/all-in-one-downloader", async (req, res) => {
  const start = Date.now();
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({
        status: false,
        author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
        error: "Parameter 'url' diperlukan",
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`,
      });
    }

    // Panggil API downr.org
    const downrRes = await axios.post(
      "https://downr.org/.netlify/functions/nyt",
      { url },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000, // 15 detik timeout
      }
    );

    const data = downrRes.data;

    // Periksa apakah ada error dari downr.org
    if (data.error) {
      return res.status(400).json({
        status: false,
        author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
        error: data.error,
        timestamp: new Date().toISOString(),
        response_time: `${Date.now() - start}ms`,
      });
    }

    // Susun respons yang rapi
    const response = {
      status: true,
      author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
      result: {
        source: data.source || "unknown",
        id: data.id || null,
        unique_id: data.unique_id || null,
        author: data.author || null,
        title: data.title || null,
        thumbnail: data.thumbnail || null,
        duration: data.duration || null,
        medias: data.medias || [], // array format media
      },
      timestamp: new Date().toISOString(),
      response_time: `${Date.now() - start}ms`,
    };

    res.json(response);
  } catch (error) {
    console.error("Download error:", error.message);
    res.status(500).json({
      status: false,
      author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
      error: error.message,
      timestamp: new Date().toISOString(),
      response_time: `${Date.now() - start}ms`,
    });
  }
});

// ========== [ EXPORT MODULE ] ==========
module.exports = app;