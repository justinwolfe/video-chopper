import { Hono } from "hono";
import { YtdlCore } from "@ybd-project/ytdl-core/serverless";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

// Get video information endpoint
app.post("/api/video/info", async (c) => {
  try {
    const { url } = await c.req.json();

    if (!url) {
      return c.json({ error: "URL is required" }, 400);
    }

    const ytdl = new YtdlCore();
    const info = await ytdl.getBasicInfo(url);

    // Extract relevant information
    const videoDetails = {
      title: info.videoDetails.title,
      author: info.videoDetails.author?.name || "Unknown",
      lengthSeconds: info.videoDetails.lengthSeconds,
      viewCount: info.videoDetails.viewCount,
      thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url,
      description: info.videoDetails.description,
      // Get available formats
      formats: info.formats.map((format: any) => ({
        itag: format.itag,
        quality: format.qualityLabel || format.quality,
        mimeType: format.mimeType,
        hasVideo: format.hasVideo,
        hasAudio: format.hasAudio,
        container: format.container,
        contentLength: format.contentLength,
        url: format.url,
      })),
    };

    return c.json(videoDetails);
  } catch (error: any) {
    console.error("Error fetching video info:", error);
    return c.json({ error: error.message || "Failed to fetch video information" }, 500);
  }
});

// Download video endpoint (returns stream)
app.post("/api/video/download", async (c) => {
  try {
    const { url, quality = "highest" } = await c.req.json();

    if (!url) {
      return c.json({ error: "URL is required" }, 400);
    }

    const ytdl = new YtdlCore();
    const stream = await ytdl.download(url, {
      quality: quality as any,
    });

    // Convert readable stream to response
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="video.mp4"',
      },
    });
  } catch (error: any) {
    console.error("Error downloading video:", error);
    return c.json({ error: error.message || "Failed to download video" }, 500);
  }
});

export default app;
