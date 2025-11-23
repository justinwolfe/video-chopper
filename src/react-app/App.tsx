// src/App.tsx

import { useState } from "react";
import "./App.css";

interface VideoFormat {
  itag: number;
  quality: string;
  mimeType: string;
  hasVideo: boolean;
  hasAudio: boolean;
  container: string;
  contentLength: string;
  url: string;
}

interface VideoInfo {
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

  const handleDownload = async (quality: string = "highest") => {
    if (!url.trim()) {
      setError("Please enter a video URL");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/video/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, quality }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to download video");
      }

      // Create a blob from the response
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = videoInfo?.title
        ? `${videoInfo.title.replace(/[^a-z0-9]/gi, "_")}.mp4`
        : "video.mp4";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || "An error occurred");
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
        Powered by Cloudflare Workers + @ybd-project/ytdl-core
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
            <button
              onClick={() => handleDownload("highest")}
              disabled={loading}
              className="download-button primary"
            >
              Download Best Quality
            </button>
          </div>

          <div className="formats-section">
            <h3>Available Formats ({videoInfo.formats.length})</h3>
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
                    </div>
                    <a
                      href={format.url}
                      download
                      className="download-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
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
