#!/usr/bin/env node

const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=Mh1hKt5kQ_4';
const WORKER_URL = 'http://localhost:8787';

async function testVideoInfo() {
  console.log('\n========================================');
  console.log('Testing Video Info Endpoint');
  console.log('========================================\n');
  console.log(`Video URL: ${TEST_VIDEO_URL}\n`);

  try {
    const response = await fetch(`${WORKER_URL}/api/video/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: TEST_VIDEO_URL }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error ${response.status}: ${response.statusText}`);
      console.error('Response:', errorText);
      return null;
    }

    const data = await response.json();

    console.log('✅ Video Metadata:');
    console.log(`   Title: ${data.title}`);
    console.log(`   Author: ${data.author}`);
    console.log(`   Duration: ${data.lengthSeconds}s`);
    console.log(`   Views: ${data.viewCount}`);
    console.log(`   Thumbnail: ${data.thumbnail}`);
    console.log(`\n📹 Available Formats (${data.formats.length}):\n`);

    // Group formats by type
    const videoAudioFormats = data.formats.filter(f => f.hasVideo && f.hasAudio);
    const videoOnlyFormats = data.formats.filter(f => f.hasVideo && !f.hasAudio);
    const audioOnlyFormats = data.formats.filter(f => !f.hasVideo && f.hasAudio);

    if (videoAudioFormats.length > 0) {
      console.log('   Video+Audio (Combined):');
      videoAudioFormats.forEach(format => {
        const sizeInMB = (parseInt(format.contentLength) / 1024 / 1024).toFixed(2);
        console.log(`      [${format.itag}] ${format.quality} - ${format.mimeType} (${sizeInMB} MB)`);
        const urlStr = String(format.url);
        if (urlStr && urlStr.length > 80) {
          console.log(`           URL: ${urlStr.substring(0, 80)}...`);
        } else {
          console.log(`           URL: ${urlStr}`);
        }
      });
      console.log();
    }

    if (videoOnlyFormats.length > 0) {
      console.log('   Video Only:');
      videoOnlyFormats.slice(0, 5).forEach(format => {
        console.log(`      [${format.itag}] ${format.quality} - ${format.mimeType} (${(parseInt(format.contentLength) / 1024 / 1024).toFixed(2)} MB)`);
      });
      console.log();
    }

    if (audioOnlyFormats.length > 0) {
      console.log('   Audio Only:');
      audioOnlyFormats.slice(0, 3).forEach(format => {
        console.log(`      [${format.itag}] ${format.quality} - ${format.mimeType} (${(parseInt(format.contentLength) / 1024 / 1024).toFixed(2)} MB)`);
      });
      console.log();
    }

    return data;
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
    return null;
  }
}

async function testVideoDownload() {
  console.log('\n========================================');
  console.log('Testing Video Download Endpoint');
  console.log('========================================\n');

  try {
    const response = await fetch(`${WORKER_URL}/api/video/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: TEST_VIDEO_URL,
        quality: 'best'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error ${response.status}: ${response.statusText}`);
      console.error('Response:', errorText);
      return;
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const contentDisposition = response.headers.get('content-disposition');

    console.log('✅ Download Stream Ready:');
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Length: ${contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);
    console.log(`   Content-Disposition: ${contentDisposition}`);
    console.log('\n   Stream is available for download!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
  }
}

async function main() {
  console.log('\n🎬 Video Chopper - Metadata API Test');
  console.log('======================================\n');

  const videoInfo = await testVideoInfo();

  if (videoInfo) {
    console.log('\n✅ Metadata API Working!');
    console.log('\n📝 Note: Video downloading is handled client-side.');
    console.log('   Open test-client-side.html in a browser to see the demo.\n');
  }

  console.log('========================================');
  console.log('✅ Test Complete!');
  console.log('========================================\n');
}

main().catch(console.error);
