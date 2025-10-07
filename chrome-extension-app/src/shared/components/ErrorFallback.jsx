/**
 * ErrorFallback Components for CodeMaster
 *
 * Specialized error fallback UIs for different sections of the application
 * with context-aware recovery options and user-friendly messaging.
 */


import {
  Container,
  Alert,
  Button,
  Text,
  Stack,
  Group,
  Card,
  List,
  ThemeIcon,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconRefresh,
  IconBug,
  IconClock,
  IconChartBar,
  IconDatabase,
  IconCheck,
} from "@tabler/icons-react";

// Generic fallback for any section
export const GenericErrorFallback = ({
  onRetry,
  onReload,
  onReportProblem,
  section = "Application",
}) => (
  <Container size="sm" py="xl">
    <Alert
      icon={<IconAlertTriangle size="1.1rem" />}
      title={`${section} Temporarily Unavailable`}
      color="red"
      variant="light"
    >
      <Stack spacing="md">
        <Text size="sm">
          We&apos;re having trouble loading this section. Your data is safe and
          we&apos;re working to fix this issue.
        </Text>

        <Group spacing="sm">
          <Button
            leftSection={<IconRefresh size="1rem" />}
            variant="filled"
            size="sm"
            onClick={onRetry}
          >
            Try Again
          </Button>

          <Button variant="outline" size="sm" onClick={onReload}>
            Reload Page
          </Button>

          {onReportProblem && (
            <Button
              leftSection={<IconBug size="1rem" />}
              variant="subtle"
              size="sm"
              onClick={onReportProblem}
            >
              Report Problem
            </Button>
          )}
        </Group>
      </Stack>
    </Alert>
  </Container>
);

// Timer-specific error fallback
export const TimerErrorFallback = ({ onRetry, onReportProblem }) => (
  <Container size="sm" py="xl">
    <Alert
      icon={<IconClock size="1.1rem" />}
      title="Timer Temporarily Unavailable"
      color="orange"
      variant="light"
    >
      <Stack spacing="md">
        <Text size="sm">
          The timer encountered an issue and couldn&apos;t continue tracking
          your session. Your progress data is safe and you can continue with
          other features.
        </Text>

        <Card p="md" withBorder>
          <Text size="xs" weight={500} mb="xs">
            Quick Recovery Steps:
          </Text>
          <List size="xs" spacing="xs">
            <List.Item
              icon={
                <ThemeIcon size={16} radius="xl" variant="light">
                  <IconCheck size="0.6rem" />
                </ThemeIcon>
              }
            >
              Your current session progress is saved
            </List.Item>
            <List.Item
              icon={
                <ThemeIcon size={16} radius="xl" variant="light">
                  <IconCheck size="0.6rem" />
                </ThemeIcon>
              }
            >
              You can start a new session anytime
            </List.Item>
            <List.Item
              icon={
                <ThemeIcon size={16} radius="xl" variant="light">
                  <IconCheck size="0.6rem" />
                </ThemeIcon>
              }
            >
              All your statistics remain intact
            </List.Item>
          </List>
        </Card>

        <Group spacing="sm">
          <Button
            leftSection={<IconClock size="1rem" />}
            variant="filled"
            size="sm"
            onClick={onRetry}
          >
            Restart Timer
          </Button>

          {onReportProblem && (
            <Button
              leftSection={<IconBug size="1rem" />}
              variant="outline"
              size="sm"
              onClick={onReportProblem}
            >
              Report Timer Issue
            </Button>
          )}
        </Group>
      </Stack>
    </Alert>
  </Container>
);

// Strategy system error fallback
export const StrategyErrorFallback = ({ onRetry, onReportProblem }) => (
  <Container size="sm" py="xl">
    <Alert
      icon={<IconChartBar size="1.1rem" />}
      title="Strategy Hints Temporarily Unavailable"
      color="blue"
      variant="light"
    >
      <Stack spacing="md">
        <Text size="sm">
          The strategy hint system encountered an issue. You can continue
          solving problems manually while we fix this.
        </Text>

        <Group spacing="sm">
          <Button
            leftSection={<IconRefresh size="1rem" />}
            variant="filled"
            size="sm"
            onClick={onRetry}
          >
            Retry Strategy System
          </Button>

          {onReportProblem && (
            <Button
              leftSection={<IconBug size="1rem" />}
              variant="outline"
              size="sm"
              onClick={onReportProblem}
            >
              Report Strategy Issue
            </Button>
          )}
        </Group>
      </Stack>
    </Alert>
  </Container>
);

// Dashboard-specific error fallback
export const DashboardErrorFallback = ({
  onRetry,
  onReload,
  onReportProblem,
  section = "Dashboard",
}) => (
  <Container size="sm" py="xl">
    <Alert
      icon={<IconDatabase size="1.1rem" />}
      title={`${section} Data Temporarily Unavailable`}
      color="red"
      variant="light"
    >
      <Stack spacing="md">
        <Text size="sm">
          We&apos;re having trouble loading your dashboard data. Your progress
          and statistics are safe - this is just a temporary display issue.
        </Text>

        <Card p="md" withBorder>
          <Text size="xs" weight={500} mb="xs">
            While this is being fixed:
          </Text>
          <List size="xs" spacing="xs">
            <List.Item
              icon={
                <ThemeIcon size={16} radius="xl" variant="light">
                  <IconCheck size="0.6rem" />
                </ThemeIcon>
              }
            >
              Your learning progress continues to be tracked
            </List.Item>
            <List.Item
              icon={
                <ThemeIcon size={16} radius="xl" variant="light">
                  <IconCheck size="0.6rem" />
                </ThemeIcon>
              }
            >
              You can still practice problems and take sessions
            </List.Item>
            <List.Item
              icon={
                <ThemeIcon size={16} radius="xl" variant="light">
                  <IconCheck size="0.6rem" />
                </ThemeIcon>
              }
            >
              All your data will be visible once the issue is resolved
            </List.Item>
          </List>
        </Card>

        <Group spacing="sm">
          <Button
            leftSection={<IconRefresh size="1rem" />}
            variant="filled"
            size="sm"
            onClick={onRetry}
          >
            Reload Data
          </Button>

          <Button variant="outline" size="sm" onClick={onReload}>
            Refresh Page
          </Button>

          {onReportProblem && (
            <Button
              leftSection={<IconBug size="1rem" />}
              variant="subtle"
              size="sm"
              onClick={onReportProblem}
            >
              Report Issue
            </Button>
          )}
        </Group>
      </Stack>
    </Alert>
  </Container>
);
