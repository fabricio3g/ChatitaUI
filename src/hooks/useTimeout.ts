/**
 * useTimeout - Custom hook for managing timeouts with automatic cleanup
 * Prevents memory leaks and "setState on unmounted component" warnings
 */

import { useRef, useEffect, useCallback } from 'react';

/**
 * Returns a function that creates timeouts which are automatically cleared on unmount
 * @returns {(callback: () => void, delay: number) => void} setTimeout function
 */
export const useTimeout = () => {
    const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set());

    // Clear all timeouts on unmount
    useEffect(() => {
        return () => {
            timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
            timeoutRefs.current.clear();
        };
    }, []);

    // Wrapped setTimeout that tracks the timeout ID
    const setTimeoutWithCleanup = useCallback((callback: () => void, delay: number) => {
        const timeoutId = setTimeout(() => {
            callback();
            // Remove from tracking set after execution
            timeoutRefs.current.delete(timeoutId);
        }, delay);

        // Track this timeout
        timeoutRefs.current.add(timeoutId);

        // Return timeout ID for manual cancellation if needed
        return timeoutId;
    }, []);

    return setTimeoutWithCleanup;
};

/**
 * Hook for delayed state updates with automatic cleanup
 * @returns {(setState: React.Dispatch<React.SetStateAction<T>>, value: React.SetStateAction<T>, delay: number) => void}
 */
export const useDelayedState = <T>() => {
    const setTimeoutWithCleanup = useTimeout();

    const setDelayedState = useCallback((
        setState: React.Dispatch<React.SetStateAction<T>>,
        value: React.SetStateAction<T>,
        delay: number
    ) => {
        setTimeoutWithCleanup(() => {
            setState(value);
        }, delay);
    }, [setTimeoutWithCleanup]);

    return setDelayedState;
};
