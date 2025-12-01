
import { SegmentedControl, Switch, Group, rem } from "@mantine/core";
import { IconTextSize, IconLayout, IconSparkles } from "@tabler/icons-react";
import { useTheme } from "../../provider/themeprovider.jsx";

// Font Size Selector Component
export function FontSizeSelector() {
  const { fontSize, setFontSize } = useTheme();

  const fontOptions = [
    {
      value: "small",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconTextSize style={{ width: rem(14), height: rem(14) }} />
          <span style={{ fontSize: "12px" }}>Small</span>
        </div>
      ),
    },
    {
      value: "medium",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconTextSize style={{ width: rem(16), height: rem(16) }} />
          <span style={{ fontSize: "14px" }}>Medium</span>
        </div>
      ),
    },
    {
      value: "large",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconTextSize style={{ width: rem(18), height: rem(18) }} />
          <span style={{ fontSize: "16px" }}>Large</span>
        </div>
      ),
    },
  ];

  return (
    <Group justify="center">
      <SegmentedControl
        value={fontSize}
        onChange={setFontSize}
        data={fontOptions}
        radius="md"
        size="sm"
        fullWidth
      />
    </Group>
  );
}

// Layout Density Selector Component
export function LayoutDensitySelector() {
  const { layoutDensity, setLayoutDensity } = useTheme();

  const densityOptions = [
    {
      value: "compact",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconLayout style={{ width: rem(16), height: rem(16) }} />
          <span>Compact</span>
        </div>
      ),
    },
    {
      value: "comfortable",
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconLayout style={{ width: rem(16), height: rem(16) }} />
          <span>Comfortable</span>
        </div>
      ),
    },
  ];

  return (
    <Group justify="center">
      <SegmentedControl
        value={layoutDensity}
        onChange={setLayoutDensity}
        data={densityOptions}
        radius="md"
        size="sm"
        fullWidth
      />
    </Group>
  );
}

// Animation Toggle Component
export function AnimationToggle() {
  const { animationsEnabled, setAnimationsEnabled } = useTheme();

  return (
    <Group justify="space-between" style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconSparkles
          style={{
            width: rem(20),
            height: rem(20),
            color: "var(--cm-text)",
          }}
        />
        <span style={{ color: "var(--cm-text)" }}>Enable Animations</span>
      </div>
      <Switch
        checked={animationsEnabled}
        onChange={(event) => setAnimationsEnabled(event.currentTarget.checked)}
        color="blue"
        size="md"
      />
    </Group>
  );
}
