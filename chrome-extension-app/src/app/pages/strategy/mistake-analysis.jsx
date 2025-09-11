import React, { useState, useEffect } from "react";
import { Container, Grid, Card, Title, Text, Stack, Group, Badge, Button, Box } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useThemeColors } from "../../../shared/hooks/useThemeColors";
import { usePageData } from "../../hooks/usePageData";

// Custom hooks for MistakeAnalysis state management
const useMistakeAnalysisState = () => {
  const [errorPatterns, setErrorPatterns] = useState([]);
  const [strugglingTags, setStrugglingTags] = useState([]);
  const [sessionInsights, setSessionInsights] = useState([]);
  const [improvementSuggestions, setImprovementSuggestions] = useState([]);
  const [showMoreFocus, setShowMoreFocus] = useState(false);
  const [showMorePatterns, setShowMorePatterns] = useState(false);
  const [showMoreFeedback, setShowMoreFeedback] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);

  return {
    errorPatterns, setErrorPatterns,
    strugglingTags, setStrugglingTags,
    sessionInsights, setSessionInsights,
    improvementSuggestions, setImprovementSuggestions,
    showMoreFocus, setShowMoreFocus,
    showMorePatterns, setShowMorePatterns,
    showMoreFeedback, setShowMoreFeedback,
    showMoreActions, setShowMoreActions
  };
};

// Helper functions for MistakeAnalysis
const getCardHeight = (isExpanded, itemCount, _baseItemHeight = 60) => {
  if (isExpanded) {
    return 'auto';
  }
  return 450;
};

// Data processing utilities for MistakeAnalysis
const processStrugglingTags = (masteryData) => {
  return masteryData
    .filter(tag => tag.totalAttempts >= 3 && tag.progress < 60)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 5);
};

const processSessionInsights = (sessions) => {
  return sessions
    .flatMap(session => session.insights || [])
    .filter(insight => 
      insight && 
      insight.length > 0 && 
      (insight.includes('Focus on') || insight.includes('improvement') || insight.includes('Consider'))
    )
    .slice(0, 8);
};

const generateImprovementSuggestions = (strugglingTags, lowAccuracySessions, masteryData, errorPatterns) => {
  const suggestions = [];
  
  if (strugglingTags.length > 0) {
    suggestions.push(`Dedicate 2-3 focused sessions to ${strugglingTags[0].tag} problems - currently at ${strugglingTags[0].progress}%`);
  }
  
  if (lowAccuracySessions.length > 1) {
    suggestions.push('Review solution explanations for missed problems instead of moving to new topics');
  }
  
  if (masteryData.some(tag => tag.totalAttempts > 10 && tag.progress < 40)) {
    const stuckTag = masteryData.find(tag => tag.totalAttempts > 10 && tag.progress < 40);
    suggestions.push(`Consider taking a break from ${stuckTag.tag} and returning with fresh perspective`);
  }
  
  if (strugglingTags.length > 0 || lowAccuracySessions.length > 1 || errorPatterns.length > 0) {
    suggestions.push('Practice explaining your solution approach out loud to identify gaps in understanding');
  }
  
  return suggestions.slice(0, 4);
};

const getOverallAssessment = (errorPatterns, strugglingTags) => {
  if (errorPatterns.length === 0 && strugglingTags.length <= 1) return "Excellent 🌟";
  if (errorPatterns.length <= 1 && strugglingTags.length <= 3) return "Good 📈";
  return "Needs Focus 🎯";
};

// Analysis logic helpers
const analyzeErrorPatterns = (recentSessions, sessions) => {
  const errorPatternAnalysis = [];
  
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

  return errorPatternAnalysis;
};

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

function ImprovementActionCard({ suggestions, showMore, onToggleShow }) {
  return (
    <Card 
      withBorder 
      radius="md" 
      p="md" 
      style={{ 
        background: "var(--surface)", 
        boxShadow: "var(--shadow)", 
        display: 'flex', 
        flexDirection: 'column',
        height: getCardHeight(showMore, suggestions.length, 65),
        transition: 'height 0.3s ease'
      }}
    >
      <Group justify="space-between" mb="xs">
        <Text fw={700} c="var(--text)">🎯 Improvement Action Plan</Text>
        {suggestions.length > 0 && (
          <Badge color="blue" variant="light" size="sm">
            0 / {suggestions.length} done
          </Badge>
        )}
      </Group>
      
      <div style={{ 
        flex: 1, 
        overflowY: showMore ? 'visible' : 'auto', 
        marginBottom: '8px' 
      }}>
        {suggestions.length > 0 ? (
          <Stack gap="xs">
            {(showMore ? suggestions : suggestions.slice(0, 3)).map((suggestion, index) => {
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
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Text size="lg" fw={600} c="var(--text)" mb="sm">No Improvement Actions Needed</Text>
            <Text size="sm" c="var(--muted)">
              Your performance is looking good! Keep practicing to maintain your progress.
            </Text>
          </div>
        )}
      </div>

      {suggestions.length > 3 && (
        <Button 
          variant="subtle" 
          size="sm" 
          fullWidth
          onClick={() => onToggleShow(!showMore)}
        >
          {showMore ? 'Show Less' : 'Show More'}
        </Button>
      )}
    </Card>
  );
}

function ErrorPatternsCard({ patterns, showMore, onToggleShow }) {
  return (
    <Card 
      withBorder 
      radius="md" 
      p="md" 
      style={{ 
        background: "var(--surface)", 
        boxShadow: "var(--shadow)", 
        display: 'flex', 
        flexDirection: 'column',
        height: getCardHeight(showMore, patterns.length, 80),
        transition: 'height 0.3s ease'
      }}
    >
      <Group justify="space-between" mb="xs">
        <Text fw={700} c="var(--text)">🔍 Error Patterns Detected</Text>
      </Group>
      
      <div style={{ 
        flex: 1, 
        overflowY: showMore ? 'visible' : 'auto', 
        marginBottom: '8px' 
      }}>
        {patterns.length > 0 ? (
          <Stack gap="md">
            {(showMore ? patterns : patterns.slice(0, 2)).map((pattern, index) => {
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

      {patterns.length > 1 && (
        <Button 
          variant="subtle" 
          size="sm" 
          fullWidth
          onClick={() => onToggleShow(!showMore)}
        >
          {showMore ? 'Show Less' : 'Show More'}
        </Button>
      )}
    </Card>
  );
}

function TagProgressBar({ progress, color }) {
  return (
    <Box w={80}>
      <div style={{ 
        background: 'var(--border)', 
        borderRadius: '2px', 
        height: '3px', 
        overflow: 'hidden' 
      }}>
        <div style={{
          background: color,
          width: `${progress}%`,
          height: '100%'
        }} />
      </div>
    </Box>
  );
}

function TagListItem({ tag, severity }) {
  const colorConfig = severity === 'critical' 
    ? { badgeColor: 'red', buttonColor: 'red', barColor: 'var(--bad)' }
    : { badgeColor: 'orange', buttonColor: 'orange', barColor: 'var(--warn)' };

  return (
    <Group justify="space-between" p="xs" style={{ 
      borderBottom: `1px solid var(--border)`,
      cursor: 'pointer'
    }}>
      <Group gap="xs">
        <Text fw={600} c="var(--text)">{tag.tag}</Text>
        <Badge variant="light" color={colorConfig.badgeColor} size="xs">{tag.progress}% success</Badge>
      </Group>
      <Group gap="sm">
        <Text c="var(--muted)" size="sm">{tag.successfulAttempts}/{tag.totalAttempts} solved</Text>
        <TagProgressBar progress={tag.progress} color={colorConfig.barColor} />
        <Button size="xs" variant="light" color={colorConfig.buttonColor}>Practice</Button>
      </Group>
    </Group>
  );
}

function AreasNeedingFocusCard({ strugglingTags, needsAttention, watchList, showMore, onToggleShow }) {
  return (
    <Card 
      withBorder 
      radius="md" 
      p="md" 
      style={{ 
        background: "var(--surface)", 
        boxShadow: "var(--shadow)", 
        display: 'flex', 
        flexDirection: 'column',
        height: getCardHeight(showMore, needsAttention.length + watchList.length),
        transition: 'height 0.3s ease'
      }}
    >
      <Group justify="space-between" mb="xs">
        <Text fw={700} c="var(--text)">📉 Areas Needing Focus</Text>
      </Group>
      
      <div style={{ 
        flex: 1, 
        overflowY: showMore ? 'visible' : 'auto', 
        marginBottom: '8px' 
      }}>
        {strugglingTags.length > 0 ? (
          <Stack gap="md">
            {needsAttention.length > 0 && (
              <>
                <Text size="sm" fw={600} c="var(--bad)" mb="xs">Needs Attention</Text>
                {(showMore ? needsAttention : needsAttention.slice(0, 2)).map((tag) => (
                  <TagListItem key={tag.tag} tag={tag} severity="critical" />
                ))}
              </>
            )}
            
            {watchList.length > 0 && (
              <>
                <Text size="sm" fw={600} c="var(--warn)" mb="xs" mt={needsAttention.length > 0 ? "md" : 0}>Watch</Text>
                {(showMore ? watchList : watchList.slice(0, 1)).map((tag) => (
                  <TagListItem key={tag.tag} tag={tag} severity="moderate" />
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

      {(needsAttention.length > 2 || watchList.length > 1) && (
        <Button 
          variant="subtle" 
          size="sm" 
          fullWidth
          onClick={() => onToggleShow(!showMore)}
        >
          {showMore ? 'Show Less' : 'Show More'}
        </Button>
      )}
    </Card>
  );
}

function RecentSessionFeedbackCard({ insights, showMore, onToggleShow }) {
  return (
    <Card 
      withBorder 
      radius="md" 
      p="md" 
      style={{ 
        background: "var(--surface)", 
        boxShadow: "var(--shadow)", 
        display: 'flex', 
        flexDirection: 'column',
        height: getCardHeight(showMore, insights.length, 70),
        transition: 'height 0.3s ease'
      }}
    >
      <Group justify="space-between" mb="xs">
        <Text fw={700} c="var(--text)">💭 Recent Session Feedback</Text>
      </Group>
      
      <div style={{ 
        flex: 1, 
        overflowY: showMore ? 'visible' : 'auto', 
        marginBottom: '8px' 
      }}>
        {insights.length > 0 ? (
          <Stack gap="sm">
            {(showMore ? insights : insights.slice(0, 3)).map((insight, index) => {
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

      {insights.length > 3 && (
        <Button 
          variant="subtle" 
          size="sm" 
          fullWidth
          onClick={() => onToggleShow(!showMore)}
        >
          {showMore ? 'Show Less' : 'Show More'}
        </Button>
      )}
    </Card>
  );
}

export function MistakeAnalysis() {
  const { data: appState, loading, error, refresh } = usePageData('mistake-analysis');
  const _colors = useThemeColors();
  
  const {
    errorPatterns, setErrorPatterns,
    strugglingTags, setStrugglingTags,
    sessionInsights, setSessionInsights,
    improvementSuggestions, setImprovementSuggestions,
    showMoreFocus, setShowMoreFocus,
    showMorePatterns, setShowMorePatterns,
    showMoreFeedback, setShowMoreFeedback,
    showMoreActions, setShowMoreActions
  } = useMistakeAnalysisState();

  useEffect(() => {
    if (!appState) return;

    // Process data using utility functions
    const masteryData = appState.mastery?.masteryData || appState.sessions?.masteryData || [];
    const sessions = appState.sessions?.sessionAnalytics || [];
    const recentSessions = appState.sessions?.recentSessions || [];
    
    // Extract struggling tags and insights
    const struggling = processStrugglingTags(masteryData);
    const insights = processSessionInsights(sessions);
    
    // Analyze patterns and generate suggestions
    const lowAccuracySessions = recentSessions.filter(s => s.accuracy < 0.7);
    const errorPatterns = analyzeErrorPatterns(recentSessions, sessions);
    const suggestions = generateImprovementSuggestions(struggling, lowAccuracySessions, masteryData, errorPatterns);

    // Update state
    setStrugglingTags(struggling);
    setSessionInsights(insights);
    setErrorPatterns(errorPatterns);
    setImprovementSuggestions(suggestions);

  }, [appState, setErrorPatterns, setImprovementSuggestions, setSessionInsights, setStrugglingTags]);


  // Group struggling tags by severity
  const needsAttention = strugglingTags.filter(t => t.progress < 30);
  const watchList = strugglingTags.filter(t => t.progress >= 30 && t.progress < 50);
  const _healthy = strugglingTags.filter(t => t.progress >= 50);

  if (loading) return <Container size="lg" p="xl"><Text>Loading mistake analysis data...</Text></Container>;
  if (error) return (
    <Container size="lg" p="xl">
      <Text c="red">Error loading mistake analysis data: {error.message}</Text>
      <Button leftSection={<IconRefresh size={16} />} onClick={refresh} mt="md">
        Retry
      </Button>
    </Container>
  );

  return (
    <Container size="lg" p="xl">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2} mb="xs" c="var(--text)">Mistake Analysis & Improvement</Title>
          <Text c="var(--muted)" size="sm">
            Identify patterns in your mistakes and get targeted recommendations for improvement
          </Text>
        </div>
        <Button 
          leftSection={<IconRefresh size={16} />} 
          variant="light" 
          onClick={refresh}
          size="sm"
        >
          Refresh
        </Button>
      </Group>

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
            value: getOverallAssessment(errorPatterns, strugglingTags)
          }
        ]} />
      </Section>

      <Grid gutter="lg" mt="xl">
      
        {/* Improvement Action Plan - Checklist */}
        <Grid.Col span={6}>
          <ImprovementActionCard 
            suggestions={improvementSuggestions}
            showMore={showMoreActions}
            onToggleShow={setShowMoreActions}
          />
        </Grid.Col>
        {/* Error Patterns - Alert Cards */}
        <Grid.Col span={6}>
          <ErrorPatternsCard 
            patterns={errorPatterns}
            showMore={showMorePatterns}
            onToggleShow={setShowMorePatterns}
          />
        </Grid.Col>



          {/* Areas Needing Focus - Enhanced */}
        <Grid.Col span={6}>
          <AreasNeedingFocusCard 
            strugglingTags={strugglingTags}
            needsAttention={needsAttention}
            watchList={watchList}
            showMore={showMoreFocus}
            onToggleShow={setShowMoreFocus}
          />
        </Grid.Col>

        {/* Recent Session Feedback - Card List */}
        <Grid.Col span={6}>
          <RecentSessionFeedbackCard 
            insights={sessionInsights}
            showMore={showMoreFeedback}
            onToggleShow={setShowMoreFeedback}
          />
        </Grid.Col>

    
      </Grid>
    </Container>
  );
}