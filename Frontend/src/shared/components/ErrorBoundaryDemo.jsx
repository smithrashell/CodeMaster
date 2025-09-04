/**
 * Error Boundary Demo Component for CodeMaster
 *
 * Simple demo component to test error boundary functionality
 * and verify that error reporting works correctly.
 */

import  { useState } from "react";
import { Button, Stack, Card, Text, Group } from "@mantine/core";
import { IconBug, IconRefresh } from "@tabler/icons-react";
import ErrorBoundary from "./ErrorBoundary";
import { GenericErrorFallback, TimerErrorFallback } from "./ErrorFallback";

// Component that throws different types of errors for testing
const ErrorThrower = ({ errorType = "none" }) => {
  if (errorType === "render") {
    throw new Error("Render error: Component failed during rendering");
  }

  if (errorType === "async") {
    setTimeout(() => {
      throw new Error("Async error: Unhandled promise rejection");
    }, 100);
  }

  if (errorType === "network") {
    throw new Error("Network error: Failed to fetch data from server");
  }

  if (errorType === "memory") {
    throw new Error("Memory error: Quota exceeded");
  }

  return (
    <Card padding="md" withBorder>
      <Text size="sm" c="green">
        ✅ Component is working normally (errorType: {errorType})
      </Text>
    </Card>
  );
};

// Interactive component that can trigger errors
const InteractiveErrorTrigger = () => {
  const [errorType, setErrorType] = useState("none");
  const [key, setKey] = useState(0); // Force re-render

  const triggerError = (type) => {
    setErrorType(type);
  };

  const resetComponent = () => {
    setErrorType("none");
    setKey((prev) => prev + 1);
  };

  return (
    <Card padding="md" withBorder>
      <Stack spacing="md">
        <Text weight={500}>Error Boundary Testing</Text>

        <Group spacing="sm">
          <Button
            size="xs"
            variant="outline"
            color="red"
            leftSection={<IconBug size="0.8rem" />}
            onClick={() => triggerError("render")}
          >
            Render Error
          </Button>

          <Button
            size="xs"
            variant="outline"
            color="orange"
            leftSection={<IconBug size="0.8rem" />}
            onClick={() => triggerError("network")}
          >
            Network Error
          </Button>

          <Button
            size="xs"
            variant="outline"
            color="yellow"
            leftSection={<IconBug size="0.8rem" />}
            onClick={() => triggerError("memory")}
          >
            Memory Error
          </Button>

          <Button
            size="xs"
            variant="filled"
            color="blue"
            leftSection={<IconRefresh size="0.8rem" />}
            onClick={resetComponent}
          >
            Reset
          </Button>
        </Group>

        <ErrorBoundary
          key={key}
          section="Demo Component"
          fallback={GenericErrorFallback}
          onReportProblem={(errorData) => {
            // eslint-disable-next-line no-console
            console.log("Demo Error Report:", errorData);
            alert(`Error reported: ${errorData.error?.message}`);
          }}
        >
          <ErrorThrower errorType={errorType} />
        </ErrorBoundary>
      </Stack>
    </Card>
  );
};

const ErrorBoundaryDemo = () => {
  return (
    <Stack spacing="lg" p="md">
      <Text size="xl" weight={700}>
        Error Boundary Demo
      </Text>

      <Text size="sm" c="dimmed">
        This demo shows how error boundaries catch component errors and provide
        user-friendly recovery options. Click the buttons to trigger different
        types of errors and test the error handling system.
      </Text>

      {/* Demo 1: Generic Error Boundary */}
      <Card padding="lg" withBorder>
        <Text weight={600} mb="md">
          Generic Error Boundary
        </Text>
        <InteractiveErrorTrigger />
      </Card>

      {/* Demo 2: Timer-specific Error Boundary */}
      <Card padding="lg" withBorder>
        <Text weight={600} mb="md">
          Timer-specific Error Boundary
        </Text>
        <ErrorBoundary
          section="Timer Component"
          fallback={TimerErrorFallback}
          onReportProblem={(errorData) => {
            // eslint-disable-next-line no-console
            console.log("Timer Error Report:", errorData);
          }}
        >
          <ErrorThrower errorType="none" />
        </ErrorBoundary>
      </Card>

      {/* Demo 3: Nested Error Boundaries */}
      <Card padding="lg" withBorder>
        <Text weight={600} mb="md">
          Nested Error Boundaries
        </Text>
        <ErrorBoundary section="Outer Boundary" fallback={GenericErrorFallback}>
          <Stack spacing="sm">
            <Text size="sm">Outer boundary content is working</Text>
            <ErrorBoundary
              section="Inner Boundary"
              fallback={GenericErrorFallback}
            >
              <ErrorThrower errorType="none" />
            </ErrorBoundary>
          </Stack>
        </ErrorBoundary>
      </Card>
    </Stack>
  );
};

export default ErrorBoundaryDemo;
