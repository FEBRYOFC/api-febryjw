// api/index.js

const express = require('express')
const cors = require('cors')
const yts = require('yt-search')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ================= YOUTUBE ID =================

function getYoutubeId(url) {
    const regex = /(?:youtu\.be\/|v=|\/v\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/
    const match = url.match(regex)
    return match ? match[1] : null
}

// ================= SERVERS =================

const EZSRV_SERVERS = [
    "https://ds2.ezsrv.net",
    "https://ds1.ezsrv.net",
    "https://ds3.ezsrv.net"
]

// ================= FETCH TIMEOUT =================

async function fetchTimeout(url, options = {}, timeout = 15000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)

    const res = await fetch(url, {
        ...options,
        signal: controller.signal
    })

    clearTimeout(id)
    return res
}

// ================= DOWNLOAD ENGINE =================

async function ezsrvDownload(link, quality = 128) {

    for (const server of EZSRV_SERVERS) {

        try {

            const res = await fetchTimeout(`${server}/api/convert`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0",
                    "Origin": "https://ezconv.cc",
                    "Referer": "https://ezconv.cc/"
                },
                body: JSON.stringify({
                    url: link,
                    quality: String(quality),
                    trim: false,
                    startT: 0,
                    endT: 0
                })
            })

            const data = await res.json()

            if (data.status === "done" && data.url) {

                return {
                    status: true,
                    server: server,
                    url: data.url,
                    title: data.title,
                    quality: quality + "kbps"
                }

            }

        } catch (err) {

            console.log(`Server failed: ${server}`)
            console.log(err.message)

        }

    }

    return {
        status: false,
        message: "Semua server ezsrv gagal"
    }

}

// ================= ROOT =================

app.get('/', (req, res) => {

    res.json({
        name: "YouTube Audio Downloader API",
        version: "v4",
        creator: "FebryJW 🚀",
        endpoints: {
            audio: "/api/v1/youtube/audio?url=",
            play: "/api/v1/youtube/ytplaymp3?query="
        },
        servers: EZSRV_SERVERS
    })

})

// ================= AUDIO =================

app.get('/api/v1/youtube/audio', async (req, res) => {

    const { url, quality = 128 } = req.query

    if (!url)
        return res.status(400).json({
            status: false,
            message: "url diperlukan"
        })

    const id = getYoutubeId(url)

    if (!id)
        return res.status(400).json({
            status: false,
            message: "URL youtube tidak valid"
        })

    try {

        const videoUrl = `https://youtube.com/watch?v=${id}`

        const meta = await yts(videoUrl)
        const video = meta.all[0] || null

        const download = await ezsrvDownload(videoUrl, parseInt(quality))

        if (!download.status)
            return res.status(500).json(download)

        res.json({

            status: true,

            metadata: video
                ? {
                      title: video.title,
                      videoId: video.videoId,
                      duration: video.timestamp,
                      thumbnail: video.thumbnail,
                      author: video.author?.name
                  }
                : null,

            download: {
                url: download.url,
                title: download.title,
                quality: download.quality,
                server: download.server
            }

        })

    } catch (err) {

        res.status(500).json({
            status: false,
            message: err.message
        })

    }

})

// ================= SEARCH =================

app.get('/api/v1/youtube/ytplaymp3', async (req, res) => {

    const { query, quality = 128 } = req.query

    if (!query)
        return res.status(400).json({
            status: false,
            message: "query diperlukan"
        })

    try {

        const search = await yts(query)

        if (!search.all.length)
            return res.status(404).json({
                status: false,
                message: "video tidak ditemukan"
            })

        const first = search.all[0]

        const download = await ezsrvDownload(first.url, parseInt(quality))

        if (!download.status)
            return res.status(500).json(download)

        res.json({

            status: true,

            query,

            selected_video: {
                title: first.title,
                url: first.url,
                videoId: first.videoId,
                duration: first.timestamp,
                thumbnail: first.thumbnail,
                author: first.author?.name
            },

            download: {
                url: download.url,
                title: download.title,
                quality: download.quality,
                server: download.server
            }

        })

    } catch (err) {

        res.status(500).json({
            status: false,
            message: err.message
        })

    }

})

// ================= START =================

app.listen(PORT, () => {

    console.log("=================================")
    console.log("🚀 YOUTUBE DOWNLOADER API RUNNING")
    console.log("PORT:", PORT)
    console.log("=================================")

})

module.exports = app