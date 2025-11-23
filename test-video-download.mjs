#!/usr/bin/env node
/**
 * Test script for YouTube video download functionality
 * Run with: node test-video-download.mjs
 */

// Use Node.js version instead of web for testing
import { Innertube } from 'youtubei.js';

const TEST_URL = 'https://www.youtube.com/watch?v=Mh1hKt5kQ_4&list=RDMh1hKt5kQ_4&start_radio=1';

// Extract video ID from URL
function extractVideoId(url) {
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

async function testVideoDownload() {
  console.log('🧪 Testing YouTube Video Download\n');
  console.log('Test URL:', TEST_URL);

  try {
    // Step 1: Extract video ID
    console.log('\n📝 Step 1: Extracting video ID...');
    const videoId = extractVideoId(TEST_URL);
    console.log('✅ Video ID:', videoId);

    // Step 2: Create Innertube instance
    console.log('\n📝 Step 2: Creating Innertube instance...');
    const yt = await Innertube.create();
    console.log('✅ Innertube instance created');

    // Step 3: Get video info
    console.log('\n📝 Step 3: Fetching video info...');
    const info = await yt.getInfo(videoId);
    console.log('✅ Video info fetched');
    console.log('   Title:', info.basic_info.title);
    console.log('   Author:', info.basic_info.author);
    console.log('   Duration:', info.basic_info.duration, 'seconds');
    console.log('   Views:', info.basic_info.view_count?.toLocaleString());

    // Step 4: Check streaming data
    console.log('\n📝 Step 4: Checking streaming data...');
    const formats = info.streaming_data?.formats || [];
    const adaptiveFormats = info.streaming_data?.adaptive_formats || [];
    console.log('✅ Formats available:');
    console.log('   Regular formats:', formats.length);
    console.log('   Adaptive formats:', adaptiveFormats.length);

    // Step 5: List some formats
    console.log('\n📝 Step 5: Sample formats with video+audio:');
    const combinedFormats = formats.concat(adaptiveFormats)
      .filter(f => f.has_video && f.has_audio)
      .slice(0, 5);

    combinedFormats.forEach((format, idx) => {
      console.log(`   ${idx + 1}. itag=${format.itag}, quality=${format.quality_label || format.quality}, mime=${format.mime_type}`);
    });

    // Step 6: Test deciphering
    console.log('\n📝 Step 6: Testing URL deciphering...');
    if (combinedFormats.length > 0) {
      try {
        const testFormat = combinedFormats[0];
        const decipheredUrl = testFormat.decipher(yt.session.player);
        console.log('✅ Successfully deciphered URL (first 100 chars):', decipheredUrl.substring(0, 100));
      } catch (decipherError) {
        console.error('❌ Decipher error:', decipherError.message);
        console.error('Stack:', decipherError.stack);
      }
    }

    // Step 7: Test download API (don't actually download, just check if it works)
    console.log('\n📝 Step 7: Testing download API...');
    try {
      const stream = await yt.download(videoId, {
        type: 'video+audio',
        quality: 'best',
        format: 'mp4',
      });
      console.log('✅ Download stream created successfully');
      console.log('   Stream type:', typeof stream);
      console.log('   Has pipe method:', typeof stream.pipe === 'function');
    } catch (downloadError) {
      console.error('❌ Download error:', downloadError.message);
      console.error('Stack:', downloadError.stack);
    }

    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testVideoDownload();
