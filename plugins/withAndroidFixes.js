/**
 * Expo Config Plugin for Android Build Fixes
 * 
 * Applies permanent fixes for:
 * - AndroidX compatibility (appComponentFactory)
 * - Manifest merger conflicts
 * 
 * Usage: Add to app.json plugins:
 *   ["./plugins/withAndroidFixes"]
 */

const { withAndroidManifest } = require('@expo/config-plugins');

function withAndroidFixes(config) {
    return withAndroidManifest(config, async (config) => {
        const manifest = config.modResults;

        // Add tools namespace if not present
        if (!manifest.manifest.$['xmlns:tools']) {
            manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
        }

        // Get application element
        const application = manifest.manifest.application?.[0];
        if (application) {
            // Add appComponentFactory fix for AndroidX compatibility
            application.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
            application.$['tools:replace'] = 'android:appComponentFactory';

            // Ensure OpenCL is declared for llama.rn GPU support (optional)
            const existing = application['uses-native-library'] || [];
            const hasOpenCL = existing.some(
                (entry) => entry?.$?.['android:name'] === 'libOpenCL.so'
            );
            if (!hasOpenCL) {
                existing.push({
                    $: {
                        'android:name': 'libOpenCL.so',
                        'android:required': 'false',
                    },
                });
            }
            application['uses-native-library'] = existing;
        }

        return config;
    });
}

module.exports = withAndroidFixes;
