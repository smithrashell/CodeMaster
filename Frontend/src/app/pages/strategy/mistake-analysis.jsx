import React, { useState, useEffect, useRef } from "react";
import { Container, Grid, Card, Title, Text, Stack, Group, Badge, Button, Box } from "@mantine/core";
import { useThemeColors } from "../../../shared/hooks/useThemeColors";

// Shared Components from mockup.jsx
function Section({ title, right, children }) {
  return (
    <Card withBorder radius="md" p="md" style={{ background: "var(--surface)", boxShadow: "var(--shadow)" }}>
      <Group justify="space-between" mb="xs">
        <Text fw={700} c="var(--text)">{title}</Text>
        {right}
      </Group>
      {children}
    </Card>
  );
}

function Kpis({ items }) {
  return (
    <Grid gutter="sm">
      {items.map((k) => (
        <Grid.Col key={k.label} span={{ base: 6, sm: 3 }}>
          <Card withBorder p="sm" style={{ background: "var(--surface)" }}>
            <Text c="var(--muted)" size="xs">{k.label}</Text>
            <Text fw={800} fz="xl" c="var(--text)">{k.value}</Text>
          </Card>
        </Grid.Col>
      ))}
    </Grid>
  );
}

function FeedbackItem({ icon, title, note, meta }) {
  return (
    <Card withBorder radius="md" p="sm" style={{ background: "var(--surface)" }}>
      <Group align="flex-start" gap="sm">
        <Text fz="lg">{icon}</Text>
        <Box style={{ flex: 1 }}>
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600} c="var(--text)">{title}</Text>
            <Text c="var(--muted)" size="xs">{meta}</Text>
          </Group>
          <Text c="var(--muted)" size="sm">{note}</Text>
        </Box>
      </Group>
    </Card>
  );
}

export function MistakeAnalysis({ appState }) {
  const colors = useThemeColors();
  const [errorPatterns, setErrorPatterns] = useState([]);
  const [strugglingTags, setStrugglingTags] = useState([]);
  const [sessionInsights, setSessionInsights] = useState([]);
  const [improvementSuggestions, setImprovementSuggestions] = useState([]);
  
  // State for expandable cards
  const [showMoreFocus, setShowMoreFocus] = useState(false);
  const [showMorePatterns, setShowMorePatterns] = useState(false);
  const [showMoreFeedback, setShowMoreFeedback] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  
  // Dynamic height calculation for cards
  const getCardHeight = (isExpanded, itemCount, baseItemHeight = 60) => {
    // When expanded, return 'auto' to allow natural content height without limits
    if (isExpanded) {
      return 'auto';
    }
    
    // When collapsed, use fixed 600px height for all cards
    return 450;
  };

  useEffect(() => {
    if (!appState) return;

    // Analyze struggling tags from mastery data
    const masteryData = appState.mastery?.masteryData || appState.sessions?.masteryData || [];
    const struggling = masteryData
      .filter(tag => tag.totalAttempts >= 3 && tag.progress < 60) // Has attempts but low success
      .sort((a, b) => a.progress - b.progress) // Sort by lowest success rate first
      .slice(0, 5); // Top 5 struggling areas
    
    setStrugglingTags(struggling);

    // Extract session insights from sessions data
    const sessions = appState.sessions?.sessionAnalytics || [];
    const negativeInsights = sessions
      .flatMap(session => session.insights || [])
      .filter(insight => insight.includes('Focus on') || insight.includes('improvement') || insight.includes('Consider'))
      .slice(0, 8); // Get recent improvement suggestions
    
    setSessionInsights(negativeInsights);

    // Analyze error patterns from session data
    const errorPatternAnalysis = [];
    const recentSessions = appState.sessions?.recentSessions || [];
    
    // Low accuracy pattern
    const lowAccuracySessions = recentSessions.filter(s => s.accuracy < 0.7);
    if (lowAccuracySessions.length > 2) {
      errorPatternAnalysis.push({
        type: 'accuracy',
        severity: 'high',
        description: `${lowAccuracySessions.length} recent sessions with accuracy below 70%`,
        suggestion: 'Focus on understanding problem patterns rather than speed'
      });
    }

    // Difficulty progression issues
    const difficultyIssues = sessions.filter(s => {
      const difficulty = s.difficulty || {};
      return difficulty.Hard > difficulty.Easy; // Attempting hard before mastering easy
    });
    
    if (difficultyIssues.length > 1) {
      errorPatternAnalysis.push({
        type: 'progression',
        severity: 'medium',
        description: 'Attempting advanced problems before mastering fundamentals',
        suggestion: 'Build a solid foundation with Easy and Medium problems first'
      });
    }

    // Session length vs accuracy correlation
    const shortInaccurateSessions = recentSessions.filter(s => s.duration < 30 && s.accuracy < 0.8);
    if (shortInaccurateSessions.length > 2) {
      errorPatternAnalysis.push({
        type: 'focus',
        severity: 'medium',
        description: 'Short sessions with low accuracy detected',
        suggestion: 'Longer, focused practice sessions tend to improve learning retention'
      });
    }

    setErrorPatterns(errorPatternAnalysis);

    // Generate improvement suggestions
    const suggestions = [];
    
    if (struggling.length > 0) {
      suggestions.push(`Dedicate 2-3 focused sessions to ${struggling[0].tag} problems - currently at ${struggling[0].progress}%`);
    }
    
    if (lowAccuracySessions.length > 1) {
      suggestions.push('Review solution explanations for missed problems instead of moving to new topics');
    }
    
    if (masteryData.some(tag => tag.totalAttempts > 10 && tag.progress < 40)) {
      const stuckTag = masteryData.find(tag => tag.totalAttempts > 10 && tag.progress < 40);
      suggestions.push(`Consider taking a break from ${stuckTag.tag} and returning with fresh perspective`);
    }
    
    suggestions.push('Practice explaining your solution approach out loud to identify gaps in understanding');
    
    setImprovementSuggestions(suggestions.slice(0, 4));

  }, [appState]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return colors.chartDanger || '#ef4444';
      case 'medium': return colors.chartWarning || '#f59e0b';
      case 'low': return colors.chartSuccess || '#10b981';
      default: return colors.textSecondary || '#6b7280';
    }
  };

  const getProgressColor = (progress) => {
    if (progress >= 70) return colors.chartSuccess || '#10b981';
    if (progress >= 50) return colors.chartWarning || '#f59e0b';
    return colors.chartDanger || '#ef4444';
  };

  // Group struggling tags by severity
  const needsAttention = strugglingTags.filter(t => t.progress < 30);
  const watchList = strugglingTags.filter(t => t.progress >= 30 && t.progress < 50);
  const healthy = strugglingTags.filter(t => t.progress >= 50);

  return (
    <Container size="lg" p="xl">
      <Title order={2} mb="xs" c="var(--text)">Mistake Analysis & Improvement</Title>
      <Text c="var(--muted)" size="sm" mb="xl">
        Identify patterns in your mistakes and get targeted recommendations for improvement
      </Text>

      {/* Summary Stats - Moved to Top */}
      <Section title="📊 Mistake Analysis Summary">
        <Kpis items={[
          { 
            label: "Tags Needing Focus", 
            value: strugglingTags.length 
          },
          { 
            label: "Error Patterns Found", 
            value: errorPatterns.length 
          },
          { 
            label: "Improvement Actions", 
            value: improvementSuggestions.length 
          },
          { 
            label: "Overall Assessment", 
            value: errorPatterns.length === 0 && strugglingTags.length <= 1 ? "Excellent 🌟" :
                   errorPatterns.length <= 1 && strugglingTags.length <= 3 ? "Good 📈" : "Needs Focus 🎯"
          }
        ]} />
      </Section>

      <Grid gutter="lg" mt="xl">
      
        {/* Improvement Action Plan - Checklist */}
        <Grid.Col span={6}>
          <Card 
            withBorder 
            radius="md" 
            p="md" 
            style={{ 
              background: "var(--surface)", 
              boxShadow: "var(--shadow)", 
              display: 'flex', 
              flexDirection: 'column',
              height: getCardHeight(showMoreActions, improvementSuggestions.length, 65), // Action items are medium height  
              transition: 'height 0.3s ease'
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={700} c="var(--text)">🎯 Improvement Action Plan</Text>
              <Badge color="blue" variant="light" size="sm">
                0 / {improvementSuggestions.length} done
              </Badge>
            </Group>
            
            <div style={{ 
              flex: 1, 
              overflowY: showMoreActions ? 'visible' : 'auto', 
              marginBottom: '8px' 
            }}>
              {improvementSuggestions.length > 0 ? (
                <Stack gap="xs">
                  {(showMoreActions ? improvementSuggestions : improvementSuggestions.slice(0, 3)).map((suggestion, index) => {
                    // Extract tag from suggestion text
                    const tags = ['graph', 'timing', 'patterns', 'strategy', 'fundamentals'];
                    const suggestedTag = tags[index % tags.length];
                    
                    return (
                      <Group key={index} justify="space-between" p="xs" style={{ 
                        border: `1px solid var(--border)`, 
                        borderRadius: '8px',
                        background: 'var(--surface)'
                      }}>
                        <Group gap="sm" style={{ flex: 1 }}>
                          <input 
                            type="checkbox" 
                            style={{ 
                              accentColor: 'var(--accent)',
                              cursor: 'pointer' 
                            }} 
                          />
                          <Text size="sm" c="var(--text)" style={{ flex: 1 }}>
                            {suggestion}
                          </Text>
                          <Badge variant="outline" color="gray" size="xs">
                            {suggestedTag}
                          </Badge>
                        </Group>
                        <Button size="xs" variant="light" color="blue">Start</Button>
                      </Group>
                    );
                  })}
                </Stack>
              ) : (
                <Text c="var(--muted)" ta="center" py="xl">
                  Keep practicing to unlock personalized improvement suggestions!
                </Text>
              )}
            </div>

            {/* Show More/Less Button */}
            {improvementSuggestions.length > 3 && (
              <Button 
                variant="subtle" 
                size="sm" 
                fullWidth
                onClick={() => setShowMoreActions(!showMoreActions)}
              >
                {showMoreActions ? 'Show Less' : 'Show More'}
              </Button>
            )}
          </Card>
        </Grid.Col>
        {/* Error Patterns - Alert Cards */}
        <Grid.Col span={6}>
          <Card 
            withBorder 
            radius="md" 
            p="md" 
            style={{ 
              background: "var(--surface)", 
              boxShadow: "var(--shadow)", 
              display: 'flex', 
              flexDirection: 'column',
              height: getCardHeight(showMorePatterns, errorPatterns.length, 80), // Error patterns are taller
              transition: 'height 0.3s ease'
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={700} c="var(--text)">🔍 Error Patterns Detected</Text>
            </Group>
            
            <div style={{ 
              flex: 1, 
              overflowY: showMorePatterns ? 'visible' : 'auto', 
              marginBottom: '8px' 
            }}>
              {errorPatterns.length > 0 ? (
                <Stack gap="md">
                  {(showMorePatterns ? errorPatterns : errorPatterns.slice(0, 2)).map((pattern, index) => {
                    const alertColor = pattern.severity === 'high' ? 'red' : pattern.severity === 'medium' ? 'orange' : 'blue';
                    const alertIcon = pattern.severity === 'high' ? '🚨' : pattern.severity === 'medium' ? '⚠️' : 'ℹ️';
                    
                    return (
                      <div key={index} style={{
                        padding: '12px',
                        border: `1px solid var(--${pattern.severity === 'high' ? 'bad' : pattern.severity === 'medium' ? 'warn' : 'accent'})`,
                        borderRadius: '8px',
                        background: 'var(--surface)'
                      }}>
                        <Group justify="space-between" align="flex-start" mb="xs">
                          <Group gap="xs">
                            <Text fz="sm">{alertIcon}</Text>
                            <Text fw={600} size="sm" c="var(--text)" style={{ textTransform: 'capitalize' }}>
                              {pattern.type} Issue
                            </Text>
                          </Group>
                          <Button size="xs" variant="light" color={alertColor}>Fix</Button>
                        </Group>
                        <Text size="sm" c="var(--text)" mb="xs">{pattern.description}</Text>
                        <Text size="xs" c="var(--muted)">
                          💡 {pattern.suggestion}
                        </Text>
                      </div>
                    );
                  })}
                </Stack>
              ) : (
                <Text c="var(--muted)" ta="center" py="xl">
                  No concerning patterns detected in your recent sessions ✨
                </Text>
              )}
            </div>

            {/* Show More/Less Button */}
            {errorPatterns.length > 1 && (
              <Button 
                variant="subtle" 
                size="sm" 
                fullWidth
                onClick={() => setShowMorePatterns(!showMorePatterns)}
              >
                {showMorePatterns ? 'Show Less' : 'Show More'}
              </Button>
            )}
          </Card>
        </Grid.Col>



          {/* Areas Needing Focus - Enhanced */}
        <Grid.Col span={6}>
          <Card 
            withBorder 
            radius="md" 
            p="md" 
            style={{ 
              background: "var(--surface)", 
              boxShadow: "var(--shadow)", 
              display: 'flex', 
              flexDirection: 'column',
              height: getCardHeight(showMoreFocus, needsAttention.length + watchList.length),
              transition: 'height 0.3s ease'
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={700} c="var(--text)">📉 Areas Needing Focus</Text>
            </Group>
            
            <div style={{ 
              flex: 1, 
              overflowY: showMoreFocus ? 'visible' : 'auto', 
              marginBottom: '8px' 
            }}>
              {strugglingTags.length > 0 ? (
                <Stack gap="md">
                  {needsAttention.length > 0 && (
                    <>
                      <Text size="sm" fw={600} c="var(--bad)" mb="xs">Needs Attention</Text>
                      {(showMoreFocus ? needsAttention : needsAttention.slice(0, 2)).map((tag) => (
                        <Group key={tag.tag} justify="space-between" p="xs" style={{ 
                          borderBottom: `1px solid var(--border)`,
                          cursor: 'pointer'
                        }}>
                          <Group gap="xs">
                            <Text fw={600} c="var(--text)">{tag.tag}</Text>
                            <Badge variant="light" color="red" size="xs">{tag.progress}% success</Badge>
                          </Group>
                          <Group gap="sm">
                            <Text c="var(--muted)" size="sm">{tag.successfulAttempts}/{tag.totalAttempts} solved</Text>
                            <Box w={80}>
                              <div style={{ 
                                background: 'var(--border)', 
                                borderRadius: '2px', 
                                height: '3px', 
                                overflow: 'hidden' 
                              }}>
                                <div style={{
                                  background: 'var(--bad)',
                                  width: `${tag.progress}%`,
                                  height: '100%'
                                }} />
                              </div>
                            </Box>
                            <Button size="xs" variant="light" color="red">Practice</Button>
                          </Group>
                        </Group>
                      ))}
                    </>
                  )}
                  
                  {watchList.length > 0 && (
                    <>
                      <Text size="sm" fw={600} c="var(--warn)" mb="xs" mt={needsAttention.length > 0 ? "md" : 0}>Watch</Text>
                      {(showMoreFocus ? watchList : watchList.slice(0, 1)).map((tag) => (
                        <Group key={tag.tag} justify="space-between" p="xs" style={{ 
                          borderBottom: `1px solid var(--border)`,
                          cursor: 'pointer'
                        }}>
                          <Group gap="xs">
                            <Text fw={600} c="var(--text)">{tag.tag}</Text>
                            <Badge variant="light" color="orange" size="xs">{tag.progress}% success</Badge>
                          </Group>
                          <Group gap="sm">
                            <Text c="var(--muted)" size="sm">{tag.successfulAttempts}/{tag.totalAttempts} solved</Text>
                            <Box w={80}>
                              <div style={{ 
                                background: 'var(--border)', 
                                borderRadius: '2px', 
                                height: '3px', 
                                overflow: 'hidden' 
                              }}>
                                <div style={{
                                  background: 'var(--warn)',
                                  width: `${tag.progress}%`,
                                  height: '100%'
                                }} />
                              </div>
                            </Box>
                            <Button size="xs" variant="light" color="orange">Practice</Button>
                          </Group>
                        </Group>
                      ))}
                    </>
                  )}
                </Stack>
              ) : (
                <Text c="var(--muted)" ta="center" py="xl">
                  No struggling areas identified. Keep up the great work! 🎉
                </Text>
              )}
            </div>

            {/* Show More/Less Button */}
            {(needsAttention.length > 2 || watchList.length > 1) && (
              <Button 
                variant="subtle" 
                size="sm" 
                fullWidth
                onClick={() => setShowMoreFocus(!showMoreFocus)}
              >
                {showMoreFocus ? 'Show Less' : 'Show More'}
              </Button>
            )}
          </Card>
        </Grid.Col>

        {/* Recent Session Feedback - Card List */}
        <Grid.Col span={6}>
          <Card 
            withBorder 
            radius="md" 
            p="md" 
            style={{ 
              background: "var(--surface)", 
              boxShadow: "var(--shadow)", 
              display: 'flex', 
              flexDirection: 'column',
              height: getCardHeight(showMoreFeedback, sessionInsights.length, 70), // Feedback items are medium height
              transition: 'height 0.3s ease'
            }}
          >
            <Group justify="space-between" mb="xs">
              <Text fw={700} c="var(--text)">💭 Recent Session Feedback</Text>
            </Group>
            
            <div style={{ 
              flex: 1, 
              overflowY: showMoreFeedback ? 'visible' : 'auto', 
              marginBottom: '8px' 
            }}>
              {sessionInsights.length > 0 ? (
                <Stack gap="sm">
                  {(showMoreFeedback ? sessionInsights : sessionInsights.slice(0, 3)).map((insight, index) => {
                    // Create varied feedback items with icons and meta
                    const feedbackTypes = ['💬', '⚡', '⏱️', '🎯', '📈', '🔍'];
                    const titles = [
                      'Focus Recommendation',
                      'Performance Insight', 
                      'Timing Analysis',
                      'Strategy Suggestion',
                      'Progress Update',
                      'Pattern Detection'
                    ];
                    
                    return (
                      <FeedbackItem
                        key={index}
                        icon={feedbackTypes[index % feedbackTypes.length]}
                        title={titles[index % titles.length]}
                        note={insight}
                        meta={`Session ${index + 1}`}
                      />
                    );
                  })}
                </Stack>
              ) : (
                <Text c="var(--muted)" ta="center" py="xl">
                  Complete more sessions to see personalized feedback
                </Text>
              )}
            </div>

            {/* Show More/Less Button */}
            {sessionInsights.length > 3 && (
              <Button 
                variant="subtle" 
                size="sm" 
                fullWidth
                onClick={() => setShowMoreFeedback(!showMoreFeedback)}
              >
                {showMoreFeedback ? 'Show Less' : 'Show More'}
              </Button>
            )}
          </Card>
        </Grid.Col>

    
      </Grid>
    </Container>
  );
}