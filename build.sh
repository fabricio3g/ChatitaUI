#!/bin/bash
# Build script for Android release/debug builds
# Handles all prerequisites and creates reproducible builds

set -e  # Exit on error

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
BUILD_TYPE="debug"
CLEAN_BUILD=false
SKIP_PREBUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --release)
            BUILD_TYPE="release"
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --skip-prebuild)
            SKIP_PREBUILD=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --release       Build release APK (default: debug)"
            echo "  --clean         Clean build artifacts before building"
            echo "  --skip-prebuild Skip expo prebuild step"
            echo "  -h, --help      Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check for Android SDK
if [[ -z "$ANDROID_HOME" ]]; then
    if [[ -d "$HOME/Android/Sdk" ]]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
        log_info "Using ANDROID_HOME: $ANDROID_HOME"
    else
        log_error "ANDROID_HOME not set and default location not found"
        exit 1
    fi
fi

# Clean build artifacts if requested
if [[ "$CLEAN_BUILD" = true ]]; then
    log_info "Cleaning build artifacts..."
    
    # Clean Android build
    if [[ -d "$ANDROID_DIR" ]]; then
        cd "$ANDROID_DIR"
        ./gradlew clean 2>/dev/null || true
        cd "$PROJECT_DIR"
    fi
    
    # Remove generated android folder for complete clean
    rm -rf "$ANDROID_DIR"
    log_info "Removed android/ directory"
fi

# Install dependencies if needed
if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
    log_info "Installing npm dependencies..."
    npm install --legacy-peer-deps
fi

# Run expo prebuild
if [[ "$SKIP_PREBUILD" = false ]] || [[ ! -d "$ANDROID_DIR" ]]; then
    log_info "Running expo prebuild for Android..."
    npx expo prebuild -p android --clean
    
    # Ensure local.properties exists after prebuild
    echo "sdk.dir=$ANDROID_HOME" > "$ANDROID_DIR/local.properties"
    log_info "Created local.properties"
    
    # ============================================================================
    # POST-PREBUILD FIXES
    # These are applied after expo prebuild generates the android folder
    # ============================================================================
    
    log_info "Applying post-prebuild fixes..."
    
    # Fix 1: Apply AndroidX compatibility fix to AndroidManifest.xml
    MANIFEST_FILE="$ANDROID_DIR/app/src/main/AndroidManifest.xml"
    if [[ -f "$MANIFEST_FILE" ]]; then
        if ! grep -q 'tools:replace="android:appComponentFactory"' "$MANIFEST_FILE"; then
            sed -i 's/<application /<application tools:replace="android:appComponentFactory" android:appComponentFactory="androidx.core.app.CoreComponentFactory" /g' "$MANIFEST_FILE"
            log_info "Applied AndroidX compatibility fix to AndroidManifest.xml"
        fi
    fi
    
    # Fix 2: Add Jetifier to gradle.properties for AndroidX support
    GRADLE_PROPS="$ANDROID_DIR/gradle.properties"
    if [[ -f "$GRADLE_PROPS" ]]; then
        if ! grep -q 'android.enableJetifier=true' "$GRADLE_PROPS"; then
            echo "" >> "$GRADLE_PROPS"
            echo "# Automatically convert third-party libraries to use AndroidX" >> "$GRADLE_PROPS"
            echo "android.enableJetifier=true" >> "$GRADLE_PROPS"
            log_info "Added Jetifier to gradle.properties"
        fi
    fi
    
    # Fix 3: Write comprehensive ProGuard rules using a Python script
    log_info "Writing comprehensive ProGuard rules..."
    python3 "$PROJECT_DIR/scripts/fix-proguard.py" "$ANDROID_DIR" || {
        log_warn "Python script failed, using fallback method..."
        cp "$PROJECT_DIR/android-proguard-rules.pro" "$ANDROID_DIR/app/proguard-rules.pro" 2>/dev/null || true
    }
    
    log_info "All post-prebuild fixes applied!"
fi

# ============================================================================
# VERIFY NATIVE MODULES ARE SETUP
# ============================================================================
log_info "Verifying native module setup..."

# Check if ProGuard rules exist
if [[ -f "$ANDROID_DIR/app/proguard-rules.pro" ]]; then
    PROGUARD_SIZE=$(wc -l < "$ANDROID_DIR/app/proguard-rules.pro")
    log_info "ProGuard rules: $PROGUARD_SIZE lines"
else
    log_warn "ProGuard rules file not found!"
fi

# Check local.properties
if [[ -f "$ANDROID_DIR/local.properties" ]]; then
    log_info "local.properties: OK"
else
    log_warn "Creating local.properties..."
    echo "sdk.dir=$ANDROID_HOME" > "$ANDROID_DIR/local.properties"
fi

# Build the APK
cd "$ANDROID_DIR"

if [[ "$BUILD_TYPE" = "release" ]]; then
    log_info "Building release APK..."
    ./gradlew assembleRelease
    APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
else
    log_info "Building debug APK..."
    ./gradlew assembleDebug
    APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
fi

# Check if build was successful
if [[ -f "$APK_PATH" ]]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    log_info "Build successful!"
    log_info "APK: $APK_PATH"
    log_info "Size: $APK_SIZE"
    
    # Verify native libraries are included
    log_info "Verifying native libraries in APK..."
    NATIVE_LIBS=$(unzip -l "$APK_PATH" | grep -E '\.so$' | wc -l)
    log_info "Native libraries found: $NATIVE_LIBS"
    
    # List key native libraries
    log_info "Key native libraries:"
    unzip -l "$APK_PATH" | grep -E 'libexecutorch|libreactnative|libhermes|libjsc' | awk '{print "  -", $4}' || true
else
    log_error "Build failed - APK not found"
    exit 1
fi
