#!/bin/sh
# gitmoire installer for macOS and Linux (Arch, Debian/Ubuntu, Fedora/RHEL, anything else via AppImage).
#
#   curl -fsSL https://gitmoire.dev/install.sh | sh
#
# Env: GITMOIRE_VERSION=0.10.1  pin a version (default: latest published release)
#      GITMOIRE_DRY_RUN=1       print what would happen, change nothing
set -eu

REPO="dark-magic-studios/gitmoire-releases"
GH="https://github.com/$REPO"

say() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }
run() {
  if [ "${GITMOIRE_DRY_RUN:-}" = 1 ]; then printf '[dry-run] %s\n' "$*"; else "$@"; fi
}
as_root() {
  if [ "$(id -u)" = 0 ]; then run "$@"
  elif have sudo; then run sudo "$@"
  else die "need root to run: $*  (install sudo or re-run as root)"; fi
}

have curl || die "curl is required"

# /releases/latest redirects to /releases/tag/vX.Y.Z and skips drafts. No API rate limit.
VERSION="${GITMOIRE_VERSION:-}"
if [ -z "$VERSION" ]; then
  VERSION="$(curl -fsSLI -o /dev/null -w '%{url_effective}' "$GH/releases/latest" | sed 's|.*/tag/v||')"
fi
case "$VERSION" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *) die "could not work out the latest version (got '$VERSION')" ;;
esac
say "gitmoire v$VERSION"

# SHA-256 GitHub records for a release asset; empty if the API is unreachable.
asset_sha256() {
  curl -fsSL "https://api.github.com/repos/$REPO/releases/tags/v$VERSION" 2>/dev/null |
    awk -v n="\"$1\"" '
      $1 == "\"name\":" && $2 == n "," { hit = 1 }
      hit && $1 == "\"digest\":" { gsub(/[",]/, "", $2); sub(/^sha256:/, "", $2); print $2; exit }'
}

sha256_of() {
  if have sha256sum; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

# fetch <asset-name>: download into $TMP and verify against GitHub's recorded digest.
fetch() {
  say "downloading $1"
  if [ "${GITMOIRE_DRY_RUN:-}" = 1 ]; then printf '[dry-run] curl -fL %s/releases/download/v%s/%s\n' "$GH" "$VERSION" "$1"; return; fi
  curl -fL --progress-bar -o "$TMP/$1" "$GH/releases/download/v$VERSION/$1"
  want="$(asset_sha256 "$1")"
  if [ -z "$want" ]; then
    say "warning: could not fetch the published checksum, skipping verification"
  elif [ "$(sha256_of "$TMP/$1")" != "$want" ]; then
    die "checksum mismatch for $1"
  fi
}

install_macos() {
  asset="gitmoire_${VERSION}_universal.dmg"
  fetch "$asset"
  [ "${GITMOIRE_DRY_RUN:-}" = 1 ] && { say "dry run: would copy gitmoire.app to /Applications"; return; }
  mnt="$TMP/mnt"
  mkdir -p "$mnt"
  hdiutil attach -nobrowse -quiet -mountpoint "$mnt" "$TMP/$asset"
  app="$(find "$mnt" -maxdepth 1 -name '*.app' | head -n1)"
  [ -n "$app" ] || { hdiutil detach -quiet "$mnt" || true; die "no .app found inside the dmg"; }
  dest=/Applications
  [ -w "$dest" ] || { dest="$HOME/Applications"; mkdir -p "$dest"; }
  rm -rf "$dest/$(basename "$app")"
  cp -R "$app" "$dest/"
  hdiutil detach -quiet "$mnt" || true
  xattr -cr "$dest/$(basename "$app")" || true
  say "installed to $dest/$(basename "$app")"
  say "builds aren't notarized yet: if macOS blocks the first launch, open System Settings > Privacy & Security > Open Anyway"
}

install_arch() {
  have makepkg || die "makepkg not found: sudo pacman -S --needed base-devel"
  [ "$(id -u)" != 0 ] || die "makepkg refuses to run as root, re-run as your normal user"
  asset="gitmoire_${VERSION}_amd64.deb"
  sum="$(asset_sha256 "$asset")"
  [ -n "$sum" ] || [ "${GITMOIRE_DRY_RUN:-}" = 1 ] || die "could not fetch the published checksum for $asset"
  say "building a pacman package (gitmoire-bin) from the official .deb"
  # Same recipe as packaging/arch/PKGBUILD, pinned to the version resolved above.
  cat > "$TMP/PKGBUILD" <<EOF
pkgname=gitmoire-bin
pkgver=$VERSION
pkgrel=1
pkgdesc='Gitmoire desktop Git client (official Linux binary)'
arch=('x86_64')
url='https://gitmoire.dev'
license=('MIT')
depends=('webkit2gtk-4.1' 'gtk3' 'libayatana-appindicator' 'libglvnd' 'libxkbcommon' 'mesa' 'openssl' 'git')
provides=("gitmoire=\$pkgver")
conflicts=('gitmoire')
options=('!strip' '!debug')
source=("https://github.com/$REPO/releases/download/v\${pkgver}/gitmoire_\${pkgver}_amd64.deb")
sha256sums=('$sum')
package() {
  bsdtar -xf "\$srcdir/data.tar.gz" -C "\$pkgdir"
  test -x "\$pkgdir/usr/bin/gitmoire" || return 1
  ln -s gitmoire "\$pkgdir/usr/bin/gitmo"
}
EOF
  if [ "${GITMOIRE_DRY_RUN:-}" = 1 ]; then printf '[dry-run] (cd %s && makepkg -si)\n' "$TMP"; return; fi
  (cd "$TMP" && makepkg -si)
}

install_linux() {
  [ "$(uname -m)" = x86_64 ] || die "only x86_64 Linux builds are published (this is $(uname -m))"
  ids=""
  if [ -r /etc/os-release ]; then ids="$(. /etc/os-release; printf '%s %s' "${ID:-}" "${ID_LIKE:-}")"; fi
  case " $ids " in
    *" arch "*) install_arch ;;
    *" debian "*|*" ubuntu "*)
      asset="gitmoire_${VERSION}_amd64.deb"; fetch "$asset"
      as_root apt-get install -y "$TMP/$asset" ;;
    *" fedora "*|*" rhel "*|*" centos "*|*" suse "*)
      asset="gitmoire-${VERSION}-1.x86_64.rpm"; fetch "$asset"
      if have dnf; then as_root dnf install -y "$TMP/$asset"; else as_root rpm -U "$TMP/$asset"; fi ;;
    *)
      asset="gitmoire_${VERSION}_amd64.AppImage"; fetch "$asset"
      bin="$HOME/.local/bin"
      run mkdir -p "$bin"
      run install -m 755 "$TMP/$asset" "$bin/gitmoire"
      run ln -sf gitmoire "$bin/gitmo"
      say "installed AppImage to $bin/gitmoire (needs WebKitGTK 4.1; make sure $bin is on your PATH)" ;;
  esac
}

case "$(uname -s)" in
  Darwin) install_macos ;;
  Linux) install_linux ;;
  *) die "unsupported OS $(uname -s). On Windows run: irm https://gitmoire.dev/install.ps1 | iex" ;;
esac

say "done. Run 'gitmoire' in a repository (short alias: 'gitmo')."
