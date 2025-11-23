import { Hono } from 'hono';
// Use the /cf-worker build for Cloudflare Workers environment
import { Innertube, ClientType } from 'youtubei.js/cf-worker';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/', (c) => c.json({ name: 'Cloudflare' }));

// Test endpoint for debugging
app.get('/api/test/:videoId', async (c) => {
  const videoId = c.req.param('videoId');

  try {
    console.log(`[TEST] Testing video ID: ${videoId}`);

    const yt = await getInnertube();
    console.log('[TEST] Innertube instance created');

    const info = await yt.getInfo(videoId);
    console.log('[TEST] Video info fetched');

    return c.json({
      success: true,
      videoId,
      title: info.basic_info.title,
      author: info.basic_info.author,
      duration: info.basic_info.duration,
      formatCount:
        (info.streaming_data?.formats?.length || 0) +
        (info.streaming_data?.adaptive_formats?.length || 0),
    });
  } catch (error) {
    console.error('[TEST] Error:', error);
    return c.json(
      {
        success: false,
        videoId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      500
    );
  }
});

// Global variable to cache the Innertube instance across requests
let yt: Innertube | undefined;

// Create Innertube instance (cached)
async function getInnertube() {
  if (!yt) {
    yt = await Innertube.create({
      generate_session_locally: true,
      fetch: fetch.bind(globalThis),
      enable_session_cache: true,
      client_type: ClientType.IOS,
      device_category: 'mobile',
    });
  }
  return yt;
}

// Extract video ID from URL
function extractVideoId(url: string): string {
  try {
    // First try creating a URL object to handle various relative/absolute paths if needed
    // but given the input is likely a full URL string, we can just parse it.
    const urlObj = new URL(url);

    // Handle youtu.be short URLs
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }

    // Handle youtube.com/watch URLs
    if (
      urlObj.hostname.includes('youtube.com') &&
      urlObj.pathname === '/watch'
    ) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return videoId;
    }

    // Fallback to regex for other formats or if URL parsing fails/is insufficient
  } catch (e: unknown) {
    console.error('Error parsing URL:', e);
    // If URL parsing fails, proceed to regex
  }

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
app.post('/api/video/info', async (c) => {
  try {
    const { url } = await c.req.json();

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    const videoId = extractVideoId(url);
    const yt = await getInnertube();

    console.log(`Fetching info for video: ${videoId}`);
    const info = await yt.getInfo(videoId);

    // Extract video details
    const videoDetails = {
      title: info.basic_info.title || 'Unknown',
      author: info.basic_info.author || 'Unknown',
      lengthSeconds: info.basic_info.duration?.toString() || '0',
      viewCount: info.basic_info.view_count?.toString() || '0',
      thumbnail: info.basic_info.thumbnail?.[0]?.url || '',
      description: info.basic_info.short_description || '',
      // Get available formats
      formats: (info.streaming_data?.formats || [])
        .concat(info.streaming_data?.adaptive_formats || [])
        .map((format) => ({
          itag: format.itag,
          quality: format.quality_label || format.quality || 'unknown',
          mimeType: format.mime_type,
          hasVideo: format.has_video || false,
          hasAudio: format.has_audio || false,
          container:
            format.mime_type?.split(';')[0]?.split('/')[1] || 'unknown',
          contentLength: format.content_length || '0',
          url: format.decipher(yt.session.player),
        })),
    };

    return c.json(videoDetails);
  } catch (error) {
    console.error('Error fetching video info:', error);
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch video information',
        details: error instanceof Error ? error.stack : undefined,
      },
      500
    );
  }
});

// Download video endpoint (returns stream)
app.post('/api/video/download', async (c) => {
  try {
    const { url, quality = 'best' } = await c.req.json();

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    const videoId = extractVideoId(url);
    const yt = await getInnertube();

    console.log(`Downloading video: ${videoId} with quality: ${quality}`);

    // If quality is 'best' or undefined, we'll just grab the single best format
    // that has both video and audio (usually 360p/720p mp4) because muxing in
    // Cloudflare Workers (video+audio separate streams) is not possible without ffmpeg.
    // So we force 'video+audio' type which Innertube should resolve to a single pre-mixed file if possible.

    // We need to be careful with large downloads in Workers.
    // If it's a large file, we might want to just proxy the stream.

    const info = await yt.getInfo(videoId);
    const combinedFormat = info.chooseFormat({
      type: 'video+audio',
      quality: 'best',
    });

    const formatUrl = await combinedFormat.decipher(yt.session.player);

    if (!formatUrl) {
      throw new Error('No suitable combined video+audio format found');
    }

    console.log('Downloading URL directly:', formatUrl);

    // Proxy the video stream directly from YouTube's servers
    // Note: formatUrl is a string (from decipher), but TS might infer it as string | undefined.
    // decipher() returns string, so we can assert or just pass it.
    const videoResponse = await fetch(formatUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Range: 'bytes=0-', // Request full content
      },
    });

    if (!videoResponse.ok) {
      throw new Error(
        `Failed to fetch video stream: ${videoResponse.status} ${videoResponse.statusText}`
      );
    }

    // Return the stream directly
    return new Response(videoResponse.body, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${
          info.basic_info.title || videoId
        }.mp4"`,
        'Content-Length': videoResponse.headers.get('Content-Length') || '',
      },
    });
  } catch (error) {
    console.error('Error downloading video:', error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to download video',
        details: error instanceof Error ? error.stack : undefined,
      },
      500
    );
  }
});

export default app;
