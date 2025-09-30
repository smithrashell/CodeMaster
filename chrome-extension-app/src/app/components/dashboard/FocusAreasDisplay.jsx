import logger from "../../../shared/utils/logger.js";
import React, { useState, useEffect, useCallback } from "react";
import { Card, Text, Group, Button, Grid } from "@mantine/core";
import { IconTarget, IconInfoCircle } from "@tabler/icons-react";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler.js";
import { createPlaceholderCards } from './focusAreasHelpers.js';
import { GraduationAlert } from './GraduationAlert.jsx';
import { FocusAreasLoadingState } from './FocusAreasLoadingState.jsx';
import { FocusAreasEmptyState } from './FocusAreasEmptyState.jsx';
import { FocusAreaCard } from './FocusAreaCard.jsx';
import { PlaceholderCard } from './PlaceholderCard.jsx';
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
    return <FocusAreasLoadingState />;
  }

  if (focusAreas.length === 0) {
    return <FocusAreasEmptyState onNavigateToSettings={onNavigateToSettings} />;
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

      <GraduationAlert 
        graduationStatus={graduationStatus} 
        onAutoGraduate={handleAutoGraduate} 
      />

      <Grid gutter="md" mb="md">
        {focusAreas.map((tag) => (
          <Grid.Col key={tag} span={4}>
            <FocusAreaCard 
              tag={tag}
              masteryData={masteryData}
              masteredTags={masteredTags}
              graduationStatus={graduationStatus}
            />
          </Grid.Col>
        ))}
        
        {createPlaceholderCards(focusAreas.length).map((placeholder) => (
          <Grid.Col key={placeholder.key} span={4}>
            <PlaceholderCard text={placeholder.text} />
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