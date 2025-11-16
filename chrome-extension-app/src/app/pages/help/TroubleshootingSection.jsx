import React from "react";
import { Accordion, List, Text, Group, Badge } from "@mantine/core";

export function TroubleshootingSection() {
  return (
    <Accordion variant="separated">
      <Accordion.Item value="extension-not-loading">
        <Accordion.Control>
          <Group gap="xs">
            <Badge color="red" size="xs">Common</Badge>
            Extension not loading on LeetCode
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Text mb="sm">Try these steps:</Text>
          <List spacing="xs" size="sm" type="ordered">
            <List.Item>Refresh the LeetCode page (Ctrl+R or Cmd+R)</List.Item>
            <List.Item>Check if the extension is enabled in Chrome Extensions (chrome://extensions)</List.Item>
            <List.Item>Disable and re-enable the extension</List.Item>
            <List.Item>Clear browser cache and cookies for LeetCode</List.Item>
            <List.Item>If issue persists, report it on GitHub</List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="data-not-syncing">
        <Accordion.Control>Dashboard shows no data or old data</Accordion.Control>
        <Accordion.Panel>
          <Text mb="sm">Common causes and solutions:</Text>
          <List spacing="xs" size="sm" type="ordered">
            <List.Item>Close and reopen the dashboard page</List.Item>
            <List.Item>Check browser console (F12) for error messages</List.Item>
            <List.Item>Verify you&apos;ve completed at least one practice session</List.Item>
            <List.Item>Try clearing extension storage (Settings → General → Reset Data)</List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="modal-keeps-appearing">
        <Accordion.Control>Welcome Back modal keeps appearing</Accordion.Control>
        <Accordion.Panel>
          <Text mb="sm">This usually happens when the dismissal isn&apos;t saved properly:</Text>
          <List spacing="xs" size="sm" type="ordered">
            <List.Item>Make sure to click &quot;Close&quot; or select an option in the modal</List.Item>
            <List.Item>Check if cookies/storage are being cleared on browser close</List.Item>
            <List.Item>Ensure extension has storage permissions enabled</List.Item>
            <List.Item>If problem persists, report as a bug on GitHub</List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="performance-issues">
        <Accordion.Control>Slow performance or freezing</Accordion.Control>
        <Accordion.Panel>
          <Text mb="sm">Performance optimization steps:</Text>
          <List spacing="xs" size="sm" type="ordered">
            <List.Item>Check if you have a large number of solved problems (1000+)</List.Item>
            <List.Item>Clear old session history (Settings → General → Cleanup)</List.Item>
            <List.Item>Disable other Chrome extensions temporarily to test</List.Item>
            <List.Item>Update to the latest version of CodeMaster</List.Item>
            <List.Item>Report with browser console logs if issue continues</List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
