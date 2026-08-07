#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--max-old-space-size=2048" node node_modules/.bin/next dev -p 3000 > dev.log 2>&1
  echo "Server exited, restarting in 3s..." >> dev.log
  sleep 3
done
