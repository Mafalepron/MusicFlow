#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--max-old-space-size=2048" node node_modules/.bin/next dev -p 3000 -H 0.0.0.0 > dev.log 2>&1
  echo "Server exited, restarting in 1s..." >> dev.log
  sleep 1
done
