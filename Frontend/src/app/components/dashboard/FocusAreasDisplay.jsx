import logger from "../../../shared/utils/logger.js";
import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Text,
  Group,
  Badge,
  Button,
  Tooltip,
  Alert,
  Progress,
  Grid,
} from "@mantine/core";
import {
  IconTarget,
  IconTrophy,
  IconSettings,
  IconInfoCircle,
} from "@tabler/icons-react";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler.js";
// Note: Fixed to use Chrome messaging pattern like other dashboard components

export function FocusAreasDisplay({ onNavigateToSettings }) {
  const [focusAreas, setFocusAreas] = useState([]);
  const [masteryData, setMasteryData] = useState([]);
  const [masteredTags, setMasteredTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [graduationStatus, setGraduationStatus] = useState(null);

  const loadFocusAreasData = useCallback(async () => {
    try {
      setLoading(true);

      // Use Chrome messaging pattern to get focus areas data
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: 'getFocusAreasData'
      });
      
      const data = response?.result || {};
      
      const userFocusAreas = data.focusAreas || [];
      if (userFocusAreas.length === 0) {
        setFocusAreas([]);
        setLoading(false);
        return;
      }

      // Set data from background script response
      setMasteryData(data.masteryData || []);
      setMasteredTags(data.masteredTags || []);
      setGraduationStatus(data.graduationStatus || null);
      setFocusAreas(userFocusAreas);
      
    } catch (error) {
      logger.error("Error loading focus areas data:", error);
      setFocusAreas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFocusAreasData();
  }, [loadFocusAreasData]);

  const getTagProgress = (tagName) => {
    const tagData = masteryData.find((tag) => tag.tag === tagName);
    if (!tagData || tagData.totalAttempts === 0) return 0;
    return Math.round((tagData.successfulAttempts / tagData.totalAttempts) * 100);
  };

  const getHintEffectiveness = (tagName) => {
    const tagData = masteryData.find((tag) => tag.tag === tagName);
    return tagData?.hintHelpfulness || "medium";
  };

  const getHintIcon = (effectiveness) => {
    switch (effectiveness) {
      case "high":
        return "💡"; // Bright idea
      case "medium":
        return "📝"; // Note taking
      case "low":
        return "⚡"; // Quick/minimal help needed
      default:
        return "💡";
    }
  };

  const handleAutoGraduate = async () => {
    try {
      // Use Chrome messaging pattern for graduation
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: 'graduateFocusAreas'
      });
      
      if (response?.result?.updated) {
        await loadFocusAreasData(); // Refresh data
      }
    } catch (error) {
      logger.error("Error auto-graduating focus areas:", error);
    }
  };

  if (loading) {
    return (
      <Card withBorder>
        <Group gap="xs" mb="xs">
          <IconTarget size={16} />
          <Text size="sm" fw={500}>Focus Areas</Text>
        </Group>
        <Text size="sm" c="dimmed">Loading...</Text>
      </Card>
    );
  }

  if (focusAreas.length === 0) {
    return (
      <Card withBorder>
        <Group gap="xs" mb="xs">
          <IconTarget size={16} />
          <Text size="sm" fw={500}>Focus Areas</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="xs">
          No focus areas selected
        </Text>
        <Text size="xs" c="dimmed" mb="md">
          Set focus areas to prioritize specific tags in your learning sessions
        </Text>
        {onNavigateToSettings && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconSettings size={14} />}
            onClick={onNavigateToSettings}
          >
            Configure Focus Areas
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card withBorder>
      <Group gap="xs" mb="md" justify="space-between">
        <Group gap="xs">
          <IconTarget size={16} />
          <Text size="sm" fw={500}>Focus Areas</Text>
        </Group>
        {onNavigateToSettings && (
          <Button
            size="xs"
            variant="subtle"
            onClick={onNavigateToSettings}
          >
            Edit
          </Button>
        )}
      </Group>

      {graduationStatus?.needsUpdate && (
        <Alert color="green" variant="light" mb="md">
          <Group gap="xs" align="center">
            <IconTrophy size={16} />
            <Text size="sm">
              🎉 You&apos;ve mastered {graduationStatus.masteredTags.length} focus area(s)!
            </Text>
            <Button size="xs" onClick={handleAutoGraduate}>
              Graduate
            </Button>
          </Group>
        </Alert>
      )}

      {/* Full width horizontal layout for focus areas */}
      <Grid gutter="md" mb="md">
        {focusAreas.map((tag) => {
          const progress = getTagProgress(tag);
          const isMastered = masteredTags.includes(tag);
          const isNearMastery = graduationStatus?.nearMasteryTags?.includes(tag);
          const hintEffectiveness = getHintEffectiveness(tag);
          const hintIcon = getHintIcon(hintEffectiveness);
          
          return (
            <Grid.Col key={tag} span={4}>
              <Card withBorder p="sm" h="100%">
                <Group gap="xs" mb="xs" align="center" justify="space-between">
                  <Badge
                    color={
                      isMastered ? "green" : 
                      isNearMastery ? "yellow" : 
                      progress >= 60 ? "blue" : "gray"
                    }
                    variant="light"
                    size="sm"
                    leftSection={isMastered ? <IconTrophy size={12} /> : null}
                  >
                    {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
                  </Badge>
                  <Group gap="xs" align="center">
                    <Tooltip 
                      label={`Hints are ${hintEffectiveness}ly helpful for this topic`}
                      position="top"
                    >
                      <Text size="xs" style={{ cursor: "help" }}>
                        {hintIcon}
                      </Text>
                    </Tooltip>
                    <Text size="xs" fw={500} c="dimmed">
                      {progress}%
                    </Text>
                  </Group>
                </Group>
                
                <Tooltip label={`${progress}% mastery - ${isMastered ? "Mastered" : isNearMastery ? "Near Mastery" : "In Progress"}`}>
                  <Progress
                    value={progress}
                    size="md"
                    color={
                      isMastered ? "green" : 
                      isNearMastery ? "yellow" : 
                      progress >= 60 ? "blue" : "gray"
                    }
                    animated={!isMastered}
                  />
                </Tooltip>
                
                {isMastered && (
                  <Text size="xs" c="green" mt="xs" style={{ textAlign: "center" }}>
                    ✨ Mastered
                  </Text>
                )}
                {isNearMastery && !isMastered && (
                  <Text size="xs" c="yellow" mt="xs" style={{ textAlign: "center" }}>
                    🔥 Almost there!
                  </Text>
                )}
              </Card>
            </Grid.Col>
          );
        })}
        
        {/* Add placeholder cards if less than 3 focus areas to maintain visual balance */}
        {focusAreas.length < 3 && [...Array(3 - focusAreas.length)].map((_, index) => (
          <Grid.Col key={`placeholder-${index}`} span={4}>
            <Card withBorder p="sm" h="100%" style={{ 
              backgroundColor: "#f8f9fa", 
              border: "2px dashed #e0e0e0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "80px"
            }}>
              <Text size="xs" c="dimmed" style={{ textAlign: "center" }}>
                {focusAreas.length === 0 ? "Select focus areas to get started" : "Add another focus area"}
              </Text>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      <Group gap="xs" mt="md" align="center">
        <IconInfoCircle size={12} />
        <Text size="xs" c="dimmed">
          Focus areas receive 20% higher priority in practice sessions
        </Text>
      </Group>
    </Card>
  );
}