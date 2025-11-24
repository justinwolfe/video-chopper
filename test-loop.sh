#!/bin/bash

# Test loop script for iterating on video downloads

echo "Starting test loop..."
echo "Press Ctrl+C to stop"
echo ""

COUNT=1

while true; do
  echo "===== Test Run #$COUNT ====="
  date

  export PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH"
  node test-video.js

  echo ""
  echo "Waiting 5 seconds before next test..."
  sleep 5
  echo ""

  COUNT=$((COUNT + 1))
done
