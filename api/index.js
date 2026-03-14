// ========== [ IMPORT MODULE ] ==========
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const yts = require("yt-search");

// ========== [ INISIALISASI APP ] ==========
const app = express();

app.use(cors());
app.use(express.json());

// ========== [ FUNGSI WAKTU INDONESIA ] ==========
async function waktuIndonesia() 
{
  return new Date().toLocaleString
  (
    "id-ID", 
    {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  );
}

// ========== [ CLASS SAVETUBE (DARI SCRAPE ANDA) ] ==========
class Savetube 
{
  constructor() 
  {
    this.ky = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
    this.hr = 
    {
      'content-type': 'application/json',
      'origin': 'https://yt.savetube.vip',
      'user-agent': 'Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0'
    };
    this.fmt = ['144', '240', '360', '480', '720', '1080', 'mp3'];
    this.m = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/;
  }

  async decrypt(enc) 
  {
    try 
    {
      const [sr, ky] = [Buffer.from(enc, 'base64'), Buffer.from(this.ky, 'hex')];
      const [iv, dt] = [sr.slice(0, 16), sr.slice(16)];
      const dc = crypto.createDecipheriv('aes-128-cbc', ky, iv);
      
      return JSON.parse
      (
        Buffer.concat
        (
          [
            dc.update(dt), 
            dc.final()
          ]
        ).toString()
      );
    } 
    
    catch (e) 
    {
      throw new Error(`Error while decrypting data: ${e.message}`);
    }
  }

  async getCdn() 
  {
    const response = await axios.get
    (
      "https://media.savetube.vip/api/random-cdn", 
      { headers: this.hr }
    );
    
    if (!response.status) return response;
    
    return {
      status: true,
      data: response.data.cdn
    };
  }

  async download(url, format = '1080') 
  {
    const id = url.match(this.m)?.[3];
    
    if (!id) 
    {
      throw new Error("ID cannot be extracted from URL");
    }
    
    if (!format || !this.fmt.includes(format)) 
    {
      throw new Error(`Format not found. Available formats: ${this.fmt.join(', ')}`);
    }
    
    const u = await this.getCdn();
    
    if (!u.status) throw new Error("Failed to fetch CDN");
    
    const res = await axios.post
    (
      `https://${u.data}/v2/info`, 
      {
        url: `https://www.youtube.com/watch?v=${id}`
      }, 
      { headers: this.hr }
    );
    
    const dec = await this.decrypt(res.data.data);
    
    const dl = await axios.post
    (
      `https://${u.data}/download`, 
      {
        id: id,
        downloadType: format === 'mp3' ? 'audio' : 'video',
        quality: format === 'mp3' ? '128' : format,
        key: dec.key
      }, 
      { headers: this.hr }
    );

    return {
      title: dec.title,
      format: format,
      thumbnail: dec.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      duration: dec.duration,
      url: dl.data.data.downloadUrl
    };
  }
}

// ========== [ INSTANCE SAVETUBE ] ==========
const savetube = new Savetube();

// ========== [ FUNGSI DETECTION (UNTUK LACAK IP) ] ==========
async function detectOS(ua) 
{
  ua = ua.toLowerCase();
  
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone")) return "iOS";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac")) return "MacOS";
  if (ua.includes("linux")) return "Linux";
  
  return "Unknown";
}

async function detectBrowser(ua) 
{
  ua = ua.toLowerCase();
  
  if (ua.includes("chrome")) return "Chrome";
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  if (ua.includes("edge")) return "Edge";
  
  return "Unknown";
}

async function detectBot(ua) 
{
  ua = ua.toLowerCase();
  
  const bots = 
  [
    "bot",
    "crawler",
    "spider",
    "curl",
    "wget",
    "python",
    "node-fetch"
  ];
  
  return bots.some((x) => ua.includes(x));
}

async function tipeJaringan(data) 
{
  if (data.hosting) return "Datacenter / Server";
  if (data.mobile) return "Mobile Network";
  if (data.proxy) return "Kemungkinan VPN / Proxy";
  
  return "Home ISP";
}

// ========== [ ENDPOINT ROOT / ] ==========
app.get
(
  "/", 
  async (req, res) => 
  {
    const start = Date.now();
    
    try 
    {
      const waktu = await waktuIndonesia();
      const end = Date.now();
      
      res.json
      (
        {
          status: true,
          author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          result: 
          {
            message: "YouTube Downloader API by FebryJW",
            endpoints: 
            {
              play: "/api/v1/youtube/ytplay?query=lagu",
              mp3: "/api/v1/youtube/ytmp3?url=youtube_url",
              mp4: "/api/v1/youtube/ytmp4?url=youtube_url&resolusi=720",
              lacak_self: "/api/v1/lacak",
              lacak_ip: "/api/v1/lacak?ip=8.8.8.8"
            }
          },
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
    
    catch (error) 
    {
      const end = Date.now();
      
      res.json
      (
        {
          status: false,
          author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          result: error.message,
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
  }
);

// ========== [ ENDPOINT LACAK IP ] ==========
app.get
(
  "/api/v1/lacak", 
  async (req, res) => 
  {
    const start = Date.now();
    
    try 
    {
      const ipQuery = req.query.ip;
      
      const ip = ipQuery || 
                 req.headers["x-forwarded-for"]?.split(",")[0] || 
                 req.socket.remoteAddress || 
                 "";
      
      const ua = req.headers["user-agent"] || "unknown";

      const api = await axios.get
      (
        `http://ip-api.com/json/${ip}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,offset,currency,isp,org,as,asname,reverse,mobile,proxy,hosting,query`,
        { timeout: 8000 }
      );
      
      const g = api.data;
      
      const maps = `https://www.google.com/maps?q=${g.lat},${g.lon}`;

      const waktu = await waktuIndonesia();
      const os = await detectOS(ua);
      const browser = await detectBrowser(ua);
      const bot = await detectBot(ua);
      const jaringan = await tipeJaringan(g);
      
      const end = Date.now();

      res.json
      (
        {
          status: true,
          author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          result: 
          {
            ip: g.query,
            
            lokasi: 
            {
              benua: g.continent,
              negara: g.country,
              provinsi: g.regionName,
              kota: g.city,
              kode_pos: g.zip
            },
            
            koordinat: 
            { 
              latitude: g.lat, 
              longitude: g.lon, 
              google_maps: maps 
            },
            
            jaringan: 
            {
              isp: g.isp,
              organisasi: g.org,
              as: g.as,
              as_name: g.asname,
              tipe: jaringan,
              mobile_network: g.mobile,
              vpn_proxy: g.proxy,
              hosting: g.hosting
            },
            
            sistem: 
            { 
              os: os, 
              browser: browser, 
              bot_request: bot, 
              user_agent: ua 
            },
            
            waktu: 
            { 
              timezone: g.timezone, 
              offset: g.offset 
            }
          },
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
    
    catch (error) 
    {
      const end = Date.now();
      
      res.json
      (
        {
          status: false,
          author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          result: error.message,
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
  }
);

// ========== [ ENDPOINT YTPLAY (SEARCH + MP3) ] ==========
app.get
(
  "/api/v1/youtube/ytplay", 
  async (req, res) => 
  {
    const start = Date.now();
    
    try 
    {
      const { query } = req.query;
      
      if (!query) throw new Error("Parameter 'query' diperlukan");

      const search = await yts(query);
      const video = search.videos[0];
      
      if (!video) throw new Error("Video tidak ditemukan");

      const download = await savetube.download(video.url, "mp3");

      const end = Date.now();

      res.json
      (
        {
          status: true,
          author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          result: 
          {
            title: video.title,
            videoId: video.videoId,
            duration: video.duration,
            thumbnail: video.thumbnail,
            
            download: 
            {
              title: download.title,
              format: download.format,
              duration: download.duration,
              url: download.url
            }
          },
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
    
    catch (error) 
    {
      const end = Date.now();
      
      res.json
      (
        {
          status: false,
          author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          result: error.message,
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
  }
);

// ========== [ ENDPOINT YTMP3 (AUDIO) ] ==========
app.get
(
  "/api/v1/youtube/ytmp3", 
  async (req, res) => 
  {
    const start = Date.now();
    
    try 
    {
      const { url } = req.query;
      
      if (!url) throw new Error("Parameter 'url' diperlukan");

      const download = await savetube.download(url, "mp3");

      const end = Date.now();

      res.json
      (
        {
          status: true,
          author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          result: 
          {
            title: download.title,
            format: download.format,
            thumbnail: download.thumbnail,
            duration: download.duration,
            url: download.url
          },
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
    
    catch (error) 
    {
      const end = Date.now();
      
      res.json
      (
        {
          status: false,
          author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          result: error.message,
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
  }
);

// ========== [ ENDPOINT YTMP4 (VIDEO) ] ==========
app.get
(
  "/api/v1/youtube/ytmp4", 
  async (req, res) => 
  {
    const start = Date.now();
    
    try 
    {
      const { url, resolusi } = req.query;
      
      if (!url) throw new Error("Parameter 'url' diperlukan");

      const quality = resolusi || "720";
      
      const download = await savetube.download(url, quality);

      const end = Date.now();

      res.json
      (
        {
          status: true,
          author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          result: 
          {
            title: download.title,
            format: download.format,
            thumbnail: download.thumbnail,
            duration: download.duration,
            url: download.url
          },
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
    
    catch (error) 
    {
      const end = Date.now();
      
      res.json
      (
        {
          status: false,
          author: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          result: error.message,
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
  }
);

// ========== [ EXPORT MODULE ] ==========
module.exports = app;