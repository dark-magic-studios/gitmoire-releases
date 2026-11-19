#!/usr/bin/env bash
# Strips the build host's libwayland-* from tauri's cached linuxdeploy GStreamer
# plugin, so the AppImage never ships Ubuntu's libwayland (see gitmoire
# DECISIONS.md G47).
#
# The GTK plugin strip (patch-linuxdeploy-gtk.sh, run by tauri-build.mjs) is not
# enough on its own: the GStreamer plugin copies every GStreamer plugin, including
# libgstwaylandsink, and runs a nested linuxdeploy that deploys their dependencies.
# That re-adds libwayland-client/egl/cursor after the GTK strip has already run.
#
# Safe to run repeatedly. The plugin is patched on a temp copy that must pass
# `bash -n` before it replaces the cache entry.
set -euo pipefail
plugin="${1:-$HOME/.cache/tauri/linuxdeploy-plugin-gstreamer.sh}"
marker='gitmoire: strip bundled libwayland (gstreamer plugin)'

if [ ! -f "$plugin" ]; then
  # Fresh runner: tauri downloads the plugin lazily during bundling, which is too
  # late to patch. Seed the cache so tauri uses the patched copy.
  mkdir -p "$(dirname "$plugin")"
  curl -fsSL \
    https://raw.githubusercontent.com/tauri-apps/linuxdeploy-plugin-gstreamer/master/linuxdeploy-plugin-gstreamer.sh \
    -o "$plugin"
  chmod +x "$plugin"
fi

if grep -qF "$marker" "$plugin"; then
  echo "linuxdeploy-plugin-gstreamer.sh already patched"
  exit 0
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
cp "$plugin" "$tmp"
cat >> "$tmp" <<EOF

# $marker (see DECISIONS.md G47)
find "\$APPDIR" \\( -type f -o -type l \\) -name 'libwayland-*.so*' -print -delete
EOF

# Never install a plugin that bash cannot parse.
bash -n "$tmp" || { echo "error: patched gstreamer plugin failed 'bash -n'; cache left untouched" >&2; exit 1; }
mv "$tmp" "$plugin"
chmod +x "$plugin"
echo "patched linuxdeploy-plugin-gstreamer.sh"
