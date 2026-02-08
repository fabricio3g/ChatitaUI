import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform, Easing } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export const TypingIndicator: React.FC = () => {
    const { theme } = useTheme();
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = (dot: Animated.Value, delay: number) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(dot, {
                        toValue: 1,
                        duration: 600,
                        delay: delay,
                        useNativeDriver: true,
                        easing: Easing.inOut(Easing.ease),
                    }),
                    Animated.timing(dot, {
                        toValue: 0,
                        duration: 600,
                        useNativeDriver: true,
                        easing: Easing.inOut(Easing.ease),
                    }),
                ])
            ).start();
        };

        animate(dot1, 0);
        animate(dot2, 200);
        animate(dot3, 400);
    }, []);

    const Dot = ({ anim }: { anim: Animated.Value }) => (
        <Animated.View
            style={[
                styles.dot,
                {
                    backgroundColor: theme.colors.textTertiary,
                    opacity: anim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.3, 1, 0.3],
                    }),
                    transform: [
                        {
                            translateY: anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -4],
                            }),
                        },
                    ],
                },
            ]}
        />
    );

    return (
        <View style={[
            styles.container,
            { backgroundColor: theme.colors.surfaceHighlight }
        ]}>
            <View style={styles.dotContainer}>
                <Dot anim={dot1} />
                <Dot anim={dot2} />
                <Dot anim={dot3} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 18,
        alignSelf: 'flex-start',
        overflow: 'hidden',
        minWidth: 54,
    },
    dotContainer: {
        flexDirection: 'row',
        gap: 4,
        height: 10,
        alignItems: 'center',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});
