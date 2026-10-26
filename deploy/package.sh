#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p dist/js/ai release
cp index.html styles.css dist/
cp js/rules.js js/game.js js/ai.js js/ai-worker.js js/app.js dist/js/
cp js/ai/basic.js js/ai/decompose.js js/ai/tracker.js js/ai/strategy.js js/ai/search.js dist/js/ai/
(cd dist && zip -q -r ../release/guandan-web.zip index.html styles.css js)
printf 'Static files: dist/\nUpload archive: release/guandan-web.zip\n'
