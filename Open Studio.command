#!/bin/bash
# Double-click this file to open Studio, the editor for your site.
# It opens a Terminal window: leave that window open while you work, and close it when you're done.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Studio needs Node.js, which isn't installed on this computer."
  echo "Download it from https://nodejs.org (the LTS version), install it, then double-click this file again."
  echo ""
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

# First run, or after an update: install what the project needs.
if [ ! -d node_modules/yaml ] || [ ! -d node_modules/astro ] || [ ! -d node_modules/sharp ]; then
  echo "Setting up (first time only, about a minute)…"
  npm install || { echo ""; echo "Setup failed. Check your internet connection and try again."; read -n 1 -s -r -p "Press any key to close."; exit 1; }
fi

node studio/server.mjs
