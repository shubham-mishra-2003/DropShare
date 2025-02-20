import { createContext, useContext, useEffect, useState } from "react";

interface ThemeContextProps {
  colorScheme: "light" | "dark";
  setTheme: (theme: "light" | "dark" | "system") => void;
  theme: "light" | "dark" | "system";
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [theme, setThemeState] = useState<"light" | "dark" | "system">(
    "system",
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  const getSystemColorScheme = (): "light" | "dark" => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      return mediaQuery.matches ? "dark" : "light";
    }
    return "dark";
  };

  const [colorScheme, setColorScheme] = useState<"light" | "dark">(
    getSystemColorScheme(),
  );

  const setTheme = async (newTheme: "light" | "dark" | "system") => {
    setThemeState(newTheme);
    if (newTheme === "system") {
      await localStorage.removeItem("theme");
    } else {
      await localStorage.setItem("theme", newTheme);
    }
  };

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await localStorage.getItem("theme");
      if (savedTheme) {
        setThemeState(savedTheme as "light" | "dark");
      } else {
        setThemeState("system");
      }
    };
    loadTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      if (theme === "system") {
        setColorScheme(getSystemColorScheme());
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, [theme]);

  const finalColorScheme: "light" | "dark" =
    theme === "system" ? colorScheme : theme;

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.body.style.backgroundColor =
        finalColorScheme === "dark" ? "#121212" : "#f7fbff";
      document.body.style.color =
        finalColorScheme === "dark" ? "#e2e8f0" : "#314158";
    }
  }, [finalColorScheme]);

  if (loading) {
    return "Loading...";
  }

  return (
    <ThemeContext.Provider
      value={{
        colorScheme: finalColorScheme,
        setTheme,
        theme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
