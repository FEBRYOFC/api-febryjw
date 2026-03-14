const express = require("express")
const cors = require("cors")
const axios = require("axios")
const crypto = require("crypto")
const yts = require("yt-search")

const app = express()

app.use(cors())
app.use(express.json())

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
 })

}

// ================= DETECTION =================

function detectOS(ua){

 ua = ua.toLowerCase()

 if(ua.includes("android")) return "Android"
 if(ua.includes("iphone")) return "iOS"
 if(ua.includes("windows")) return "Windows"
 if(ua.includes("mac")) return "MacOS"
 if(ua.includes("linux")) return "Linux"

 return "Unknown"

}

function detectBrowser(ua){

 ua = ua.toLowerCase()

 if(ua.includes("chrome")) return "Chrome"
 if(ua.includes("firefox")) return "Firefox"
 if(ua.includes("safari") && !ua.includes("chrome")) return "Safari"
 if(ua.includes("edge")) return "Edge"

 return "Unknown"

}

function detectBot(ua){

 ua = ua.toLowerCase()

 const bots = [
  "bot",
  "crawler",
  "spider",
  "curl",
  "wget",
  "python",
  "node-fetch"
 ]

 return bots.some(x => ua.includes(x))

}

function tipeJaringan(data){

 if(data.hosting) return "Datacenter / Server"
 if(data.mobile) return "Mobile Network"
 if(data.proxy) return "Kemungkinan VPN / Proxy"

 return "Home ISP"

}

// ================= CDN CACHE =================

let CDN_CACHE = null
let CDN_TIME = 0

// ================= SAVETUBE =================

class Savetube{

 constructor(){

  this.key = "C5D58EF67A7584E4A29F6C35BBC4EB12"

  this.headers = {
   "content-type":"application/json",
   "origin":"https://yt.savetube.vip",
   "user-agent":"Mozilla/5.0"
  }

  this.regex = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/

 }

 async decrypt(enc){

  const sr = Buffer.from(enc,"base64")
  const key = Buffer.from(this.key,"hex")

  const iv = sr.slice(0,16)
  const data = sr.slice(16)

  const decipher = crypto.createDecipheriv("aes-128-cbc",key,iv)

  const decrypted = Buffer.concat([
   decipher.update(data),
   decipher.final()
  ])

  return JSON.parse(decrypted.toString())

 }

 async getCdn(){

  if(CDN_CACHE && Date.now() - CDN_TIME < 300000){
   return CDN_CACHE
  }

  const res = await axios.get(
   "https://media.savetube.vip/api/random-cdn"
  )

  CDN_CACHE = res.data.cdn
  CDN_TIME = Date.now()

  return CDN_CACHE

 }

 async download(url,format="mp3"){

  const id = url.match(this.regex)?.[3]

  if(!id) throw new Error("URL youtube tidak valid")

  const cdn = await this.getCdn()

  const info = await axios.post(
   `https://${cdn}/v2/info`,
   {url:`https://www.youtube.com/watch?v=${id}`},
   {headers:this.headers}
  )

  const dec = await this.decrypt(info.data.data)

  const dl = await axios.post(
   `https://${cdn}/download`,
   {
    id:id,
    downloadType: format === "mp3" ? "audio" : "video",
    quality: format === "mp3" ? "128" : format,
    key: dec.key
   },
   {headers:this.headers}
  )

  return{

   title:dec.title,
   format:format,
   thumbnail:dec.thumbnail || `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
   duration:dec.duration,
   url:dl.data.data.downloadUrl

  }

 }

}

const savetube = new Savetube()

// ================= ROOT =================

app.get("/",(req,res)=>{

 res.json({

  creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",

  endpoints:{
   play:"/api/v1/youtube/yeteplay?query=lagu",
   mp3:"/api/v1/youtube/ytmp3?url=youtube_url",
   mp4:"/api/v1/youtube/ytmp4?url=youtube_url&resolusi=720",
   lacak_self:"/api/v1/lacak",
   lacak_ip:"/api/v1/lacak?ip=8.8.8.8"
  }

 })

})

// ================= LACAK IP =================

app.get("/api/v1/lacak", async(req,res)=>{

 try{

  const ipQuery = req.query.ip

  const ip =
   ipQuery ||
   req.headers["x-forwarded-for"]?.split(",")[0] ||
   req.socket.remoteAddress ||
   ""

  const ua = req.headers["user-agent"] || "unknown"

  const api = await axios.get(
   `http://ip-api.com/json/${ip}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,offset,currency,isp,org,as,asname,reverse,mobile,proxy,hosting,query`
  )

  const g = api.data

  const maps = `https://www.google.com/maps?q=${g.lat},${g.lon}`

  res.json({

   waktu_indonesia:waktuIndonesia(),
   status:true,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",

   respon_data:{

    ip:g.query,

    lokasi:{
     benua:g.continent,
     negara:g.country,
     provinsi:g.regionName,
     kota:g.city,
     kode_pos:g.zip
    },

    koordinat:{
     latitude:g.lat,
     longitude:g.lon,
     google_maps:maps
    },

    jaringan:{
     isp:g.isp,
     organisasi:g.org,
     as:g.as,
     as_name:g.asname,
     tipe:tipeJaringan(g),
     mobile_network:g.mobile,
     vpn_proxy:g.proxy,
     hosting:g.hosting
    },

    sistem:{
     os:detectOS(ua),
     browser:detectBrowser(ua),
     bot_request:detectBot(ua),
     user_agent:ua
    },

    waktu:{
     timezone:g.timezone,
     offset:g.offset
    }

   }

  })

 }catch(e){

  res.json({

   waktu_indonesia:waktuIndonesia(),
   status:false,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
   respon_data:e.message

  })

 }

})

// ================= YOUTUBE PLAY =================

app.get("/api/v1/youtube/yeteplay", async(req,res)=>{

 try{

  const {query} = req.query

  if(!query) throw new Error("query diperlukan")

  const search = await yts(query)

  const video = search.videos[0]

  const data = await savetube.download(video.url,"mp3")

  res.json({

   waktu_indonesia:waktuIndonesia(),
   status:true,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",

   respon_data:{
    title:video.title,
    duration:video.seconds,
    thumbnail:video.thumbnail,
    url:data.url
   }

  })

 }catch(e){

  res.json({
   waktu_indonesia:waktuIndonesia(),
   status:false,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
   respon_data:e.message
  })

 }

})

// ================= YTMP3 =================

app.get("/api/v1/youtube/ytmp3", async(req,res)=>{

 try{

  const {url} = req.query

  if(!url) throw new Error("url diperlukan")

  const data = await savetube.download(url,"mp3")

  res.json({

   waktu_indonesia:waktuIndonesia(),
   status:true,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",

   respon_data:data

  })

 }catch(e){

  res.json({
   waktu_indonesia:waktuIndonesia(),
   status:false,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
   respon_data:e.message
  })

 }

})

// ================= YTMP4 =================

app.get("/api/v1/youtube/ytmp4", async(req,res)=>{

 try{

  const {url,resolusi} = req.query

  if(!url) throw new Error("url diperlukan")

  const quality = resolusi || "720"

  const data = await savetube.download(url,quality)

  res.json({

   waktu_indonesia:waktuIndonesia(),
   status:true,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",

   respon_data:data

  })

 }catch(e){

  res.json({
   waktu_indonesia:waktuIndonesia(),
   status:false,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
   respon_data:e.message
  })

 }

})

module.exports = app