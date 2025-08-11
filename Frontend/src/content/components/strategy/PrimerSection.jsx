import React, { useState, useEffect } from "react";
import {
  Card,
  Text,
  Badge,
  Stack,
  Group,
  Loader,
  Alert,
  Divider,
} from "@mantine/core";
import { IconBook, IconInfoCircle, IconTags } from "@tabler/icons-react";
import StrategyService from "../../services/strategyService";
import { HintInteractionService } from "../../../shared/services/hintInteractionService";

/**
 * PrimerSection - Displays tag overviews and general strategies before starting a problem
 * Shows one general tip per tag to help users understand the problem's focus areas
 */
const PrimerSection = ({
  problemTags = [],
  problemId = null,
  isVisible = true,
  className = "",
}) => {
  const [primers, setPrimers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load primers when problem tags change
  useEffect(() => {
    if (problemTags.length > 0) {
      loadPrimers();
    } else {
      setPrimers([]);
    }
  }, [problemTags]);

  const loadPrimers = async () => {
    try {
      setLoading(true);
      setError(null);

      const tagPrimers = await StrategyService.getTagPrimers(problemTags);
      setPrimers(tagPrimers);

      // Track primer viewing when successfully loaded
      if (tagPrimers && tagPrimers.length > 0) {
        try {
          await HintInteractionService.saveHintInteraction({
            problemId: problemId || "unknown",
            hintId: "primer-section",
            hintType: "primer",
            primaryTag: problemTags[0] || "unknown",
            relatedTag: problemTags.length > 1 ? problemTags[1] : null,
            content: `Viewed primers for ${problemTags.join(", ")}`,
            problemTags: problemTags,
            action: "viewed",
            sessionContext: {
              primerCount: tagPrimers.length,
              componentType: "PrimerSection",
              tagsDisplayed: problemTags,
            },
          });
        } catch (trackingError) {
          console.warn("Failed to track primer view:", trackingError);
        }
      }
    } catch (err) {
      console.error("Error loading primers:", err);
      setError("Failed to load tag information");
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible || problemTags.length === 0) {
    return null;
  }

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      className={className}
      style={{ marginBottom: "1.5rem" }}
    >
      <Group gap="xs" mb="lg">
        <IconBook size={24} color="#4c6ef5" />
        <div>
          <Text size="lg" weight={600}>
            Problem Overview
          </Text>
          <Text size="sm" c="dimmed">
            Key concepts and strategies for this problem
          </Text>
        </div>
      </Group>

      {loading && (
        <Group justify="center" p="xl">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            Loading problem overview...
          </Text>
        </Group>
      )}

      {error && (
        <Alert
          icon={<IconInfoCircle size={16} />}
          color="red"
          variant="light"
          mb="md"
        >
          {error}
        </Alert>
      )}

      {!loading && !error && primers.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" p="xl">
          No overview information available for these tags.
        </Text>
      )}

      {!loading && !error && primers.length > 0 && (
        <Stack gap="lg">
          {primers.map((primer, index) => (
            <div key={primer.tag}>
              <Group gap="sm" mb="sm">
                <Badge
                  size="md"
                  variant="light"
                  color="blue"
                  leftSection={<IconTags size={14} />}
                >
                  {primer.tag}
                </Badge>
              </Group>

              {/* Overview */}
              <Text size="sm" mb="sm" lh={1.5}>
                <strong>What it is:</strong> {primer.overview}
              </Text>

              {/* General Strategy */}
              <Text size="sm" mb="sm" lh={1.5}>
                <strong>General approach:</strong> {primer.strategy}
              </Text>

              {/* Common Patterns */}
              {primer.patterns && primer.patterns.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <Text size="xs" weight={500} c="dimmed" mb="xs">
                    COMMON PATTERNS:
                  </Text>
                  <Group gap="xs">
                    {primer.patterns
                      .slice(0, 4)
                      .map((pattern, patternIndex) => (
                        <Badge
                          key={patternIndex}
                          size="xs"
                          variant="outline"
                          color="gray"
                        >
                          {pattern}
                        </Badge>
                      ))}
                    {primer.patterns.length > 4 && (
                      <Badge size="xs" variant="outline" color="gray">
                        +{primer.patterns.length - 4} more
                      </Badge>
                    )}
                  </Group>
                </div>
              )}

              {/* Related Tags */}
              {primer.related && primer.related.length > 0 && (
                <div>
                  <Text size="xs" weight={500} c="dimmed" mb="xs">
                    OFTEN COMBINED WITH:
                  </Text>
                  <Group gap="xs">
                    {primer.related
                      .slice(0, 4)
                      .map((relatedTag, relatedIndex) => (
                        <Badge
                          key={relatedIndex}
                          size="xs"
                          variant="dot"
                          color="blue"
                        >
                          {relatedTag}
                        </Badge>
                      ))}
                    {primer.related.length > 4 && (
                      <Badge size="xs" variant="dot" color="blue">
                        +{primer.related.length - 4} more
                      </Badge>
                    )}
                  </Group>
                </div>
              )}

              {/* Divider between tags (except for last one) */}
              {index < primers.length - 1 && <Divider my="lg" />}
            </div>
          ))}
        </Stack>
      )}
    </Card>
  );
};

export default PrimerSection;
