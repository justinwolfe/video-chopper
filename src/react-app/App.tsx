// src/App.tsx

import { useState } from "react";
import "./App.css";
// Use browser build of youtubei.js for client-side URL deciphering
import { Innertube } from 'youtubei.js/web.bundle';

interface VideoFormat {
  itag: number;
  quality: string;
  mimeType: string;
  hasVideo: boolean;
  hasAudio: boolean;
  container: string;
  contentLength: string;
  bitrate: number;
  fps: number;
  width: number;
  height: number;
}

interface VideoInfo {
  videoId: string;
  title: string;
  author: string;
  lengthSeconds: string;
  viewCount: string;
  thumbnail: string;
  description: string;
  formats: VideoFormat[];
}

function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState("");

  const handleFetchInfo = async () => {
    if (!url.trim()) {
      setError("Please enter a video URL");
      return;
    }

    setLoading(true);
    setError("");
    setVideoInfo(null);

    try {
      const response = await fetch("/api/video/info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch video information");
      }

      setVideoInfo(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleWatchOnYoutube = () => {
    if (videoInfo) {
      window.open(`https://www.youtube.com/watch?v=${videoInfo.videoId}`, '_blank');
    }
  };

  const getBestFormat = () => {
    if (!videoInfo) return null;

    // Find best video+audio combined format
    const combined = videoInfo.formats
      .filter(f => f.hasVideo && f.hasAudio)
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

    return combined || videoInfo.formats[0];
  };

  const handleDownloadVideo = async (formatItag?: number) => {
    if (!videoInfo) return;

    setLoading(true);
    setError("");

    try {
      // Create Innertube instance in browser for URL deciphering
      const yt = await Innertube.create();
      const info = await yt.getInfo(videoInfo.videoId);

      // Get the format to download
      let format;
      if (formatItag) {
        format = info.streaming_data?.formats?.find(f => f.itag === formatItag) ||
                 info.streaming_data?.adaptive_formats?.find(f => f.itag === formatItag);
      } else {
        // Get best video+audio format
        format = info.chooseFormat({ quality: 'best', type: 'video+audio' });
      }

      if (!format) {
        throw new Error('Format not found');
      }

      // Decipher the URL (works in browser!)
      const downloadUrl = await format.decipher(yt.session.player);

      // Download the video
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${videoInfo.title.replace(/[^a-z0-9]/gi, '_')}.${format.mime_type.split('/')[1].split(';')[0]}`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

    } catch (err: any) {
      setError(`Download error: ${err.message}`);
      console.error('Download error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: string) => {
    const num = parseInt(bytes);
    if (isNaN(num)) return bytes;
    if (num === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return Math.round(num / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatDuration = (seconds: string) => {
    const num = parseInt(seconds);
    if (isNaN(num)) return seconds;
    const h = Math.floor(num / 3600);
    const m = Math.floor((num % 3600) / 60);
    const s = num % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="container">
      <h1>Video Downloader</h1>
      <p className="subtitle">
        Powered by Cloudflare Workers + YouTube.js
      </p>

      <div className="input-section">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter YouTube URL (e.g., https://www.youtube.com/watch?v=...)"
          className="url-input"
          disabled={loading}
          onKeyPress={(e) => e.key === "Enter" && handleFetchInfo()}
        />
        <button
          onClick={handleFetchInfo}
          disabled={loading || !url.trim()}
          className="fetch-button"
        >
          {loading ? "Loading..." : "Get Video Info"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {videoInfo && (
        <div className="video-info">
          <div className="video-header">
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="thumbnail"
              />
            )}
            <div className="video-details">
              <h2>{videoInfo.title}</h2>
              <p className="author">By {videoInfo.author}</p>
              <div className="meta">
                <span>Duration: {formatDuration(videoInfo.lengthSeconds)}</span>
                <span>
                  Views: {parseInt(videoInfo.viewCount).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="download-section">
            <h3>Quick Download</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleDownloadVideo()}
                disabled={loading}
                className="download-button primary"
              >
                {loading ? '⏳ Downloading...' : '⬇️ Download Best Quality'}
              </button>
              <button
                onClick={handleWatchOnYoutube}
                className="download-button"
              >
                ▶️ Watch on YouTube
              </button>
            </div>
            {getBestFormat() && (
              <div style={{ marginTop: '15px', padding: '15px', background: '#f0f0f0', borderRadius: '4px' }}>
                <strong>Best Available:</strong> {getBestFormat()?.quality} {getBestFormat()?.container.toUpperCase()}
                {' '}({formatBytes(getBestFormat()!.contentLength)})
                <div style={{ fontSize: '14px', marginTop: '5px', color: '#666' }}>
                  {getBestFormat()?.width && getBestFormat()?.height &&
                    `${getBestFormat()?.width}x${getBestFormat()?.height} • `}
                  {getBestFormat()?.fps && `${getBestFormat()?.fps}fps • `}
                  {getBestFormat()?.bitrate && `${Math.round(getBestFormat()!.bitrate / 1000)}kbps`}
                </div>
              </div>
            )}
          </div>

          <div className="formats-section">
            <h3>Available Formats ({videoInfo.formats.length})</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
              Click download to get the video directly in your browser
            </p>
            <div className="formats-list">
              {videoInfo.formats
                .filter((f) => f.hasVideo && f.hasAudio)
                .slice(0, 10)
                .map((format) => (
                  <div key={format.itag} className="format-item">
                    <div className="format-info">
                      <strong>{format.quality}</strong>
                      <span className="format-type">
                        {format.container?.toUpperCase()} •{" "}
                        {format.hasVideo && format.hasAudio
                          ? "Video + Audio"
                          : format.hasVideo
                          ? "Video Only"
                          : "Audio Only"}
                      </span>
                      {format.contentLength && (
                        <span className="format-size">
                          {formatBytes(format.contentLength)}
                        </span>
                      )}
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                        {format.width && format.height && `${format.width}x${format.height} • `}
                        {format.fps && `${format.fps}fps • `}
                        {format.bitrate && `${Math.round(format.bitrate / 1000)}kbps • `}
                        itag: {format.itag}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadVideo(format.itag)}
                      disabled={loading}
                      className="download-link"
                      style={{ fontSize: '14px', padding: '8px 16px' }}
                    >
                      {loading ? '⏳' : '⬇️'} Download
                    </button>
                  </div>
                ))}
            </div>
            {videoInfo.formats.filter((f) => f.hasVideo && f.hasAudio).length >
              10 && (
              <p className="formats-note">
                Showing 10 of{" "}
                {videoInfo.formats.filter((f) => f.hasVideo && f.hasAudio).length}{" "}
                formats with video and audio
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
