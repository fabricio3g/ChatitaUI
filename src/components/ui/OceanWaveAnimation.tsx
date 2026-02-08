/**
 * Ocean Wave Animation
 * Square container with animated wave patterns inside
 * Reacts to audio levels for dynamic wave motion
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

interface OceanWaveAnimationProps {
    size?: number;
    color?: string;
    active?: boolean;
    audioLevel?: number; // 0-1 audio amplitude for reactive waves
}

export const OceanWaveAnimation: React.FC<OceanWaveAnimationProps> = ({
    size = 120,
    color = '#3B82F6',
    active = true,
    audioLevel = 0,
}) => {
    const wave1 = useRef(new Animated.Value(0)).current;
    const wave2 = useRef(new Animated.Value(0)).current;
    const wave3 = useRef(new Animated.Value(0)).current;
    const audioWave = useRef(new Animated.Value(0)).current;

    // React to audio level changes
    useEffect(() => {
        Animated.spring(audioWave, {
            toValue: audioLevel,
            friction: 5,
            tension: 100,
            useNativeDriver: true,
        }).start();
    }, [audioLevel]);

    // Base wave animation
    useEffect(() => {
        if (!active) return;

        const createWaveAnimation = (animValue: Animated.Value, delay: number, duration: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(animValue, {
                        toValue: 1,
                        duration,
                        delay,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: true,
                    }),
                    Animated.timing(animValue, {
                        toValue: 0,
                        duration,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: true,
                    }),
                ])
            );
        };

        const anim1 = createWaveAnimation(wave1, 0, 1800);
        const anim2 = createWaveAnimation(wave2, 300, 2200);
        const anim3 = createWaveAnimation(wave3, 600, 2600);

        anim1.start();
        anim2.start();
        anim3.start();

        return () => {
            anim1.stop();
            anim2.stop();
            anim3.stop();
        };
    }, [active]);

    const getWaveStyle = (animValue: Animated.Value, baseOffset: number, audioMultiplier: number) => {
        // Combine base animation with audio reactivity
        const baseTranslate = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [baseOffset, baseOffset - 12],
        });

        const audioBoost = audioWave.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -20 * audioMultiplier],
        });

        const scaleX = Animated.add(
            animValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.03, 1],
            }),
            audioWave.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.1 * audioMultiplier],
            })
        );

        return {
            transform: [
                { translateY: Animated.add(baseTranslate, audioBoost) },
            ],
        };
    };

    const getOpacity = (baseOpacity: number) => {
        return audioWave.interpolate({
            inputRange: [0, 1],
            outputRange: [baseOpacity, Math.min(baseOpacity + 0.3, 1)],
        });
    };

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {/* Background */}
            <View style={[styles.background, { backgroundColor: color + '10' }]} />

            {/* Wave layers - each reacts differently to audio */}
            <Animated.View
                style={[
                    styles.wave,
                    { backgroundColor: color, bottom: -15 },
                    getWaveStyle(wave1, 0, 1),
                    { opacity: getOpacity(0.15) },
                ]}
            />
            <Animated.View
                style={[
                    styles.wave,
                    { backgroundColor: color, bottom: -25 },
                    getWaveStyle(wave2, 8, 0.7),
                    { opacity: getOpacity(0.3) },
                ]}
            />
            <Animated.View
                style={[
                    styles.wave,
                    { backgroundColor: color, bottom: -35 },
                    getWaveStyle(wave3, 15, 0.5),
                    { opacity: getOpacity(0.5) },
                ]}
            />

            {/* Animated center pulse */}
            <Animated.View style={[
                styles.centerPulse,
                {
                    backgroundColor: color,
                    opacity: audioWave.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 0.8],
                    }),
                    transform: [{
                        scale: audioWave.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.3],
                        }),
                    }],
                },
            ]} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#0a0a0b',
        borderWidth: 2,
        borderColor: '#27272A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    wave: {
        position: 'absolute',
        left: -30,
        right: -30,
        height: 80,
        borderRadius: 40,
    },
    centerPulse: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        top: '25%',
    },
});
