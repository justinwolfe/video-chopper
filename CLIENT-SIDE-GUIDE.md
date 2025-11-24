# Video Chopper - Client-Side Architecture

## Overview

After extensive testing, we've adopted a **client-side download architecture** that works perfectly with Cloudflare Workers:

- **CF Worker**: Provides fast, globally-distributed metadata API
- **Client-Side**: Handles video downloading using browser-native capabilities

This architecture avoids all Cloudflare Workers limitations (no eval(), no MessagePort, WASM restrictions) while providing a better user experience.

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   Client    │─────▶│  CF Worker API   │─────▶│  YouTube    │
│  (Browser)  │      │  (Metadata Only) │      │             │
└─────────────┘      └──────────────────┘      └─────────────┘
       │                                               ▲
       │                                               │
       └───────────────────────────────────────────────┘
              Direct download (client-side library)
```

## What Works ✅

### Metadata API (`POST /api/video/info`)

Returns comprehensive video information:
- Title, author, duration, views
- High-quality thumbnail URLs
- 23 video formats with full details:
  - Quality (360p, 720p, 1080p, etc.)
  - Container (mp4, webm, etc.)
  - Audio/video capabilities
  - File size, bitrate, FPS, dimensions

### Test Results

```json
{
  "videoId": "Mh1hKt5kQ_4",
  "title": "Her Majesty (Remastered 2009)",
  "author": "The Beatles - Topic",
  "lengthSeconds": "26",
  "viewCount": "3893224",
  "formats": [
    {
      "itag": 18,
      "quality": "360p",
      "mimeType": "video/mp4; codecs=\"avc1.42001E, mp4a.40.2\"",
      "hasVideo": true,
      "hasAudio": true,
      "container": "mp4",
      "contentLength": "418888",
      "bitrate": 518867,
      "fps": 30,
      "width": 640,
      "height": 360
    },
    // ... 22 more formats
  ]
}
```

## Client-Side Download Options

### Option 1: Use ytdl-core in Browser

Install a client-side YouTube library:

```bash
npm install ytdl-core
# or
npm install @distube/ytdl-core
```

Then use it in your React/Vue/etc application:

```javascript
import ytdl from 'ytdl-core';

// Get metadata from our API
const metadata = await fetch('http://localhost:8787/api/video/info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: videoUrl })
}).then(r => r.json());

// Download video client-side
const videoUrl = `https://www.youtube.com/watch?v=${metadata.videoId}`;
const stream = ytdl(videoUrl, { quality: 'highest' });

// Handle the stream...
```

### Option 2: Use YouTube IFrame API

Embed and let YouTube handle playback:

```javascript
<iframe
  width="560"
  height="315"
  src={`https://www.youtube.com/embed/${metadata.videoId}`}
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen
></iframe>
```

### Option 3: Third-Party Services

Use services like:
- yt-dlp (command-line tool)
- Online converters (youtube-dl, etc.)
- Browser extensions

## Files Created

- [src/worker/index.ts](src/worker/index.ts) - Metadata API (120 lines, clean)
- [test-video.js](test-video.js) - Node.js test script
- [test-loop.sh](test-loop.sh) - Continuous testing loop
- [test-client-side.html](test-client-side.html) - Interactive browser demo
- [PROGRESS-REPORT.md](PROGRESS-REPORT.md) - Detailed technical journey
- **CLIENT-SIDE-GUIDE.md** (this file) - Architecture guide

## Running the Demo

### Start the Worker

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH"
npx wrangler dev --port 8787
```

### Test via Command Line

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH"
node test-video.js
```

### Test in Browser

Open [test-client-side.html](test-client-side.html) in your browser to see the interactive demo.

## API Endpoints

### `GET /api/`
Health check endpoint.

### `POST /api/video/info`
Get video metadata.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "videoId": "string",
  "title": "string",
  "author": "string",
  "lengthSeconds": "string",
  "viewCount": "string",
  "thumbnail": "string",
  "description": "string",
  "formats": [...]
}
```

## Next Steps for Production

1. **Add Rate Limiting**: Protect API from abuse
2. **Add Caching**: Cache metadata to reduce YouTube API calls
3. **Add Analytics**: Track usage patterns
4. **Client Library**: Create npm package for easy integration
5. **Documentation**: API reference and examples

## Why This Architecture is Better

1. **No CF Workers Limitations**: Bypasses all eval(), WASM, MessagePort restrictions
2. **Better Performance**: Download happens directly from YouTube to user
3. **More Scalable**: Worker only handles lightweight metadata requests
4. **Lower Costs**: No egress for video data through CF
5. **Standard Pattern**: How most video services work (YouTube, Vimeo, etc.)

## Test Video

- URL: https://www.youtube.com/watch?v=Mh1hKt5kQ_4
- Title: "Her Majesty (Remastered 2009)"
- Duration: 26 seconds
- Perfect for quick testing!

---

**Worker Status**: Running on `http://localhost:8787` ✅
