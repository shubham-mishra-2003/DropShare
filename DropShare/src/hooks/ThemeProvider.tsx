import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme as getSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ThemeContextProps {
  colorScheme: "light" | "dark";
  setTheme: (theme: "light" | "dark" | "system") => void;
  theme: "light" | "dark" | "system";
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemColorScheme = getSystemColorScheme();
  const [theme, setThemeState] = useState<"light" | "dark" | "system">(
    "system"
  );

  const setTheme = async (newTheme: "light" | "dark" | "system") => {
    setThemeState(newTheme);
    if (newTheme === "system") {
      await AsyncStorage.removeItem("theme");
    } else {
      await AsyncStorage.setItem("theme", newTheme);
    }
  };

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem("theme");
      if (savedTheme) {
        setThemeState(savedTheme as "light" | "dark");
      } else {
        setThemeState("system");
      }
    };
    loadTheme();
  }, []);

  const colorScheme: "light" | "dark" =
    theme === "system" ? systemColorScheme || "light" : theme;

  return (
    <ThemeContext.Provider value={{ colorScheme, setTheme, theme }}>
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
