import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';

type Theme = {
  name: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
};

type ThemeName = 'default' | 'blue' | 'green' | 'purple';

export const themes: Record<ThemeName, Theme> = {
  default: {
    name: 'Mặc định',
    primary: '235 36 142',
    primaryDark: '201 31 122',
    primaryLight: '253 234 241',
  },
  blue: {
    name: 'Xanh dương',
    primary: '59 130 246',
    primaryDark: '37 99 235',
    primaryLight: '239 246 255',
  },
  green: {
    name: 'Xanh lá',
    primary: '34 197 94',
    primaryDark: '22 163 74',
    primaryLight: '240 253 244',
  },
  purple: {
    name: 'Tím',
    primary: '139 92 246',
    primaryDark: '124 58 237',
    primaryLight: '245 243 255',
  },
};

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeName>(() => {
    try {
      const savedTheme = window.localStorage.getItem('app-theme') as ThemeName;
      return savedTheme && themes[savedTheme] ? savedTheme : 'default';
    } catch (error) {
      console.error("Could not read theme from localStorage", error);
      return 'default';
    }
  });

  useEffect(() => {
    const selectedTheme = themes[theme];
    const root = window.document.documentElement;
    
    root.style.setProperty('--color-primary', selectedTheme.primary);
    root.style.setProperty('--color-primary-dark', selectedTheme.primaryDark);
    root.style.setProperty('--color-primary-light', selectedTheme.primaryLight);

    try {
      window.localStorage.setItem('app-theme', theme);
    } catch (error) {
       console.error("Could not save theme to localStorage", error);
    }

  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
