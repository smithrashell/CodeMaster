import React from "react";
import { Container, Title, Stack } from "@mantine/core";
import { FocusAreasSelector } from "../../components/settings/FocusAreasSelector.jsx";
import { AdaptiveSettingsCard } from "../../components/settings/AdaptiveSettingsCard.jsx";
import { TimerSettingsCard } from "../../components/settings/TimerSettingsCard.jsx";
// TODO: Re-enable for future release when import/export is needed
// import { SettingsExportImport } from "../../components/settings/SettingsExportImport.jsx";

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
        {/* TODO: Re-enable for future release when import/export is needed */}
        {/* <SettingsExportImport /> */}
      </Stack>
    </Container>
  );
}