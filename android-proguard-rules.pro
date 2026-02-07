# ============================================================================
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
# REACT NATIVE VOICE - Speech recognition
# ============================================================================
-keep class com.wenkesj.voice.** { *; }
-keep class com.reactnativevoice.** { *; }

# ============================================================================
# LLAMA.RN - Local LLM runtime
# ============================================================================
-keep class com.rnllama.** { *; }

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
-dontwarn com.rnllama.**
