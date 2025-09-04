import React, { useState, useEffect } from "react";
import { Container, Grid, Card, Title, Text, Button, Stack, ScrollArea, Group, SimpleGrid, Select, Badge, Divider, rem, Box } from "@mantine/core";
import { IconBulb, IconTrendingUp, IconTarget, IconClock } from "@tabler/icons-react";
import { usePageData } from "../../hooks/usePageData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Treemap,
  Rectangle,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import LearningPathVisualization from "../../components/learning/LearningPathVisualization.jsx";

export function LearningPath() {
  const { data: appState } = usePageData('learning-path');
  const [pathData, setPathData] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);

  useEffect(() => {
    if (!appState) return;

    // Debug: Check appState structure for data availability
    // console.log("Learning Path - appState structure:", appState);

    // Use mastery data directly from appState which now includes progress and isFocus
    const masteryData = appState.mastery?.masteryData || appState.learningState?.masteryData || appState.progress?.learningState?.masteryData || [];
    const focusTags = appState.mastery?.focusTags || appState.learningState?.focusTags || appState.progress?.learningState?.focusTags || [];
    const unmasteredTags = appState.mastery?.unmasteredTags || appState.learningState?.unmasteredTags || appState.progress?.learningState?.unmasteredTags || [];

    // Debug: Check extracted data
    console.log("Learning Path - extracted data:", { 
      masteryDataLength: masteryData.length,
      masteryData: masteryData,
      focusTags: focusTags,
      unmasteredTags: unmasteredTags
    });

    // Create progression data for visualization, use existing progress or calculate it
    const progressionData = masteryData.map(tag => ({
      tag: tag.tag,
      progress: tag.progress || (tag.totalAttempts > 0 ? Math.round((tag.successfulAttempts / tag.totalAttempts) * 100) : 0),
      attempts: tag.totalAttempts,
      mastered: tag.mastered,
      isFocus: tag.isFocus !== undefined ? tag.isFocus : focusTags.includes(tag.tag)
    })).sort((a, b) => b.progress - a.progress);

    console.log("Learning Path - final progressionData:", progressionData);

    // Set progression data - empty array is valid state for new users
    setPathData(progressionData);

    // Generate recommendations
    const recs = [];
    if (unmasteredTags.length > 0) {
      recs.push(`Focus on ${unmasteredTags.slice(0, 3).join(', ')} for skill advancement`);
    }
    if (focusTags.length > 0) {
      recs.push(`Continue practicing ${focusTags[0]} - you're making progress!`);
    }
    recs.push("Consider reviewing mastered topics to maintain proficiency");
    
    setRecommendations(recs);
  }, [appState]);

  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">
        Learning Path & Strategy
      </Title>
     

      <Grid gutter="md">
        {/* Visual Learning Path */}
        <Grid.Col span={8}>
          <Card withBorder p="lg" style={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
            {/* Learning Path Visualization */}
            <div style={{ 
              position: 'relative', 
              height: '480px',
              minHeight: '480px',
              overflow: 'hidden',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              {pathData.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center'
                }}>
                  <Text size="lg" fw={600} mb="md" c="var(--cm-text)">No Learning Progress Yet</Text>
                  <Text size="sm" c="dimmed" mb="lg">
                    Complete some coding sessions to see your learning path visualization.
                  </Text>
                  <Button 
                    variant="light" 
                    onClick={() => window.open("https://leetcode.com/problems/", "_blank")}
                  >
                    Start Your First Session
                  </Button>
                </div>
              ) : (
                <LearningPathVisualization 
                  pathData={pathData} 
                  onNodeClick={(tag) => setSelectedTag(tag)}
                />
              )}
            </div>
            
            {/* Legend and Interactive Controls */}
            <div style={{ 
              flex: 1,
              minHeight: 0,
              padding: '16px', 
              backgroundColor: 'var(--cm-card-bg)', 
              borderRadius: '8px', 
              border: '1px solid var(--cm-border)'
            }}>
                <div style={{ display: 'flex', gap: '24px', height: '100%' }}>
                  {/* Legend */}
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={600} mb="md" c="var(--cm-text)">Legend</Text>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '8px 12px',
                      alignItems: 'start'
                    }}>
                      {[
                        { color: '#10b981', label: 'Mastered', icon: '✅' },
                        { color: '#3b82f6', label: 'Current Focus', icon: '🎯' },
                        { color: '#f59e0b', label: 'In Progress', icon: '📚' },
                        { color: '#cbd5e1', label: 'Not Started', icon: '⚪' }
                      ].map((item, index) => (
                        <Group key={index} gap="xs" wrap="nowrap">
                          <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: item.color,
                            border: '2px solid var(--cm-text)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '8px',
                            flexShrink: 0
                          }}>
                            {item.icon}
                          </div>
                          <Text size="xs" c="var(--cm-text)">
                            {item.label}
                          </Text>
                        </Group>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Controls */}
                  <div style={{ flex: 1 }}>
                    <Group gap="xs" mb="md">
                      <span style={{ fontSize: '14px' }}>🎮</span>
                      <Text size="sm" fw={600} c="var(--cm-text)">Interactive Controls</Text>
                    </Group>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '8px 12px',
                      alignItems: 'start'
                    }}>
                      {[
                        '• Drag canvas to pan',
                        '• Mouse wheel to zoom',
                        '• Click nodes for details',
                        '• Hover lines for info',
                        '• Lock/unlock dragging'
                      ].map((instruction, index) => (
                        <Text key={index} size="xs" c="var(--cm-text-secondary)" style={{ lineHeight: 1.3 }}>
                          {instruction}
                        </Text>
                      ))}
                    </div>
                  </div>
                </div>
            </div>
          </Card>
                   
        </Grid.Col>

        {/* Learning Strategy Intelligence Panel */}
        <Grid.Col span={4}>
          <Card withBorder p="lg" h="100%" style={{ backgroundColor: '#f8fafc', minHeight: '500px' }}>
            <Title order={4} mb="md">
              {selectedTag ? `${selectedTag} Strategy` : 'Learning Intelligence'}
            </Title>
            <Stack gap="md">
              {selectedTag ? (
                // Show detailed strategy for selected tag
                <>
                  {(() => {
                    const tagData = pathData.find(t => t.tag === selectedTag);
                    const progress = tagData?.progress || 0;
                    const attempts = tagData?.attempts || 0;
                    
                    return (
                      <>
                        <div>
                          <Text size="sm" c="dimmed" mb="xs">Learning Efficiency</Text>
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
                          <Text size="sm" c="dimmed" mb="xs">Smart Problem Recommendations</Text>
                          <Stack gap="xs">
                            {(() => {
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
                              
                              return tagRecs.map((rec, index) => (
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
                              ));
                            })()}
                          </Stack>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <Button 
                            variant="filled" 
                            size="sm" 
                            style={{ backgroundColor: '#3b82f6', border: 'none' }}
                            onClick={() => {
                              // Simulated practice session start
                              console.log(`Starting focused practice session for ${selectedTag}`);
                              alert(`🎯 Launching ${selectedTag} practice session!\n\nSystem will prioritize problems that strengthen this skill and prepare you for the next level.`);
                            }}
                          >
                            Start Practice
                          </Button>
                          <Button 
                            variant="light" 
                            size="sm" 
                            onClick={() => setSelectedTag(null)}
                          >
                            Back to Overview
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                // Show strategic insights
                <>
                  <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-indigo-0)" }}>
                    <Text size="sm" fw={600} mb="xs">🎯 Active Learning Strategy</Text>
                    <Text size="xs">
                      Focus on {pathData.filter(t => t.isFocus).length} core areas to maximize learning efficiency
                    </Text>
                  </Card>

                  <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-green-0)" }}>
                    <Text size="sm" fw={600} mb="xs">📈 Progress Optimization</Text>
                    <Text size="xs">
                      System adapts problem difficulty based on your {Math.round(pathData.reduce((acc, tag) => acc + (tag.progress || 0), 0) / pathData.length)}% overall mastery
                    </Text>
                  </Card>

                  <Card p="sm" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-orange-0)" }}>
                    <Text size="sm" fw={600} mb="xs">🔄 Adaptive Learning</Text>
                    <Text size="xs">
                      Recent sessions influence future problem selection for personalized difficulty scaling
                    </Text>
                  </Card>
                  
                  <div style={{ marginTop: 'auto' }}>
                    <Text size="sm" c="dimmed" mb="xs">Strategy Insights</Text>
                    <Text size="sm">
                      • Click focus tags for detailed strategy
                      <br />
                      • Connections show learning relationships
                      <br />
                      • System optimizes for your learning pattern
                    </Text>
                  </div>
                </>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        {/* Current Focus Areas */}
        <Grid.Col span={6}>
          <Card withBorder p="lg" h={280}>
            <Title order={4} mb="md">Current Focus Areas</Title>
            <Stack gap="md">
              {pathData
                .filter(tag => tag.isFocus)
                .slice(0, 5)
                .map((tag, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text fw={500}>{tag.tag}</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Text size="sm" c="dimmed">{tag.attempts} attempts</Text>
                      <Text fw={500} c={tag.progress >= 80 ? "green" : tag.progress >= 60 ? "orange" : "red"}>
                        {tag.progress}%
                      </Text>
                    </div>
                  </div>
                ))}
              {pathData.filter(tag => tag.isFocus).length === 0 && (
                <Text c="dimmed" ta="center">No focus areas set. Complete more sessions to see recommendations!</Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        {/* Mastery Status */}
        <Grid.Col span={6}>
          <Card withBorder p="lg" h={280}>
            <Title order={4} mb="md">Mastery Status</Title>
            <Stack gap="md">
              <div>
                <Text size="sm" c="dimmed" mb="xs">Mastered Topics</Text>
                <Text fw={500} size="lg" c="green">
                  {pathData.filter(tag => tag.mastered).length} / {pathData.length}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed" mb="xs">In Progress</Text>
                <Text fw={500} size="lg" c="orange">
                  {pathData.filter(tag => !tag.mastered && tag.progress > 0).length}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed" mb="xs">Not Started</Text>
                <Text fw={500} size="lg" c="red">
                  {pathData.filter(tag => tag.progress === 0).length}
                </Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        {/* Learning Efficiency Analytics - Full Width */}
        <Grid.Col span={12}>
          <Card withBorder p="lg">
            <Title order={4} mb="md">Learning Efficiency Analytics</Title>
            <Text size="sm" c="dimmed" mb="lg">Track how each session impacts your overall learning progress</Text>
            
            {/* Session Impact Chart */}
            <div style={{ width: '100%', height: '200px', marginBottom: '20px' }}>
              <ResponsiveContainer>
                <LineChart data={[
                  { session: 'S1', efficiency: 75, retention: 65, momentum: 70 },
                  { session: 'S2', efficiency: 82, retention: 72, momentum: 78 },
                  { session: 'S3', efficiency: 78, retention: 68, momentum: 75 },
                  { session: 'S4', efficiency: 85, retention: 75, momentum: 82 },
                  { session: 'S5', efficiency: 88, retention: 78, momentum: 87 },
                  { session: 'S6', efficiency: 83, retention: 73, momentum: 85 },
                  { session: 'S7', efficiency: 91, retention: 81, momentum: 92 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="session" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#f8fafc', 
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Line type="monotone" dataKey="efficiency" stroke="#3b82f6" strokeWidth={2} name="Learning Efficiency" />
                  <Line type="monotone" dataKey="retention" stroke="#10b981" strokeWidth={2} name="Knowledge Retention" />
                  <Line type="monotone" dataKey="momentum" stroke="#f59e0b" strokeWidth={2} name="Learning Momentum" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Efficiency Metrics Explanation */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div style={{ padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid var(--cm-border)' }}>
                <Text size="sm" fw={600} c="var(--cm-chart-primary)">Learning Efficiency</Text>
                <Text size="xs" c="var(--cm-text-secondary)">Measures problem-solving accuracy and speed improvement trends</Text>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid var(--cm-border)' }}>
                <Text size="sm" fw={600} c="var(--cm-chart-success)">Knowledge Retention</Text>
                <Text size="xs" c="#475569">Long-term retention based on spaced repetition success rates</Text>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid var(--cm-border)' }}>
                <Text size="sm" fw={600} c="var(--cm-chart-warning)">Learning Momentum</Text>
                <Text size="xs" c="#475569">Cumulative progress velocity across all focus areas</Text>
              </div>
            </div>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}