import { Hono } from "hono";
// Use the /web build for browser-like environments (Cloudflare Workers)
import { Innertube } from "youtubei.js/web";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

// Create Innertube instance for each request
async function getInnertube() {
  // Use /web build which is compatible with Workers environment
  return await Innertube.create();
}

// Extract video ID from URL
function extractVideoId(url: string): string {
  const patterns = [
    // Standard YouTube URLs with optional protocol and www
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
    // Short YouTube URLs
    /(?:https?:\/\/)?youtu\.be\/([^&\n?#]+)/,
    // Mobile YouTube URLs
    /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
    // Just the video ID (11 characters)
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
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
