/**
 * ErrorRecoveryUI Component for CodeMaster
 *
 * Comprehensive error recovery interface with actionable steps,
 * diagnostic information, and progressive recovery options.
 */

import { useState } from "react";
import {
  Modal,
  Button,
  Title,
  Text,
  Stack,
  Group,
  Alert,
  Accordion,
  List,
  Divider,
  Progress,
  Card,
  Badge,
  Textarea,
} from "@mantine/core";
import {
  IconBug,
  IconRefresh,
  IconAlertTriangle,
  IconCheck,
  IconSend,
  IconClipboard,
} from "@tabler/icons-react";
import {
  useRecoveryOperations,
  useDiagnostics,
  generateReportData,
  handleErrorReport,
} from "./ErrorRecoveryHelpers.js";

// Recovery Step Card Component
const RecoveryStepCard = ({ step, isRecovering, onAction }) => {
  const Icon = step.icon;
  return (
    <Card
      key={step.title}
      withBorder
      p="md"
      style={{ cursor: "pointer" }}
    >
      <Group spacing="md">
        <Icon size="1.2rem" color={step.color} />
        <div style={{ flex: 1 }}>
          <Text weight={500} size="sm">
            {step.title}
          </Text>
          <Text size="xs" c="dimmed">
            {step.description}
          </Text>
        </div>
        <Button
          size="xs"
          variant="light"
          color={step.color}
          onClick={onAction}
          disabled={isRecovering}
        >
          Try
        </Button>
      </Group>
    </Card>
  );
};

// Diagnostic Results Component
const DiagnosticResults = ({ diagnosticResults, diagnosticsRun }) => {
  if (!diagnosticsRun) return null;

  return (
    <List size="sm" spacing="xs">
      <List.Item
        icon={
          <IconCheck
            size="1rem"
            color={
              diagnosticResults.localStorage === "working"
                ? "green"
                : "red"
            }
          />
        }
      >
        Local Storage: {diagnosticResults.localStorage}
      </List.Item>
      <List.Item
        icon={
          <IconCheck
            size="1rem"
            color={
              diagnosticResults.chromeAPI === "available"
                ? "green"
                : "red"
            }
          />
        }
      >
        Chrome Extension API: {diagnosticResults.chromeAPI}
      </List.Item>
      <List.Item
        icon={
          <IconCheck
            size="1rem"
            color={
              diagnosticResults.memory === "normal"
                ? "green"
                : "orange"
            }
          />
        }
      >
        Memory Usage: {diagnosticResults.memory}
      </List.Item>
    </List>
  );
};

// Error Info Section Component
const ErrorInfoSection = ({ error, errorId }) => (
  <Alert color="red" variant="light">
    <Text size="sm" mb="xs">
      <strong>What happened:</strong>{" "}
      {error?.message || "An unexpected error occurred"}
    </Text>
    <Badge size="xs" color="gray">
      Error ID: {errorId}
    </Badge>
  </Alert>
);

// Recovery Progress Component
const RecoveryProgress = ({ isRecovering }) => {
  if (!isRecovering) return null;

  return (
    <Card withBorder p="md" bg="blue.0">
      <Group spacing="sm" mb="xs">
        <IconRefresh size="1rem" />
        <Text size="sm" weight={500}>
          Running recovery...
        </Text>
      </Group>
      <Progress value={100} animated color="blue" />
    </Card>
  );
};

// Recovery Options Section Component
const RecoveryOptionsSection = ({ steps, isRecovering }) => (
  <div>
    <Title order={5} mb="md">
      Recovery Options
    </Title>
    <Stack spacing="sm">
      {steps.map((step, index) => (
        <RecoveryStepCard
          key={index}
          step={step}
          isRecovering={isRecovering}
          onAction={step.action}
        />
      ))}
    </Stack>
  </div>
);

// Diagnostics Accordion Item Component
const DiagnosticsAccordionItem = ({ runDiagnostics, diagnosticsRun, diagnosticResults }) => (
  <Accordion.Item value="diagnostics">
    <Accordion.Control icon={<IconBug size="1rem" />}>
      System Diagnostics
    </Accordion.Control>
    <Accordion.Panel>
      <Stack spacing="sm">
        <Button
          variant="light"
          size="sm"
          onClick={runDiagnostics}
          disabled={diagnosticsRun}
          leftSection={<IconRefresh size="1rem" />}
        >
          {diagnosticsRun ? "Diagnostics Complete" : "Run Diagnostics"}
        </Button>

        <DiagnosticResults
          diagnosticResults={diagnosticResults}
          diagnosticsRun={diagnosticsRun}
        />
      </Stack>
    </Accordion.Panel>
  </Accordion.Item>
);

// Report Accordion Item Component
const ReportAccordionItem = ({ reportText, setReportText, handleReport, copyErrorInfo }) => (
  <Accordion.Item value="report">
    <Accordion.Control icon={<IconSend size="1rem" />}>
      Report This Problem
    </Accordion.Control>
    <Accordion.Panel>
      <Stack spacing="md">
        <Text size="sm" c="dimmed">
          Help us fix this issue by providing additional context:
        </Text>

        <Textarea
          placeholder="What were you doing when this error occurred? Any additional details that might help us reproduce the issue..."
          minRows={3}
          value={reportText}
          onChange={(event) => setReportText(event.currentTarget.value)}
        />

        <Group spacing="sm">
          <Button
            leftSection={<IconSend size="1rem" />}
            onClick={handleReport}
            size="sm"
          >
            Send Report
          </Button>

          <Button
            leftSection={<IconClipboard size="1rem" />}
            variant="light"
            onClick={copyErrorInfo}
            size="sm"
          >
            Copy Error Info
          </Button>
        </Group>
      </Stack>
    </Accordion.Panel>
  </Accordion.Item>
);

const ErrorRecoveryUI = ({
  opened,
  onClose,
  error,
  errorInfo,
  errorId,
  section,
  onRetry,
  _onReload,
  onReportProblem,
}) => {
  const [reportText, setReportText] = useState("");

  // Use custom hooks
  const {
    isRecovering,
    getRecoverySteps
  } = useRecoveryOperations(section, onRetry);

  const {
    diagnosticsRun,
    diagnosticResults,
    runDiagnostics
  } = useDiagnostics();

  const copyErrorInfo = () => {
    const errorText = `CodeMaster Error Report
Error ID: ${errorId}
Section: ${section}
Timestamp: ${new Date().toISOString()}
Error: ${error?.message || "Unknown error"}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

${reportText ? `User Description:\n${reportText}\n\n` : ""}Stack Trace:
${error?.stack || "No stack trace available"}`;

    navigator.clipboard.writeText(errorText).then(() => {
      console.info("Error info copied to clipboard");
    });
  };

  const handleReport = () => {
    const reportData = generateReportData({ errorId, error, errorInfo, section, reportText, diagnosticResults });
    handleErrorReport(reportData, onReportProblem, onClose);
  };

  const steps = getRecoverySteps();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group spacing="xs">
          <IconAlertTriangle size="1.2rem" color="red" />
          <Title order={4}>Error Recovery - {section}</Title>
        </Group>
      }
      size="lg"
    >
      <Stack spacing="md">
        {/* Error Overview */}
        <ErrorInfoSection error={error} errorId={errorId} />

        {/* Recovery Progress */}
        <RecoveryProgress isRecovering={isRecovering} />

        {/* Recovery Steps */}
        <RecoveryOptionsSection steps={steps} isRecovering={isRecovering} />

        <Divider />

        {/* Diagnostics Section */}
        <Accordion>
          <DiagnosticsAccordionItem
            runDiagnostics={runDiagnostics}
            diagnosticsRun={diagnosticsRun}
            diagnosticResults={diagnosticResults}
          />

          <ReportAccordionItem
            reportText={reportText}
            setReportText={setReportText}
            handleReport={handleReport}
            copyErrorInfo={copyErrorInfo}
          />
        </Accordion>
      </Stack>
    </Modal>
  );
};

export default ErrorRecoveryUI;
