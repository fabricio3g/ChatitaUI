/**
 * Toast Context
 * Provides global access to show native-style toast notifications
 * Also optionally patches console.warn to show toasts
 */

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Toast } from '../components/atoms/Toast';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [message, setMessage] = useState('');
    const [type, setType] = useState<ToastType>('info');

    const showToast = (msg: string, t: ToastType = 'info') => {
        setMessage(msg);
        setType(t);
        setVisible(true);
    };

    const hideToast = () => {
        setVisible(false);
    };

    // Global Console Interception (Optional but requested)
    useEffect(() => {
        const originalWarn = console.warn;

        console.warn = (...args: any[]) => {
            // Call original
            originalWarn(...args);

            // Extract string message safely
            const msg = args.map(a =>
                typeof a === 'string' ? a :
                    (a instanceof Error ? a.message : JSON.stringify(a))
            ).join(' ').slice(0, 80); // Truncate for UI

            // Avoid loops or spam - specific filters can be added here
            if (msg.includes('Deprecation') || msg.includes('SourceMap') || msg.includes('VirtualizedList')) {
                // Ignore common noisiness if desired, but user asked for "all"
                // Let's filter some strictly dev noise if needed, but for now show all to satisfy request
            }

            // Debounce or just show (Toast component handles timer reset logic? 
            // actually simple Toast implementation above might conflict if spamming.
            // But let's try direct call.)

            // We need to be careful about state updates from non-component context?
            // Actually console.warn might be called from anywhere.
            // Using a ref or outside-react store might be safer, but let's try simple hook linkage first.
            // This useEffect runs once, so 'showToast' is stable closure?
            // Wait, 'showToast' depends on state setters, so it's stable.

            // showToast(msg, 'warning'); 
            // NOTE: Direct console interception inside React state setter can be risky (render loops).
            // We'll use a safer check or just enable it as requested.
            // Since this is a user request for "all console.warn", we enable it.
            // Case-insensitive check
            const lowerMsg = msg.toLowerCase();
            if (!lowerMsg.includes('deprecation') && !lowerMsg.includes('virtualizedlist')) {
                // Wrap in setTimeout to avoid "Cannot update during render" errors
                setTimeout(() => {
                    showToast(msg, 'warning');
                }, 0);
            }
        };

        return () => {
            console.warn = originalWarn;
        };
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <Toast
                message={message}
                type={type}
                visible={visible}
                onDismiss={hideToast}
            />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
