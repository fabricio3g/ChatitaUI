#!/usr/bin/env python3
"""
Fix ProGuard rules for native modules in release builds.
This script writes comprehensive ProGuard rules to keep all native modules.
"""

import sys
import os

PROGUARD_RULES = """# ============================================================================
# REACT NATIVE CORE - Keep all native modules
# ============================================================================
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.modules.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.views.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.defaults.** { *; }

# Keep React Native interfaces
-keep interface com.facebook.react.bridge.JavaScriptModule { *; }
-keep interface com.facebook.react.bridge.NativeModule { *; }
-keep class * implements com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * implements com.facebook.react.bridge.NativeModule { *; }

# ============================================================================
# EXPO MODULES - Keep all Expo packages
# ============================================================================
-keep class expo.modules.** { *; }
-keep class expo.modules.speechrecognition.** { *; }
-keep class expo.modules.av.** { *; }
-keep class expo.modules.filesystem.** { *; }
-keep class expo.modules.speech.** { *; }

# ============================================================================
# REACT NATIVE EXECUTORCH - Critical for LLM/STT/TTS/RAG
# ============================================================================
-keep class com.swmansion.executorch.** { *; }
-keep class org.pytorch.executorch.** { *; }
-keep class com.facebook.executorch.** { *; }
-keepclassmembers class com.swmansion.executorch.** { native <methods>; }
-keep class * extends com.swmansion.executorch.models.** { *; }

# ============================================================================
# REACT NATIVE VOICE - Speech recognition
# ============================================================================
-keep class com.wenkesj.voice.** { *; }
-keep class com.reactnativevoice.** { *; }

# ============================================================================
# REACT NATIVE RAG - Document processing
# ============================================================================
-keep class com.reactnativerag.** { *; }

# ============================================================================
# ONNX RUNTIME - Native inference
# ============================================================================
-keep class ai.onnxruntime.** { *; }
-keep class com.microsoft.onnxruntime.** { *; }

# ============================================================================
# ANIMATED LIBRARIES
# ============================================================================
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }

# ============================================================================
# OTHER MODULES
# ============================================================================
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.oblador.vectoricons.** { *; }
-keep class com.reactnativecommunity.webview.** { *; }
-keep class expo.modules.securestore.** { *; }
-keep class com.reactnativecommunity.cookies.** { *; }

# ============================================================================
# NATIVEMODULE LOADING - Critical for release builds
# ============================================================================
-keep class **.*NativeModule* { *; }
-keep class **.*Package* { *; }
-keep class com.** { *; }
-keepclasseswithmembernames class * { native <methods>; }

# ============================================================================
# DON'T WARN ABOUT THESE
# ============================================================================
-dontwarn com.facebook.react.**
-dontwarn com.swmansion.**
-dontwarn expo.modules.**
-dontwarn org.pytorch.**
-dontwarn ai.onnxruntime.**
-dontwarn com.microsoft.**
"""


def main():
    if len(sys.argv) < 2:
        android_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "android")
    else:
        android_dir = sys.argv[1]
    
    proguard_path = os.path.join(android_dir, "app", "proguard-rules.pro")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(proguard_path), exist_ok=True)
    
    # Write ProGuard rules
    with open(proguard_path, "w") as f:
        f.write(PROGUARD_RULES)
    
    print(f"[fix-proguard] ProGuard rules written to: {proguard_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
