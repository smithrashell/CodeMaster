import React from "react";
import { Container, Title, Stack } from "@mantine/core";
import { FocusAreasSelector } from "../../components/settings/FocusAreasSelector.jsx";
import { AdaptiveSettingsCard } from "../../components/settings/AdaptiveSettingsCard.jsx";
import { TimerSettingsCard } from "../../components/settings/TimerSettingsCard.jsx";
import { DisplaySettingsCard } from "../../components/settings/DisplaySettingsCard.jsx";
import { SettingsExportImport } from "../../components/settings/SettingsExportImport.jsx";

export function General() {
  return (
    <Container size="md" p="xl">
      <Title order={2} mb="xl" style={{ color: "var(--cm-text)" }}>
        Learning Settings
      </Title>
      
      <Stack gap="lg">
        <FocusAreasSelector />
        <AdaptiveSettingsCard />
        <TimerSettingsCard />
        <DisplaySettingsCard />
        <SettingsExportImport />
      </Stack>
    </Container>
  );
}