import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, ThemeName, ThemeMap } from '../theme';

interface ThemeContextValue {
    themeName: ThemeName;
    theme: Theme;
    setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_KEY = 'settings_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [themeName, setThemeNameState] = useState<ThemeName>('clean');

    useEffect(() => {
        const loadTheme = async () => {
            const saved = await AsyncStorage.getItem(THEME_KEY);
            if (saved && saved in ThemeMap) {
                setThemeNameState(saved as ThemeName);
            }
        };
        loadTheme();
    }, []);

    const setThemeName = async (name: ThemeName) => {
        setThemeNameState(name);
        await AsyncStorage.setItem(THEME_KEY, name);
    };

    const value = useMemo(() => ({
        themeName,
        theme: ThemeMap[themeName],
        setThemeName
    }), [themeName]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return ctx;
};
