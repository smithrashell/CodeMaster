// components/ThemeToggle.jsx
import { useTheme } from "../provider/themeprovider"; // or your export path
import { SegmentedControl, Group, rem } from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";

export default function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useTheme();

  return (
    <Group justify="center" mt="md">
      <SegmentedControl
        value={colorScheme}
        onChange={toggleColorScheme}
        data={[
          {
            value: "light",
            label: (
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <IconSun style={{ width: rem(16), height: rem(16) }} />
                <span>Light</span>
              </div>
            ),
          },
          {
            value: "dark",
            label: (
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <IconMoon style={{ width: rem(16), height: rem(16) }} />
                <span>Dark</span>
              </div>
            ),
          },
        ]}
        radius="md"
        size="sm"
        fullWidth
        color="dark"
        styles={{
          label: {
            padding: `${rem(4)} ${rem(12)}`,
            justifyContent: "center",
            gap: rem(6),
          },
        }}
      />
    </Group>
  );
}
