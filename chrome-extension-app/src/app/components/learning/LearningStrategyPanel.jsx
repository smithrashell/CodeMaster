import React from "react";
import { Card, Title, Text, Button, Stack } from "@mantine/core";
import logger from "../../../shared/utils/logging/logger.js";

const LearningStrategyPanel = ({ selectedTag, pathData, onTagDeselect }) => {
  return (
    <>
      <Title order={4} mb="md">
        {selectedTag ? `${selectedTag} Strategy` : 'Learning Intelligence'}
      </Title>
      <Stack gap="md">
        {selectedTag ? (
          <SelectedTagStrategy selectedTag={selectedTag} pathData={pathData} onTagDeselect={onTagDeselect} />
        ) : (
          <OverviewStrategy pathData={pathData} />
        )}
      </Stack>
    </>
  );
};

const SelectedTagStrategy = ({ selectedTag, pathData, onTagDeselect }) => {
  const tagData = pathData.find(t => t.tag === selectedTag);
  const progress = tagData?.progress || 0;

  const recommendations = {
    'array': [
      { name: 'Two Sum', difficulty: 'Easy', reason: 'Master hash table lookups' },
      { name: 'Container With Most Water', difficulty: 'Medium', reason: 'Two-pointer technique' },
      { name: 'Product of Array Except Self', difficulty: 'Medium', reason: 'Array manipulation mastery' }
    ],
    'string': [
      { name: 'Valid Anagram', difficulty: 'Easy', reason: 'Character frequency patterns' },
      { name: 'Longest Substring Without Repeating', difficulty: 'Medium', reason: 'Sliding window technique' },
      { name: 'Group Anagrams', difficulty: 'Medium', reason: 'String categorization' }
    ],
    'two-pointers': [
      { name: 'Valid Palindrome', difficulty: 'Easy', reason: 'Basic two-pointer approach' },
      { name: '3Sum', difficulty: 'Medium', reason: 'Multi-pointer coordination' },
      { name: 'Trapping Rain Water', difficulty: 'Hard', reason: 'Advanced pointer techniques' }
    ],
    'binary-search': [
      { name: 'Binary Search', difficulty: 'Easy', reason: 'Master the fundamentals' },
      { name: 'Search in Rotated Sorted Array', difficulty: 'Medium', reason: 'Modified binary search' },
      { name: 'Find Minimum in Rotated Array', difficulty: 'Medium', reason: 'Edge case handling' }
    ]
  };
  
  const tagRecs = recommendations[selectedTag] || [
    { name: 'Foundation Problem Set', difficulty: 'Mixed', reason: 'Build core understanding' },
    { name: 'Pattern Recognition', difficulty: 'Easy', reason: 'Identify common patterns' },
    { name: 'Incremental Challenges', difficulty: 'Progressive', reason: 'Gradual skill building' }
  ];

  return (
    <>
      <div>
        <Text size="sm" mb="xs">Learning Efficiency</Text>
        <Text fw={500} size="lg" c={progress >= 80 ? "green" : progress >= 40 ? "orange" : "red"}>
          {progress >= 80 ? 'Highly Efficient' : progress >= 40 ? 'Developing' : 'Building Foundation'}
        </Text>
      </div>
      
      <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-blue-0)" }}>
        <Text size="sm" fw={600} mb="xs">Problem Selection Impact</Text>
        <Text size="xs">
          {tagData?.isFocus 
            ? `Active focus: System prioritizes ${selectedTag} problems to accelerate mastery`
            : `Supportive role: ${selectedTag} appears in mixed problem sets to maintain proficiency`
          }
        </Text>
      </Card>

      <div>
        <Text size="sm" mb="xs">Smart Problem Recommendations</Text>
        <Stack gap="xs">
          {tagRecs.map((rec, index) => (
            <Card key={index} p="xs" withBorder radius="sm" style={{ 
              backgroundColor: rec.difficulty === 'Easy' ? '#f0f9ff' : rec.difficulty === 'Medium' ? '#fffbeb' : rec.difficulty === 'Hard' ? '#fef2f2' : '#f8fafc',
              borderColor: rec.difficulty === 'Easy' ? '#bfdbfe' : rec.difficulty === 'Medium' ? '#fed7aa' : rec.difficulty === 'Hard' ? '#fecaca' : '#e2e8f0',
              cursor: 'pointer'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <Text size="xs" fw={600} c="#1e293b">{rec.name}</Text>
                <Text size="xs" c={rec.difficulty === 'Easy' ? '#1e40af' : rec.difficulty === 'Medium' ? '#92400e' : rec.difficulty === 'Hard' ? '#dc2626' : '#64748b'} fw={500}>
                  {rec.difficulty}
                </Text>
              </div>
              <Text size="xs" c="#64748b">{rec.reason}</Text>
            </Card>
          ))}
        </Stack>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <Button 
          variant="filled" 
          size="sm" 
          style={{ backgroundColor: '#3b82f6', border: 'none' }}
          onClick={() => {
            logger.info(`Starting focused practice session for ${selectedTag}`);
            alert(`🎯 Launching ${selectedTag} practice session!\n\nSystem will prioritize problems that strengthen this skill and prepare you for the next level.`);
          }}
        >
          Start Practice
        </Button>
        <Button 
          variant="light" 
          size="sm" 
          onClick={onTagDeselect}
        >
          Back to Overview
        </Button>
      </div>
    </>
  );
};

const OverviewStrategy = ({ pathData }) => {
  const focusCount = pathData.filter(t => t.isFocus).length;
  const overallMastery = pathData.length > 0 
    ? Math.round(pathData.reduce((acc, tag) => acc + (tag.progress || 0), 0) / pathData.length)
    : 0;

  return (
    <>
      <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-indigo-0)" }}>
        <Text size="sm" fw={600} mb="xs">🎯 Active Learning Strategy</Text>
        <Text size="xs">
          Focus on {focusCount} core areas to maximize learning efficiency
        </Text>
      </Card>

      <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-green-0)" }}>
        <Text size="sm" fw={600} mb="xs">📈 Progress Optimization</Text>
        <Text size="xs">
          System adapts problem difficulty based on your {overallMastery}% overall mastery
        </Text>
      </Card>

      <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-orange-0)" }}>
        <Text size="sm" fw={600} mb="xs">🔄 Adaptive Learning</Text>
        <Text size="xs">
          Recent sessions influence future problem selection for personalized difficulty scaling
        </Text>
      </Card>
      
      <div style={{ marginTop: 'auto' }}>
        <Text size="sm" mb="xs">Strategy Insights</Text>
        <Text size="sm">
          • Click focus tags for detailed strategy
          <br />
          • Connections show learning relationships
          <br />
          • System optimizes for your learning pattern
        </Text>
      </div>
    </>
  );
};

export default LearningStrategyPanel;