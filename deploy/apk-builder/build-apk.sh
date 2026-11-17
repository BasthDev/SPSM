#!/usr/bin/env bash
# build-apk.sh — git pull → gradlew assembleRelease → publish APK
# Jalan di VM Ubuntu. Output: /home/basth/apk-dist/latest.apk + timestamped copies.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/basth/apbuilder}"
DIST_DIR="${DIST_DIR:-/home/basth/apk-dist}"
ANDROID_HOME="${ANDROID_HOME:-/home/basth/Android/Sdk}"
JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export ANDROID_HOME JAVA_HOME
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# Auto-install komponen Android SDK yang dibutuhkan (sekali saja)
ensure_sdk() {
  local sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
  if [ ! -x "$sdkmanager" ]; then
    echo "=== Install Android cmdline-tools ==="
    mkdir -p "$ANDROID_HOME/cmdline-tools"
    local tmp; tmp="$(mktemp -d)"
    curl -fsSL "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o "$tmp/cmdtools.zip"
    unzip -q "$tmp/cmdtools.zip" -d "$tmp"
    mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
    rm -rf "$tmp"
  fi
  yes | "$sdkmanager" --licenses >/dev/null 2>&1 || true
  echo "=== sdkmanager install platform/build-tools/ndk ==="
  "$sdkmanager" "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
}
[ -d "$ANDROID_HOME" ] && ensure_sdk

mkdir -p "$DIST_DIR"
cd "$REPO_DIR"

# Node deps untuk Metro bundling (sekali saja, incremental setelahnya)
if [ ! -d node_modules ]; then
  echo "=== npm install (deps untuk Metro bundle) ==="
  if [ ! -f .env ]; then
    echo "WARNING: .env tidak ada di $REPO_DIR — EXPO_PUBLIC_* akan kosong!"
  fi
  npm install --no-audit --no-fund
fi

echo "=== git pull ==="
git pull --ff-only

# android/ adalah CNG (gitignored) — generate via expo prebuild jika belum ada
if [ ! -d android ]; then
  echo "=== expo prebuild --platform android ==="
  npx expo prebuild --platform android
fi

echo "=== gradlew assembleRelease ==="
cd android
chmod +x gradlew
./gradlew assembleRelease --console=plain

APK="app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$APK" ]; then
  echo "ERROR: APK tidak ditemukan di $APK"
  exit 1
fi

TS="$(date +%Y%m%d-%H%M%S)"
cp "$APK" "$DIST_DIR/app-release-$TS.apk"
cp "$APK" "$DIST_DIR/latest.apk"
# Simpan max 5 versi lama
ls -t "$DIST_DIR"/app-release-*.apk | tail -n +6 | xargs -r rm -f

echo "=== DONE: $DIST_DIR/latest.apk ($(du -h "$DIST_DIR/latest.apk" | cut -f1)) ==="
