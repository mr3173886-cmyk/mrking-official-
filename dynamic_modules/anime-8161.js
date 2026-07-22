const express = require('express');
const router = express.Router();
const axios = require('axios');

const animeVideoMemory = new Set();
const tags = [
  "anime attitude edit 4k", "gojo satoru badass edit", "anime 4k 60fps attitude",
  "madara uchiha attitude edit", "eren yeager freedom edit", "anime sigma male edit",
  "anime phonk edit badass", "naruto hindi song edit", "sukuna ryoamen attitude"
];

router.get('/', async (req, res) => {
  try {
    const randomTag = tags[Math.floor(Math.random() * tags.length)];
    const response = await axios.get(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(randomTag)}`);
    const videos = response.data?.data?.videos;

    if (!videos || videos.length === 0) return res.send('No video found!');

    let selected = videos.find(v => !animeVideoMemory.has(v.video_id)) || videos[0];
    animeVideoMemory.add(selected.video_id);

    const videoUrl = selected.play || selected.hdplay;

    res.send(`
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Anime Hub</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #08080c; color: white;
            font-family: Arial, sans-serif;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            min-height: 100vh; padding: 15px;
          }
          video {
            width: 100%; max-width: 400px; max-height: 70vh;
            border-radius: 12px; border: 2px solid #a855f7;
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
            object-fit: cover;
          }
          .btn {
            background: linear-gradient(45deg, #7000ff, #d000ff);
            border: none; color: white; padding: 12px 28px;
            border-radius: 25px; cursor: pointer; font-size: 15px;
            font-weight: bold; margin-top: 20px; transition: 0.3s;
            box-shadow: 0 0 10px rgba(208, 0, 255, 0.4);
          }
          .btn:active { transform: scale(0.95); }
        </style>
      </head>
      <body>
        <video controls autoplay loop src="${videoUrl}"></video>
        <button class="btn" onclick="location.reload()">🎬 Get Another Video</button>
      </body>
      </html>
    `);
  } catch (err) {
    res.send('Error loading video!');
  }
});

module.exports = router;

