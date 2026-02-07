#!/usr/bin/env bash
# Release APK build without expo build:android

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"

log() { printf "[build-release] %s\n" "$1"; }

SKIP_PREBUILD=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-prebuild)
      SKIP_PREBUILD=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--skip-prebuild]"
      exit 0
      ;;
    *)
      log "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -d "$HOME/Android/Sdk" ]]; then
    export ANDROID_HOME="$HOME/Android/Sdk"
    log "Using ANDROID_HOME: $ANDROID_HOME"
  else
    log "ANDROID_HOME not set and default location not found"
    exit 1
  fi
fi

run_expo_prebuild() {
  if command -v expo >/dev/null 2>&1; then
    expo prebuild -p android --clean
  else
    npx expo prebuild -p android --clean
  fi
}

if [[ "$SKIP_PREBUILD" = false ]] || [[ ! -d "$ANDROID_DIR" ]]; then
  log "Running expo prebuild for Android..."
  run_expo_prebuild
fi

# Ensure local.properties exists
mkdir -p "$ANDROID_DIR"
echo "sdk.dir=$ANDROID_HOME" > "$ANDROID_DIR/local.properties"

log "Building release APK..."
cd "$ANDROID_DIR"

# Allow custom Gradle cache dir
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$PROJECT_DIR/.gradle}"

./gradlew assembleRelease

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
if [[ -f "$APK_PATH" ]]; then
  log "Build successful: $APK_PATH"
else
  log "Build failed: APK not found"
  exit 1
fi
