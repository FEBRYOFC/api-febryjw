// /api/index.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");

const app = express();

app.use(cors());
app.use(express.json());

// --------- Basic request logger (helps debugging in Vercel logs) ----------
app.use((req, res, next) => {
  const t = new Date().toISOString();
  console.log(`[REQ] ${t} ${req.method} ${req.url} ip=${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
  next();
});

// ================= WAKTU INDONESIA =================
function waktuIndonesia(){
  return new Date().toLocaleString("id-ID",{
    timeZone:"Asia/Jakarta",
    weekday:"long",
    day:"numeric",
    month:"long",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit",
    second:"2-digit"
  });
}

function sendResponse(res,start,result,status=true){
  const end = Date.now();
  // standard wrapper
  res.json({
    waktu_indonesia: waktuIndonesia(),
    status: status,
    creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
    result: result,
    timestamp: new Date().toISOString(),
    response_time: `${end-start}ms`
  });
}

// ================= DETECTION =================
function detectOS(ua){
  ua = (ua || "").toLowerCase();
  if(ua.includes("android")) return "Android";
  if(ua.includes("iphone")) return "iOS";
  if(ua.includes("windows")) return "Windows";
  if(ua.includes("mac")) return "MacOS";
  if(ua.includes("linux")) return "Linux";
  return "Unknown";
}

function detectBrowser(ua){
  ua = (ua || "").toLowerCase();
  if(ua.includes("chrome")) return "Chrome";
  if(ua.includes("firefox")) return "Firefox";
  if(ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  if(ua.includes("edge")) return "Edge";
  return "Unknown";
}

function detectBot(ua){
  ua = (ua || "").toLowerCase();
  const bots = ["bot","crawler","spider","curl","wget","python","node-fetch"];
  return bots.some(x => ua.includes(x));
}

function tipeJaringan(data){
  if(!data) return "Unknown";
  if(data.hosting) return "Datacenter / Server";
  if(data.mobile) return "Mobile Network";
  if(data.proxy) return "Kemungkinan VPN / Proxy";
  return "Home ISP";
}

// ================= CDN CACHE =================
let CDN_CACHE = null;
let CDN_TIME = 0;

// small helper: axios with retry (2 tries)
async function axiosRetry(config, retries = 1) {
  try {
    return await axios(config);
  } catch (err) {
    if (retries > 0) {
      console.warn('[axiosRetry] retrying...', config.url);
      return axiosRetry(config, retries - 1);
    }
    throw err;
  }
}

// ================= SAVETUBE =================
class Savetube {
  constructor() {
    this.key = "C5D58EF67A7584E4A29F6C35BBC4EB12";
    this.headers = {
      "content-type":"application/json",
      "origin":"https://yt.savetube.vip",
      "user-agent":"Mozilla/5.0"
    };
    this.regex = /(?:v=|\/)([a-zA-Z0-9_-]{11})/; // more permissive, capture 11 chars
    // if you prefer original, you can restore the previous regex
  }

  async decrypt(enc){
    try {
      const sr = Buffer.from(enc,"base64");
      const key = Buffer.from(this.key,"hex");
      const iv = sr.slice(0,16);
      const data = sr.slice(16);
      const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      return JSON.parse(decrypted.toString());
    } catch (err) {
      throw new Error("decrypt_failed: " + (err.message || err));
    }
  }

  async getCdn(){
    try {
      if(CDN_CACHE && Date.now() - CDN_TIME < 3 * 60 * 1000) { // 3 minutes cache
        return CDN_CACHE;
      }
      const res = await axiosRetry({ method: "get", url: "https://media.savetube.vip/api/random-cdn", timeout: 5000 }, 1);
      if (res && res.data && res.data.cdn) {
        CDN_CACHE = res.data.cdn;
        CDN_TIME = Date.now();
        return CDN_CACHE;
      }
      // fallback if structure unexpected
      return "cdn403.savetube.vip";
    } catch (err) {
      console.warn("[getCdn] fallback used:", err.message);
      return "cdn403.savetube.vip";
    }
  }

  extractId(url){
    if(!url || typeof url !== "string") return null;
    // normalize youtu.be/xxx and full urls and query params
    // remove params then extract last 11-char token
    try {
      const cleaned = url.split(/[?&]/)[0];
      // try to find 11-char id
      const m = cleaned.match(/[A-Za-z0-9_-]{11}/g);
      if (m && m.length) return m[m.length - 1];
      // fallback to regex
      const alt = cleaned.match(this.regex);
      return alt ? alt[1] : null;
    } catch {
      return null;
    }
  }

  async download(url, format = "mp3"){
    const id = this.extractId(url);
    if(!id) throw new Error("URL youtube tidak valid");

    const cdn = await this.getCdn();

    // fetch info
    let info;
    try {
      info = await axiosRetry({
        method: "post",
        url: `https://${cdn}/v2/info`,
        data: { url: `https://www.youtube.com/watch?v=${id}` },
        headers: this.headers,
        timeout: 10000
      }, 1);
    } catch (err) {
      throw new Error("failed_fetch_info: " + (err.message || err));
    }

    if (!info || !info.data || !info.data.data) {
      throw new Error("Gagal mengambil data video (empty info)");
    }

    let dec;
    try {
      dec = await this.decrypt(info.data.data);
    } catch (err) {
      throw new Error("decrypt_info_failed: " + (err.message || err));
    }

    // download request
    let dl;
    try {
      dl = await axiosRetry({
        method: "post",
        url: `https://${cdn}/download`,
        data: {
          id: id,
          downloadType: format === "mp3" ? "audio" : "video",
          quality: format === "mp3" ? "128" : format,
          key: dec.key
        },
        headers: this.headers,
        timeout: 10000
      }, 1);
    } catch (err) {
      throw new Error("failed_fetch_download: " + (err.message || err));
    }

    if (!dl || !dl.data || !dl.data.data || !dl.data.data.downloadUrl) {
      throw new Error("Gagal mengambil link download (empty download)");
    }

    return {
      title: dec.title,
      format: format,
      thumbnail: dec.thumbnail || `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
      duration: dec.duration,
      url: dl.data.data.downloadUrl
    };
  }
}

const savetube = new Savetube();

// ================= ROOT =================
app.get("/", (req, res) => {
  res.json({
    creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
    endpoints: {
      play: "/api/v1/youtube/yeteplay?query=lagu",
      mp3: "/api/v1/youtube/ytmp3?url=youtube_url",
      mp4: "/api/v1/youtube/ytmp4?url=youtube_url&resolusi=720",
      lacak_self: "/api/v1/lacak",
      lacak_ip: "/api/v1/lacak?ip=8.8.8.8"
    }
  });
});

// ================= LACAK IP =================
app.get("/api/v1/lacak", async (req, res) => {
  const start = Date.now();
  try {
    const ipQuery = req.query.ip;
    const ip = ipQuery || req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "";
    const ua = req.headers["user-agent"] || "unknown";

    const api = await axiosRetry({
      method: "get",
      url: `http://ip-api.com/json/${ip}`,
      timeout: 5000
    }, 1);

    const g = api.data || {};
    const maps = (g.lat && g.lon) ? `https://www.google.com/maps?q=${g.lat},${g.lon}` : null;

    sendResponse(res, start, {
      ip: g.query || ip,
      lokasi: {
        negara: g.country || null,
        provinsi: g.regionName || null,
        kota: g.city || null
      },
      koordinat: {
        latitude: g.lat || null,
        longitude: g.lon || null,
        google_maps: maps
      },
      jaringan: {
        isp: g.isp || null,
        organisasi: g.org || null,
        tipe: tipeJaringan(g)
      },
      sistem: {
        os: detectOS(ua),
        browser: detectBrowser(ua),
        bot_request: detectBot(ua)
      }
    }, true);
  } catch (e) {
    console.error("[/lacak] error:", e && e.message ? e.message : e);
    sendResponse(res, start, { error: e.message || String(e) }, false);
  }
});

// ================= YOUTUBE PLAY =================
app.get("/api/v1/youtube/yeteplay", async (req, res) => {
  const start = Date.now();
  try {
    const { query } = req.query;
    if (!query) throw new Error("query diperlukan");
    const search = await yts(query);
    const video = Array.isArray(search?.videos) ? search.videos[0] : null;
    if (!video) throw new Error("Video tidak ditemukan");
    const data = await savetube.download(video.url, "mp3");
    sendResponse(res, start, {
      title: video.title,
      duration: video.seconds,
      thumbnail: video.thumbnail,
      url: data.url
    }, true);
  } catch (e) {
    console.error("[/yeteplay] error:", e && e.message ? e.message : e);
    sendResponse(res, start, { error: e.message || String(e) }, false);
  }
});

// ================= YTMP3 =================
app.get("/api/v1/youtube/ytmp3", async (req, res) => {
  const start = Date.now();
  try {
    const { url } = req.query;
    if (!url) throw new Error("url diperlukan");
    const data = await savetube.download(url, "mp3");
    sendResponse(res, start, data, true);
  } catch (e) {
    console.error("[/ytmp3] error:", e && e.message ? e.message : e);
    sendResponse(res, start, { error: e.message || String(e) }, false);
  }
});

// ================= YTMP4 =================
app.get("/api/v1/youtube/ytmp4", async (req, res) => {
  const start = Date.now();
  try {
    const { url, resolusi } = req.query;
    if (!url) throw new Error("url diperlukan");
    const quality = resolusi || "720";
    const data = await savetube.download(url, quality);
    sendResponse(res, start, data, true);
  } catch (e) {
    console.error("[/ytmp4] error:", e && e.message ? e.message : e);
    sendResponse(res, start, { error: e.message || String(e) }, false);
  }
});

// ------------- Global error handlers so Vercel doesn't crash silently -------------
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// ===== SERVERLESS EXPORT FOR VERCEL =====
// Vercel will import this file as a function. Export the express app handler.
module.exports = (req, res) => {
  // Important: ensure we handle any top-level sync exceptions
  try {
    return app(req, res);
  } catch (err) {
    console.error('[module export] fatal', err);
    res.status(500).json({ error: 'internal_server_error', detail: String(err) });
  }
};