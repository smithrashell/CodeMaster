import React from "react";
import { Container, Title, Stack, Paper, Text, Button, Group } from "@mantine/core";
import { IconBug, IconQuestionMark, IconBook, IconBrandGithub } from "@tabler/icons-react";
import { FAQSection } from "./FAQSection.jsx";
import { TroubleshootingSection } from "./TroubleshootingSection.jsx";
import { DocumentationLinks } from "./DocumentationLinks.jsx";
import classes from "./Help.module.css";

export function HelpPage() {
  const handleReportIssue = () => {
    const repoUrl = "https://github.com/smithrashell/CodeMaster";
    const issueUrl = `${repoUrl}/issues/new?template=bug_report.md`;
    const newWindow = window.open(issueUrl, "_blank", "noopener,noreferrer");
    if (newWindow) newWindow.opener = null;
  };

  const handleFeatureRequest = () => {
    const repoUrl = "https://github.com/smithrashell/CodeMaster";
    const issueUrl = `${repoUrl}/issues/new?template=feature_request.md`;
    const newWindow = window.open(issueUrl, "_blank", "noopener,noreferrer");
    if (newWindow) newWindow.opener = null;
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} mb="xs">Help & Support</Title>
          <Text c="dimmed">Find answers, report issues, and get help with CodeMaster</Text>
        </div>

        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Title order={3} mb="md">Need Help?</Title>
          <Group gap="md">
            <Button
              leftSection={<IconBug size={18} />}
              onClick={handleReportIssue}
              variant="filled"
              color="red"
            >
              Report a Bug
            </Button>
            <Button
              leftSection={<IconQuestionMark size={18} />}
              onClick={handleFeatureRequest}
              variant="outline"
            >
              Request a Feature
            </Button>
            <Button
              leftSection={<IconBrandGithub size={18} />}
              component="a"
              href="https://github.com/smithrashell/CodeMaster/issues"
              target="_blank"
              variant="light"
            >
              View All Issues
            </Button>
          </Group>
        </Paper>

        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Title order={3} mb="md">Frequently Asked Questions</Title>
          <FAQSection />
        </Paper>

        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Title order={3} mb="md">Troubleshooting Guide</Title>
          <TroubleshootingSection />
        </Paper>

        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Title order={3} mb="md">
            <Group gap="xs">
              <IconBook size={24} />
              Documentation
            </Group>
          </Title>
          <DocumentationLinks />
        </Paper>

        <Paper shadow="sm" p="md" radius="md" withBorder className={classes.contactSection}>
          <Title order={3} mb="sm">Still Need Help?</Title>
          <Text mb="md">
            Can&apos;t find the answer you&apos;re looking for? Create a GitHub issue and we&apos;ll help you out.
          </Text>
          <Button
            leftSection={<IconBrandGithub size={18} />}
            onClick={handleReportIssue}
            size="md"
            variant="filled"
          >
            Create GitHub Issue
          </Button>
        </Paper>
      </Stack>
    </Container>
  );
}
