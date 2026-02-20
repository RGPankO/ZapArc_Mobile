#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_KEYSTORE="$ROOT_DIR/keystores/debug.keystore"
TARGET_DIR="$ROOT_DIR/android/app"
TARGET_KEYSTORE="$TARGET_DIR/debug.keystore"

if [ ! -f "$SOURCE_KEYSTORE" ]; then
  echo "[post-prebuild] Missing $SOURCE_KEYSTORE"
  echo "[post-prebuild] Generate it with:"
  echo 'keytool -genkeypair -v -keystore keystores/debug.keystore -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Android Debug,O=Android,C=US"'
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$SOURCE_KEYSTORE" "$TARGET_KEYSTORE"

echo "[post-prebuild] Copied debug keystore to android/app/debug.keystore"
