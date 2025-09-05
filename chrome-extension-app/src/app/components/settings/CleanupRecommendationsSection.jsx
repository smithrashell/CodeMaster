/**
 * Cleanup Recommendations Section Component
 *
 * Displays cleanup recommendations for storage optimization.
 */
import React from "react";
import {
  Card,
  Title,
  Text,
  Badge,
  Accordion,
} from "@mantine/core";
import { IconDatabase } from "@tabler/icons-react";

export const CleanupRecommendationsSection = ({ cleanupRecommendations, formatBytes }) => (
  cleanupRecommendations && (
    <Card mb="lg">
      <Title order={4} mb="md">
        Cleanup Recommendations
        <Badge ml="xs" color="blue">
          Est. {formatBytes(cleanupRecommendations.totalEstimatedSavings)}
        </Badge>
      </Title>
      <Accordion>
        <Accordion.Item value="indexeddb">
          <Accordion.Control icon={<IconDatabase size={20} />}>
            IndexedDB Cleanup ({cleanupRecommendations.indexedDB?.actions?.length || 0} actions)
          </Accordion.Control>
          <Accordion.Panel>
            {cleanupRecommendations.indexedDB?.actions?.map((action, index) => (
              <div key={index} style={{ marginBottom: "8px" }}>
                <Text size="sm">
                  <b>{action.type}:</b> {action.description}
                  {action.estimatedSavings && (
                    <Badge ml="xs" size="sm" color="green">
                      {formatBytes(action.estimatedSavings)}
                    </Badge>
                  )}
                </Text>
              </div>
            ))}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Card>
  )
);

export default CleanupRecommendationsSection;