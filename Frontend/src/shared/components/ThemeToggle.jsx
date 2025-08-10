// components/ThemeToggle.jsx
import { useTheme } from "../provider/themeprovider";
import { SegmentedControl, Group, rem } from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useChromeMessage } from "../hooks/useChromeMessage";

export default function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useTheme();
  const isLight = colorScheme === "light";
  const [theme, setTheme] = useState("light");

  // New approach using custom hook
  const {
    data: settings,
    loading,
    error,
  } = useChromeMessage({ type: "getSettings" }, [], {
    onSuccess: (response) => {
      const savedTheme = response?.theme || "light";
      if (savedTheme !== colorScheme) {
        toggleColorScheme(savedTheme);
      }
    },
  });

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
      />
    </Group>
  );
}
