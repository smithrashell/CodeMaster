import React from "react";
import { Stack, Button } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";

export function DocumentationLinks() {
  const links = [
    { href: "https://github.com/smithrashell/CodeMaster/blob/main/README.md", label: "Getting Started Guide" },
    { href: "https://github.com/smithrashell/CodeMaster/blob/main/CHANGELOG.md", label: "Changelog" },
    { href: "https://github.com/smithrashell/CodeMaster/blob/main/CONTRIBUTING.md", label: "Contributing Guide" },
    { href: "https://github.com/smithrashell/CodeMaster", label: "GitHub Repository" },
  ];

  return (
    <Stack gap="sm">
      {links.map((link) => (
        <Button
          key={link.href}
          component="a"
          href={link.href}
          target="_blank"
          variant="subtle"
          rightSection={<IconExternalLink size={16} />}
          justify="space-between"
          fullWidth
        >
          {link.label}
        </Button>
      ))}
    </Stack>
  );
}
