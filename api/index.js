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

// ================= CDN CACHE =================

let CDN_CACHE = null
let CDN_TIME = 0

// ================= SAVETUBE CLASS =================

class Savetube{

 constructor(){

  this.key = "C5D58EF67A7584E4A29F6C35BBC4EB12"

  this.headers = {
   "content-type":"application/json",
   "origin":"https://yt.savetube.vip",
   "user-agent":"Mozilla/5.0"
  }

  this.formats = ["144","240","360","480","720","1080","mp3"]

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
   "https://media.savetube.vip/api/random-cdn",
   {headers:this.headers, timeout:4000}
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
   {headers:this.headers, timeout:6000}
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
   {headers:this.headers, timeout:6000}
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
   lacak:"/api/v1/lacak"
  }

 })

})

// ================= IP TRACKER =================

app.get("/api/v1/lacak", async(req,res)=>{

 try{

  const ip =
   req.headers["x-forwarded-for"]?.split(",")[0] ||
   req.socket.remoteAddress ||
   ""

  const ua = req.headers["user-agent"] || "unknown"

  const api = await axios.get(
   `http://ip-api.com/json/${ip}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,offset,currency,isp,org,as,asname,reverse,mobile,proxy,hosting,query`
  )

  const g = api.data

  res.json({

   waktu_indonesia:waktuIndonesia(),

   status:true,

   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",

   respon_data:{

    ip:g.query,

    benua:g.continent,
    kode_benua:g.continentCode,

    negara:g.country,
    kode_negara:g.countryCode,

    provinsi:g.regionName,
    kode_provinsi:g.region,

    kota:g.city,
    distrik:g.district,
    kode_pos:g.zip,

    latitude:g.lat,
    longitude:g.lon,

    timezone:g.timezone,
    offset:g.offset,

    mata_uang:g.currency,

    isp:g.isp,
    organisasi:g.org,

    as_number:g.as,
    as_name:g.asname,

    reverse_dns:g.reverse,

    mobile_network:g.mobile,
    vpn_proxy:g.proxy,
    hosting:g.hosting,

    user_agent:ua

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

// ================= YETEPLAY =================

app.get("/api/v1/youtube/yeteplay", async(req,res)=>{

 try{

  const {query} = req.query

  if(!query)
   return res.json({
    waktu_indonesia:waktuIndonesia(),
    status:false,
    creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
    respon_data:"query diperlukan"
   })

  const search = await yts(query)

  if(!search.all.length)
   return res.json({
    waktu_indonesia:waktuIndonesia(),
    status:false,
    creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
    respon_data:"video tidak ditemukan"
   })

  const video = search.all[0]

  const data = await savetube.download(video.url,"mp3")

  res.json({

   waktu_indonesia:waktuIndonesia(),
   status:true,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",

   respon_data:{
    title:video.title,
    format:"mp3",
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

  if(!url)
   return res.json({
    waktu_indonesia:waktuIndonesia(),
    status:false,
    creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
    respon_data:"url diperlukan"
   })

  const data = await savetube.download(url,"mp3")

  res.json({

   waktu_indonesia:waktuIndonesia(),
   status:true,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",

   respon_data:{
    title:data.title,
    format:"mp3",
    duration:data.duration,
    thumbnail:data.thumbnail,
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

// ================= YTMP4 =================

app.get("/api/v1/youtube/ytmp4", async(req,res)=>{

 try{

  const {url,resolusi} = req.query

  if(!url)
   return res.json({
    waktu_indonesia:waktuIndonesia(),
    status:false,
    creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",
    respon_data:"url diperlukan"
   })

  const quality = resolusi || "720"

  const data = await savetube.download(url,quality)

  res.json({

   waktu_indonesia:waktuIndonesia(),
   status:true,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",

   respon_data:{
    title:data.title,
    format:data.format,
    duration:data.duration,
    thumbnail:data.thumbnail,
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

module.exports = app