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

const { withAndroidManifest, withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

function withAndroidFixes(config) {
    config = withGradleProperties(config, (config) => {
        const props = config.modResults;
        const setProp = (key, value) => {
            const existing = props.find((p) => p.type === 'property' && p.key === key);
            if (existing) {
                existing.value = value;
            } else {
                props.push({ type: 'property', key, value });
            }
        };

        setProp('android.useAndroidX', 'true');
        setProp('android.enableJetifier', 'true');
        return config;
    });

    config = withAppBuildGradle(config, (config) => {
        const src = config.modResults.contents;
        if (src.includes('configurations.all') && src.includes("exclude group: 'com.android.support'")) {
            return config;
        }

        const marker = 'android {';
        if (!src.includes(marker)) {
            return config;
        }

        const insert = `

// Avoid legacy support libraries pulled by transitive deps
configurations.all {
    exclude group: 'com.android.support'
}
`;
        config.modResults.contents = src.replace(marker, `${marker}${insert}`);
        return config;
    });

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
