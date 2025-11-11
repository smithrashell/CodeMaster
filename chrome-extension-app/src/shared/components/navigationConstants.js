import {
  IconGauge,
  IconClock,
  IconSettings,
  IconTrendingUp,
  IconTarget,
} from "@tabler/icons-react";

export const mainLinksMockdata = [
  { icon: IconGauge, label: "Overview", path: "/" },
  { icon: IconTrendingUp, label: "Progress", path: "/progress" },
  { icon: IconClock, label: "Sessions", path: "/sessions" },
  { icon: IconTarget, label: "Strategy", path: "/strategy" },
  { icon: IconSettings, label: "Settings", path: "/settings" },
];

export const subLinksData = {
  "/": ["Overview"],
  "/progress": ["Learning Progress", "Goals"],
  "/sessions": ["Session History", "Productivity Insights"],
  "/strategy": ["Tag Mastery", "Learning Path"],
  "/settings": ["General", "Appearance", "Accessibility"],
};