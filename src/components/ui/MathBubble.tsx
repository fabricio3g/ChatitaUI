import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface MathBubbleProps {
    latex: string;
    inline?: boolean;
    backgroundColor?: string;
    textColor?: string;
}

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" crossorigin="anonymous">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" integrity="sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8" crossorigin="anonymous"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            width: 100%;
            height: 100%; /* Important for resize observer */
            background-color: transparent;
            overflow: hidden; /* Hide scrollbars */
        }
        body {
            display: flex;
            align-items: center;
        }
        #math {
            width: 100%;
            padding: 2px 0; /* Slight padding to avoid clipping */
        }
        .katex { font-size: 16px; }
        .katex-display { margin: 0 !important; }
    </style>
</head>
<body>
    <div id="math"></div>
    <script>
        let resizeObserver;

        function renderMath(base64Latex, options) {
            const mathEl = document.getElementById('math');
            if (!window.katex) {
                // If KaTeX not loaded, retry shortly
                setTimeout(() => renderMath(base64Latex, options), 100);
                return;
            }
            
            try {
                // Decode Base64
                // UTF-8 fix for b64 decode
                const latex = decodeURIComponent(escape(window.atob(base64Latex)));
                
                window.katex.render(latex, mathEl, {
                    displayMode: !options.inline,
                    throwOnError: false, // Render errors in color instead of throwing
                    strict: false,
                    ...options
                });
                
                updateHeight();
            } catch (e) {
                console.error(e);
                mathEl.innerText = "Error: " + e.message;
                mathEl.style.color = 'red';
            }
        }

        function updateHeight() {
            const body = document.body;
            const html = document.documentElement;
            // Get precise height of content
            const height = document.getElementById('math').scrollHeight; 
            // Add a small buffer just in case
            window.ReactNativeWebView.postMessage(JSON.stringify({ height: height + 4 }));
        }

        // Apply styles dynamically
        function updateStyles(bgColor, color, inline) {
             document.body.style.backgroundColor = bgColor;
             document.body.style.justifyContent = inline ? 'flex-start' : 'center'; // Center block math?
             // Actually, usually block math is centered by KaTeX itself or left aligned. 
             // Let's stick to flex-start for now unless it's display mode.
             
             document.body.style.justifyContent = 'flex-start'; 
             
             const styles = \`
                 .katex { color: \${color} !important; font-size: \${inline ? '1.0rem' : '1.1rem'}; }
                 .katex * { color: \${color} !important; border-color: \${color} !important; }
             \`;
             
             const styleEl = document.getElementById('dynamic-styles');
             if (styleEl) styleEl.innerHTML = styles;
             else {
                 const s = document.createElement('style');
                 s.id = 'dynamic-styles';
                 s.innerHTML = styles;
                 document.head.appendChild(s);
             }
        }

        // Observer for late-loading fonts or layout shifts
        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(entries => {
                updateHeight();
            });
            resizeObserver.observe(document.body);
            resizeObserver.observe(document.getElementById('math'));
        } else {
             setInterval(updateHeight, 500); 
        }
    </script>
</body>
</html>
`;

const MathBubbleComponent: React.FC<MathBubbleProps> = ({
    latex,
    inline = false,
    backgroundColor = 'transparent',
    textColor = '#000000'
}) => {
    // Initial height estimate
    const [height, setHeight] = useState(inline ? 40 : 60);
    const webViewRef = useRef<WebView>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Update content when props change
    useEffect(() => {
        if (!isLoaded || !webViewRef.current) return;

        // encodeURIComponent handles UTF-8 correctly for btoa
        const toBase64 = (str: string) => {
            try {
                // React Native usually has global.btoa
                return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
                    function (match, p1) {
                        return String.fromCharCode(parseInt(p1, 16));
                    }));
            } catch (e) {
                console.warn('Base64 encoding failed', e);
                return '';
            }
        };

        const base64Latex = toBase64(latex);

        const script = `
            updateStyles('${backgroundColor}', '${textColor}', ${inline});
            renderMath('${base64Latex}', { inline: ${inline} });
        `;

        webViewRef.current.injectJavaScript(script);
    }, [latex, inline, backgroundColor, textColor, isLoaded]);

    return (
        <View style={[
            styles.container,
            inline ? styles.inlineContainer : styles.blockContainer,
            { height }
        ]}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: htmlTemplate }}
                style={{ backgroundColor: 'transparent' }}
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                onLoad={() => setIsLoaded(true)}
                onMessage={(event) => {
                    try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.height && data.height > 0) {
                            // Only update if significantly different to avoid loops?
                            // Or just trust it.
                            if (Math.abs(height - data.height) > 1) {
                                setHeight(data.height);
                            }
                        }
                    } catch (e) { }
                }}
                androidLayerType="hardware" // Render optimization
            />
        </View>
    );
};

export const MathBubble = React.memo(MathBubbleComponent, (prev, next) => {
    return prev.latex === next.latex &&
        prev.inline === next.inline &&
        prev.textColor === next.textColor;
});

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    blockContainer: {
        width: '100%',
        minHeight: 40,
    },
    inlineContainer: {
        alignSelf: 'flex-start',
        minHeight: 30, // Tweak this for alignment
        // We might want flexible width for inline?
        // WebView normally takes full width. 
        // For inline math in a row of text, we actually typically need a fixed width 
        // OR we just let it take its natural width.
        // RN WebView doesn't auto-resize width easily.
        // For now, let's keep 'flex-start' which in a View might mean full width 
        // unless constrained.
        width: '100%', // Keep it simple for now, it's inside a View in MessageContent
        marginBottom: -8, // Adjust visual alignment 
    },
    errorText: {
        fontSize: 15,
        fontFamily: 'monospace',
    },
});

export default MathBubble;
