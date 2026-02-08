/**
 * Drawer - Smooth gesture-based drawer with natural feel
 * Swipe from left edge to open, swipe anywhere to close
 */

import React, { useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    Dimensions,
    Pressable,
    PanResponder,
    GestureResponderEvent,
    PanResponderGestureState,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(300, SCREEN_WIDTH * 0.8);
// Swipe zone covers left half of screen for easy access
const EDGE_SWIPE_WIDTH = SCREEN_WIDTH * 0.5;
// Minimum horizontal movement before capturing gesture
const MIN_SWIPE_DISTANCE = 10;
// Velocity threshold for quick flick gestures (pixels per ms)
const VELOCITY_THRESHOLD = 0.5;
// Distance threshold to open/close (percentage of drawer width)
const OPEN_THRESHOLD = 0.3;

interface DrawerProps {
    visible: boolean;
    onClose: () => void;
    onOpen: () => void;
    children: React.ReactNode;
    drawerContent: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
    visible,
    onClose,
    onOpen,
    children,
    drawerContent,
}) => {
    const { theme } = useTheme();

    // Track visible in a ref so PanResponder handlers always have the latest value
    const visibleRef = useRef(visible);
    useEffect(() => {
        visibleRef.current = visible;
    }, [visible]);

    // Track if we're currently in a gesture
    const isGesturing = useRef(false);

    // Single animated value for drawer position (0 = closed, 1 = open)
    const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

    // Derived animated values
    const drawerTranslateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-DRAWER_WIDTH, 0],
    });

    const overlayOpacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.4],
    });

    // Animate when visible prop changes (only if not gesturing)
    useEffect(() => {
        if (isGesturing.current) return;

        Animated.spring(progress, {
            toValue: visible ? 1 : 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
        }).start();
    }, [visible, progress]);

    // Snap to open or closed position
    const snapTo = (toOpen: boolean) => {
        // Update parent state
        if (toOpen && !visibleRef.current) {
            onOpen();
        } else if (!toOpen && visibleRef.current) {
            onClose();
        }

        // Always animate to final position
        Animated.spring(progress, {
            toValue: toOpen ? 1 : 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
        }).start();
    };

    // Pan responder for edge swipe gestures
    const panResponder = useRef(
        PanResponder.create({
            // Don't capture immediately - wait for movement
            onStartShouldSetPanResponder: () => false,

            // Capture on horizontal movement in swipe zone
            onMoveShouldSetPanResponder: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
                const { dx, dy, moveX } = gestureState;
                const startX = moveX - dx;

                // Must have significant horizontal movement
                if (Math.abs(dx) < MIN_SWIPE_DISTANCE) return false;

                // Must be primarily horizontal (not scrolling)
                if (Math.abs(dy) > Math.abs(dx) * 1.5) return false;

                // When closed: only capture swipes starting from left edge, moving right
                if (!visibleRef.current) {
                    return startX < EDGE_SWIPE_WIDTH && dx > 0;
                }

                // When open: capture any leftward swipe
                return dx < 0;
            },

            onPanResponderGrant: () => {
                isGesturing.current = true;
                progress.stopAnimation();
            },

            onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
                const { dx } = gestureState;

                if (!visibleRef.current) {
                    // Opening: map dx to progress (0 to 1)
                    const newProgress = Math.min(1, Math.max(0, dx / DRAWER_WIDTH));
                    progress.setValue(newProgress);
                } else {
                    // Closing: map dx to progress (1 to 0)
                    const newProgress = Math.min(1, Math.max(0, 1 + dx / DRAWER_WIDTH));
                    progress.setValue(newProgress);
                }
            },

            onPanResponderRelease: (_, gestureState: PanResponderGestureState) => {
                isGesturing.current = false;
                const { dx, vx } = gestureState;

                // Get current progress value
                let currentProgress: number;
                if (!visibleRef.current) {
                    currentProgress = Math.min(1, Math.max(0, dx / DRAWER_WIDTH));
                } else {
                    currentProgress = Math.min(1, Math.max(0, 1 + dx / DRAWER_WIDTH));
                }

                // Determine if should open or close based on progress and velocity
                const hasVelocityToOpen = vx > VELOCITY_THRESHOLD;
                const hasVelocityToClose = vx < -VELOCITY_THRESHOLD;
                const hasProgressToOpen = currentProgress > OPEN_THRESHOLD;
                const hasProgressToClose = currentProgress < (1 - OPEN_THRESHOLD);

                // Decide final state
                let shouldBeOpen: boolean;
                if (hasVelocityToOpen) {
                    shouldBeOpen = true;
                } else if (hasVelocityToClose) {
                    shouldBeOpen = false;
                } else if (currentProgress >= 0.5) {
                    shouldBeOpen = true;
                } else {
                    shouldBeOpen = false;
                }

                snapTo(shouldBeOpen);
            },

            onPanResponderTerminate: () => {
                // Gesture was interrupted - snap to current state
                isGesturing.current = false;
                snapTo(visibleRef.current);
            },

            onPanResponderTerminationRequest: () => false,
        })
    ).current;

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            {/* Main Content - no translation needed, drawer slides over it */}
            <View style={[styles.content, { backgroundColor: theme.colors.background }]}>
                {children}
            </View>

            {/* Overlay - fades in when drawer opens */}
            <Animated.View
                style={[
                    styles.overlay,
                    {
                        opacity: overlayOpacity,
                        pointerEvents: visible ? 'auto' : 'none',
                    },
                ]}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>

            {/* Drawer panel */}
            <Animated.View
                style={[
                    styles.drawer,
                    {
                        transform: [{ translateX: drawerTranslateX }],
                        width: DRAWER_WIDTH,
                        backgroundColor: theme.colors.background,
                    },
                ]}
            >
                {drawerContent}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 50,
    },
    drawer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 16,
    },
});

export default Drawer;
