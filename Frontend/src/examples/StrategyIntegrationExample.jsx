import React, { useState } from "react";
import { Container, Stack, Button, Group, Text, Divider } from "@mantine/core";
import { HintPanel, PrimerSection } from "../content/components/strategy";
import { useStrategy } from "../shared/hooks/useStrategy";

// Example problem scenarios for testing
const problemScenarios = [
  { name: "Two Sum", tags: ["array", "hash table"] },
  {
    name: "Binary Tree Inorder",
    tags: ["binary tree", "depth-first search", "recursion"],
  },
  {
    name: "Sliding Window Maximum",
    tags: ["array", "sliding window", "monotonic stack"],
  },
  {
    name: "Course Schedule",
    tags: ["graph", "topological sort", "depth-first search"],
  },
  { name: "Edit Distance", tags: ["string", "dynamic programming"] },
  { name: "Merge Intervals", tags: ["array", "sorting", "greedy"] },
];

/**
 * Status Section component
 */
const StatusSection = ({ isDataLoaded, hints, primers, hasHints, hasPrimers, error }) => (
  <div>
    <Text size="sm" weight={500} mb="xs">
      System Status:
    </Text>
    <Group gap="sm">
      <Text size="xs" c={isDataLoaded ? "green" : "red"}>
        Strategy Data: {isDataLoaded ? "Loaded ✓" : "Loading..."}
      </Text>
      <Text size="xs" c={hasHints ? "blue" : "gray"}>
        Hints: {hints.length}
      </Text>
      <Text size="xs" c={hasPrimers ? "blue" : "gray"}>
        Primers: {primers.length}
      </Text>
    </Group>
    {error && (
      <Text size="xs" c="red" mt="xs">
        Error: {error}
      </Text>
    )}
  </div>
);

/**
 * Problem Selector component
 */
const ProblemSelector = ({ currentProblemTags, setCurrentProblemTags }) => (
  <div>
    <Text size="sm" weight={500} mb="sm">
      Select a Problem Scenario:
    </Text>
    <Group gap="xs">
      {problemScenarios.map((scenario, index) => (
        <Button
          key={index}
          size="xs"
          variant={
            JSON.stringify(currentProblemTags) ===
            JSON.stringify(scenario.tags)
              ? "filled"
              : "outline"
          }
          onClick={() => setCurrentProblemTags(scenario.tags)}
        >
          {scenario.name}
        </Button>
      ))}
    </Group>

    <Text size="xs" c="dimmed" mt="xs">
      Current tags: {currentProblemTags.join(", ")}
    </Text>
  </div>
);

/**
 * Advanced Hook Data Display component
 */
const AdvancedHookData = ({ contextualHints, generalHints, loading }) => (
  <div>
    <Text size="md" weight={600} mb="sm">
      🔍 Advanced Hook Data (useStrategy)
    </Text>
    <Stack gap="xs">
      <Group gap="lg">
        <Text size="sm">
          <strong>Contextual Hints:</strong> {contextualHints.length}
        </Text>
        <Text size="sm">
          <strong>General Hints:</strong> {generalHints.length}
        </Text>
        <Text size="sm">
          <strong>Loading:</strong> {loading ? "Yes" : "No"}
        </Text>
      </Group>

      {contextualHints.length > 0 && (
        <div>
          <Text size="xs" weight={500} c="blue">
            Multi-tag combinations found:
          </Text>
          {contextualHints.map((hint, index) => (
            <Text key={index} size="xs" c="dimmed">
              • {hint.primaryTag} + {hint.relatedTag}
            </Text>
          ))}
        </div>
      )}
    </Stack>
  </div>
);

/**
 * Integration Instructions component
 */
const IntegrationInstructions = () => (
  <div>
    <Text size="md" weight={600} mb="sm">
      🚀 Integration Instructions
    </Text>
    <Stack gap="xs">
      <Text size="sm">
        <strong>1. Import components:</strong>
      </Text>
      <Text
        size="xs"
        ff="monospace"
        bg="gray.1"
        p="xs"
        style={{ borderRadius: "4px" }}
      >
        {`import { HintPanel, PrimerSection } from '../content/components/strategy';`}
      </Text>

      <Text size="sm">
        <strong>2. Use in your problem components:</strong>
      </Text>
      <Text
        size="xs"
        ff="monospace"
        bg="gray.1"
        p="xs"
        style={{ borderRadius: "4px" }}
      >
        {`<PrimerSection problemTags={problem.tags} />`}
        <br />
        {`<HintPanel problemTags={problem.tags} />`}
      </Text>

      <Text size="sm">
        <strong>3. Optional: Use the hook for advanced features:</strong>
      </Text>
      <Text
        size="xs"
        ff="monospace"
        bg="gray.1"
        p="xs"
        style={{ borderRadius: "4px" }}
      >
        {`const { hints, primers, loading } = useStrategy(problemTags);`}
      </Text>
    </Stack>
  </div>
);

/**
 * Example component showing how to integrate the Strategy System
 * This demonstrates both the Hint Panel and Primer Section usage
 */
const StrategyIntegrationExample = () => {
  // Example problem tags - in real usage, these would come from your problem data
  const [currentProblemTags, setCurrentProblemTags] = useState([
    "array",
    "hash table",
  ]);
  const [showPrimer, setShowPrimer] = useState(true);
  const [showHints, setShowHints] = useState(true);

  // Use the strategy hook for advanced features
  const {
    hints,
    primers,
    loading,
    error,
    isDataLoaded,
    hasHints,
    hasPrimers,
    contextualHints,
    generalHints,
    refreshStrategy,
  } = useStrategy(currentProblemTags);

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <div>
          <Text size="xl" weight={700} mb="sm">
            Strategy System Integration Example
          </Text>
          <Text size="sm" c="dimmed">
            This example shows how to use the HintPanel and PrimerSection
            components with different problem tag combinations.
          </Text>
        </div>

        {/* Status Information */}
        <StatusSection 
          isDataLoaded={isDataLoaded}
          hints={hints}
          primers={primers}
          hasHints={hasHints}
          hasPrimers={hasPrimers}
          error={error}
        />

        {/* Problem Scenario Selector */}
        <ProblemSelector 
          currentProblemTags={currentProblemTags}
          setCurrentProblemTags={setCurrentProblemTags}
        />

        {/* Component Visibility Controls */}
        <Group gap="sm">
          <Button
            size="xs"
            variant={showPrimer ? "filled" : "outline"}
            onClick={() => setShowPrimer(!showPrimer)}
          >
            {showPrimer ? "Hide" : "Show"} Primer Section
          </Button>
          <Button
            size="xs"
            variant={showHints ? "filled" : "outline"}
            onClick={() => setShowHints(!showHints)}
          >
            {showHints ? "Hide" : "Show"} Hint Panel
          </Button>
          <Button size="xs" variant="light" onClick={refreshStrategy}>
            Refresh Strategy Data
          </Button>
        </Group>

        <Divider />

        {/* Primer Section - Show before starting problem */}
        {showPrimer && (
          <div>
            <Text size="md" weight={600} mb="sm">
              📖 Primer Section (Before Starting Problem)
            </Text>
            <PrimerSection
              problemTags={currentProblemTags}
              isVisible={showPrimer}
            />
          </div>
        )}

        {/* Hint Panel - Show during problem solving */}
        {showHints && (
          <div>
            <Text size="md" weight={600} mb="sm">
              💡 Hint Panel (During Problem Solving)
            </Text>
            <HintPanel problemTags={currentProblemTags} isVisible={showHints} />
          </div>
        )}

        {/* Advanced Hook Data Display */}
        <AdvancedHookData 
          contextualHints={contextualHints}
          generalHints={generalHints}
          loading={loading}
        />

        {/* Integration Instructions */}
        <IntegrationInstructions />
      </Stack>
    </Container>
  );
};

export default StrategyIntegrationExample;
