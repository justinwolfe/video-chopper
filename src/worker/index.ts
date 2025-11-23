import { Hono } from "hono";
import { Innertube, UniversalCache } from "youtubei.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

// Create Innertube instance for each request to avoid caching issues
async function getInnertube() {
  // Disable caching to avoid "Illegal invocation" errors in Workers
  // UniversalCache uses indexedDB/fs which aren't available in Workers
  return await Innertube.create({
    cache: new UniversalCache(false),
    generate_session_locally: true,
  });
}

// Extract video ID from URL
function extractVideoId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error('Invalid YouTube URL or video ID');
}

// Get video information endpoint
app.post("/api/video/info", async (c) => {
  try {
    const { url } = await c.req.json();

    if (!url) {
      return c.json({ error: "URL is required" }, 400);
    }

    const videoId = extractVideoId(url);
    const yt = await getInnertube();

    console.log(`Fetching info for video: ${videoId}`);
    const info = await yt.getInfo(videoId);

    // Extract video details
    const videoDetails = {
      title: info.basic_info.title || "Unknown",
      author: info.basic_info.author || "Unknown",
      lengthSeconds: info.basic_info.duration?.toString() || "0",
      viewCount: info.basic_info.view_count?.toString() || "0",
      thumbnail: info.basic_info.thumbnail?.[0]?.url || "",
      description: info.basic_info.short_description || "",
      // Get available formats
      formats: (info.streaming_data?.formats || []).concat(info.streaming_data?.adaptive_formats || []).map((format: any) => ({
        itag: format.itag,
        quality: format.quality_label || format.quality || "unknown",
        mimeType: format.mime_type,
        hasVideo: format.has_video || false,
        hasAudio: format.has_audio || false,
        container: format.mime_type?.split(';')[0]?.split('/')[1] || "unknown",
        contentLength: format.content_length || "0",
        url: format.decipher(yt.session.player),
      })),
    };

    return c.json(videoDetails);
  } catch (error: any) {
    console.error("Error fetching video info:", error);
    return c.json({
      error: error.message || "Failed to fetch video information",
      details: error.stack
    }, 500);
  }
});

// Download video endpoint (returns stream)
app.post("/api/video/download", async (c) => {
  try {
    const { url, quality = "best" } = await c.req.json();

    if (!url) {
      return c.json({ error: "URL is required" }, 400);
    }

    const videoId = extractVideoId(url);
    const yt = await getInnertube();

    console.log(`Downloading video: ${videoId} with quality: ${quality}`);

    // Download with best quality, combining video and audio
    const stream = await yt.download(videoId, {
      type: 'video+audio',  // Get both video and audio
      quality: quality,
      format: 'mp4',
    });

    // Convert readable stream to response
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="video_${videoId}.mp4"`,
      },
    });
  } catch (error: any) {
    console.error("Error downloading video:", error);
    return c.json({
      error: error.message || "Failed to download video",
      details: error.stack
    }, 500);
  }
});

export default app;
