import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { makeStyles, darkTheme, lightTheme } from "./styles";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => {
    const stored = localStorage.getItem("pivot_theme");
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const theme = themeName === "dark" ? darkTheme : lightTheme;
  const S = useMemo(() => makeStyles(theme), [theme]);

  const setTheme = (name) => {
    localStorage.setItem("pivot_theme", name);
    setThemeName(name);
  };

  useEffect(() => {
    document.body.style.background = theme.bg;
  }, [theme.bg]);

  return (
    <ThemeContext.Provider value={{ S, theme, themeName, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
