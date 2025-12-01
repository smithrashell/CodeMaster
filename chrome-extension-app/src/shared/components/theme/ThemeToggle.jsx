// components/ThemeToggle.jsx
import { useTheme } from "../../provider/themeprovider";
import { SegmentedControl, Group, rem } from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";

export default function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useTheme();


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
        }}
        data={options}
        radius="md"
        size="sm"
      />
    </Group>
  );
}
