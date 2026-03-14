// ========== [ IMPORT MODULE ] ==========
const express = require("express");
const cors = require("cors");
const axios = require("axios");

// ========== [ INISIALISASI APP ] ==========
const app = express();

app.use(cors());
app.use(express.json());

// ========== [ FUNGSI WAKTU INDONESIA ] ==========
function waktuIndonesia() 
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

// ========== [ FUNGSI DETECTION OS ] ==========
function detectOS(ua) 
{
  ua = ua.toLowerCase();
  
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone")) return "iOS";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac")) return "MacOS";
  if (ua.includes("linux")) return "Linux";
  
  return "Unknown";
}

// ========== [ FUNGSI DETECTION BROWSER ] ==========
function detectBrowser(ua) 
{
  ua = ua.toLowerCase();
  
  if (ua.includes("chrome")) return "Chrome";
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  if (ua.includes("edge")) return "Edge";
  
  return "Unknown";
}

// ========== [ FUNGSI DETECTION BOT ] ==========
function detectBot(ua) 
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

// ========== [ FUNGSI TIPE JARINGAN ] ==========
function tipeJaringan(data) 
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
      const end = Date.now();
      
      res.json
      (
        {
          waktu_indonesia: waktuIndonesia(),
          status: true,
          creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          respon_data: 
          {
            message: "API Lacak IP aktif, fitur YouTube download dinonaktifkan sementara",
            endpoints: 
            {
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
          waktu_indonesia: waktuIndonesia(),
          status: false,
          creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          respon_data: error.message,
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

      // ========== [ REQUEST KE IP-API ] ==========
      const api = await axios.get
      (
        `http://ip-api.com/json/${ip}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,offset,currency,isp,org,as,asname,reverse,mobile,proxy,hosting,query`,
        { timeout: 8000 }
      );
      
      const g = api.data;
      
      const maps = `https://www.google.com/maps?q=${g.lat},${g.lon}`;

      const end = Date.now();

      // ========== [ RESPON DATA LACAK ] ==========
      res.json
      (
        {
          waktu_indonesia: waktuIndonesia(),
          status: true,
          creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          respon_data: 
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
              tipe: tipeJaringan(g),
              mobile_network: g.mobile,
              vpn_proxy: g.proxy,
              hosting: g.hosting
            },
            
            sistem: 
            { 
              os: detectOS(ua), 
              browser: detectBrowser(ua), 
              bot_request: detectBot(ua), 
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
      
      // ========== [ HANDLING ERROR LACAK ] ==========
      res.json
      (
        {
          waktu_indonesia: waktuIndonesia(),
          status: false,
          creator: "𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
          respon_data: error.message,
          timestamp: new Date().toISOString(),
          response_time: `${end - start}ms`
        }
      );
    }
  }
);

// ========== [ EXPORT MODULE ] ==========
module.exports = app;