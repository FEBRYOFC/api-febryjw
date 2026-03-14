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

// ================= SAVETUBE CLASS =================

class Savetube {

 constructor() {
  this.ky = "C5D58EF67A7584E4A29F6C35BBC4EB12"

  this.hr = {
   "content-type": "application/json",
   "origin": "https://yt.savetube.vip",
   "user-agent": "Mozilla/5.0"
  }

  this.fmt = ["144","240","360","480","720","1080","mp3"]

  this.m = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?([a-zA-Z0-9_-]{11})/
 }

 async decrypt(enc){

  const sr = Buffer.from(enc,"base64")
  const ky = Buffer.from(this.ky,"hex")

  const iv = sr.slice(0,16)
  const dt = sr.slice(16)

  const dc = crypto.createDecipheriv("aes-128-cbc",ky,iv)

  return JSON.parse(
   Buffer.concat([
    dc.update(dt),
    dc.final()
   ]).toString()
  )

 }

 async getCdn(){

  const res = await axios.get(
   "https://media.savetube.vip/api/random-cdn",
   {headers:this.hr}
  )

  return res.data.cdn

 }

 async download(url){

  const id = url.match(this.m)?.[3]

  if(!id) throw new Error("URL youtube tidak valid")

  const cdn = await this.getCdn()

  const info = await axios.post(
   `https://${cdn}/v2/info`,
   { url:`https://www.youtube.com/watch?v=${id}` },
   { headers:this.hr }
  )

  const dec = await this.decrypt(info.data.data)

  const dl = await axios.post(
   `https://${cdn}/download`,
   {
    id:id,
    downloadType:"audio",
    quality:"128",
    key:dec.key
   },
   {headers:this.hr}
  )

  return {

   title:dec.title,
   duration:dec.duration,
   thumbnail:dec.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
   download:dl.data.data.downloadUrl

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
   mp3:"/api/v1/youtube/ytmp3?url=youtube_url"
  }

 })

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

  const data = await savetube.download(video.url)

  res.json({

   waktu_indonesia:waktuIndonesia(),
   status:true,
   creator:"𝐅𝐞𝐛𝐫𝐲𝐉𝐖 🚀",

   respon_data:{
    title:video.title,
    duration:video.timestamp,
    thumbnail:video.thumbnail,
    url:video.url,
    download:data.download
   }

  })

 }catch(e){

  res.json({
   waktu_indonesia:waktuIndonesia(),
   status:false,
   creator:"𝐅𝐞𝐛𝐫𝐫𝐲𝐉𝐖 🚀",
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

  const data = await savetube.download(url)

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