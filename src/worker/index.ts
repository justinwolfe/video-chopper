import { Hono } from 'hono';
import { cors } from 'hono/cors';
// Use youtubei.js WEB client for metadata - client handles downloading
import { Innertube, ClientType } from 'youtubei.js/cf-worker';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for client-side requests
app.use('/*', cors());

// Global Innertube instance
let yt: Innertube | undefined;

async function getInnertube() {
  if (!yt) {
    yt = await Innertube.create({
      generate_session_locally: true,
      fetch: fetch.bind(globalThis),
      client_type: ClientType.WEB,
    });
  }
  return yt;
}

app.get('/api/', (c) => c.json({ name: 'Video Chopper API' }));

// Extract video ID from URL
function extractVideoId(url: string): string {
  try {
    const urlObj = new URL(url);

    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }

    if (
      urlObj.hostname.includes('youtube.com') &&
      urlObj.pathname === '/watch'
    ) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return videoId;
    }
  } catch (e: unknown) {
    console.error('Error parsing URL:', e);
  }

  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
    /(?:https?:\/\/)?youtu\.be\/([^&\n?#]+)/,
    /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }

  throw new Error('Invalid YouTube URL or video ID');
}

// Get video metadata - client-side will handle downloading
app.post('/api/video/info', async (c) => {
  try {
    const { url } = await c.req.json();

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    const videoId = extractVideoId(url);
    console.log(`Fetching metadata for video: ${videoId}`);

    const innertube = await getInnertube();
    const info = await innertube.getInfo(videoId);

    // Return metadata and format information
    // Client-side code will handle actual downloading
    const metadata = {
      videoId,
      title: info.basic_info.title || 'Unknown',
      author: info.basic_info.author || 'Unknown',
      lengthSeconds: info.basic_info.duration?.toString() || '0',
      viewCount: info.basic_info.view_count?.toString() || '0',
      thumbnail: info.basic_info.thumbnail?.[0]?.url || '',
      description: info.basic_info.short_description || '',
      // Return format information (client will fetch URLs directly)
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
          // These are available on the client side
          bitrate: format.bitrate || 0,
          fps: format.fps || 0,
          width: format.width || 0,
          height: format.height || 0,
        })),
    };

    return c.json(metadata);
  } catch (error) {
    console.error('Error fetching video metadata:', error);
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

export default app;
