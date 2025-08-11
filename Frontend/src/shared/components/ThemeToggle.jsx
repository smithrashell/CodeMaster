// components/ThemeToggle.jsx
import { useTheme } from "../provider/themeprovider";
import { SegmentedControl, Group, rem } from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";
import { useChromeMessage } from "../hooks/useChromeMessage";

export default function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useTheme();

  // Load theme from Chrome storage
  useChromeMessage({ type: "getSettings" }, [], {
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

          // Update settings in Chrome or localStorage as fallback
          if (typeof chrome !== "undefined" && chrome.runtime) {
            chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
              if (!chrome.runtime.lastError) {
                const updatedSettings = { ...response, theme: newTheme };
                chrome.runtime.sendMessage({
                  type: "setSettings",
                  message: updatedSettings,
                });
              }
            });
          }
        }}
        data={options}
        radius="md"
        size="sm"
        fullWidth
      />
    </Group>
  );
}
