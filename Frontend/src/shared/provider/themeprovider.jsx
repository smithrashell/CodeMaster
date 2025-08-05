import { createContext, useContext, useState, useEffect } from "react";
import { MantineProvider } from "@mantine/core";

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

function ThemeProviderWrapper({ children }) {
  const [colorScheme, setColorScheme] = useState("light");

  const toggleColorScheme = (value) => {
    setColorScheme((current) => (current === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    document.body.setAttribute("data-theme", colorScheme);
  }, [colorScheme]);

  return (
    <ThemeContext.Provider value={{ colorScheme, toggleColorScheme }}>
      <MantineProvider
        theme={{ colorScheme }}
        defaultColorScheme={colorScheme}
        withGlobalStyles
        withNormalizeCSS
      >
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}

export default ThemeProviderWrapper;
