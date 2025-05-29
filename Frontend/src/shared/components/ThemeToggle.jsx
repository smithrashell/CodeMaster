// components/ThemeToggle.jsx
import { useTheme } from "../provider/themeprovider";
import { SegmentedControl, Group, rem, Paper } from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useTheme();
  const isLight = colorScheme === "light";
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
      const savedTheme = response?.theme || "light";
      if (savedTheme !== colorScheme) {
        toggleColorScheme(savedTheme);
      }
    });
  }, []);
  
  
  const options = [
    {
      value: "light",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconSun style={{ width: rem(16), height: rem(16) }} />
          <span>Light</span>
        </div>
      ),
    },
    {
      value: "dark",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconMoon style={{ width: rem(16), height: rem(16) }} />
          <span>Dark</span>
        </div>
      ),
    },
  ];

  return (
    <Group justify="center" mt="md">
      <Paper
        shadow="md"
        radius="md"
        p="xs"
        style={{
          backgroundColor: isLight ? "#fff8d6" : "#2c2e33", // muted for light, dark gray for dark
          border: "1px solid",
          borderColor: isLight ? "#fcd263" : "#1a1b1e",
        }}
      >
        <SegmentedControl
          value={colorScheme}
          onChange={(newTheme) => {
            toggleColorScheme(newTheme);
          
            // update settings in Chrome
            chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
              const updatedSettings = { ...response, theme: newTheme };
              chrome.runtime.sendMessage({
                type: "setSettings",
                message: updatedSettings,
              });
            });
          }}
          
          data={options}
          radius="md"
          size="sm"
          fullWidth
          color= {isLight ? "#fcd263" : "#121212"}
          styles={{
            root: {
              backgroundColor: isLight ? "#fff3b0" : "#1f1f1f",
              border: isLight ? "1px solid #e5c84c" : "1px solid #444",
            },
            label: {
              padding: `${rem(4)} ${rem(12)}`,
              color: isLight ? "#145d7a" : "#ccc",
              justifyContent: "center",
              gap: rem(6),
              fontWeight: 500,
            },
            labelActive: {
              backgroundColor: isLight ? "#fcd263" : "#121212",
              color: isLight ? "#000" : "#ffdf",
              boxShadow: isLight
                ? "inset 0 0 4px rgba(0, 0, 0, 0.2)"
                : "inset 0 0 4px rgba(255, 255, 255, 0.05)",
            }
          }}
        />
      </Paper>
    </Group>
  );
}