import React from "react";
import { Card, Title, Text } from "@mantine/core";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const LearningEfficiencyAnalytics = () => {
  const chartData = [
    { session: 'S1', efficiency: 75, retention: 65, momentum: 70 },
    { session: 'S2', efficiency: 82, retention: 72, momentum: 78 },
    { session: 'S3', efficiency: 78, retention: 68, momentum: 75 },
    { session: 'S4', efficiency: 85, retention: 75, momentum: 82 },
    { session: 'S5', efficiency: 88, retention: 78, momentum: 87 },
    { session: 'S6', efficiency: 83, retention: 73, momentum: 85 },
    { session: 'S7', efficiency: 91, retention: 81, momentum: 92 }
  ];

  const metricsExplanation = [
    {
      title: "Learning Efficiency",
      description: "Measures problem-solving accuracy and speed improvement trends",
      color: "var(--cm-chart-primary)",
      backgroundColor: "rgba(59, 130, 246, 0.1)"
    },
    {
      title: "Knowledge Retention",
      description: "Long-term retention based on spaced repetition success rates",
      color: "var(--cm-chart-success)",
      backgroundColor: "rgba(16, 185, 129, 0.1)"
    },
    {
      title: "Learning Momentum",
      description: "Cumulative progress velocity across all focus areas",
      color: "var(--cm-chart-warning)",
      backgroundColor: "rgba(245, 158, 11, 0.1)"
    }
  ];

  return (
    <Card withBorder p="lg">
      <Title order={4} mb="md">Learning Efficiency Analytics</Title>
      <Text size="sm" c="dimmed" mb="lg">Track how each session impacts your overall learning progress</Text>
      
      {/* Session Impact Chart */}
      <div style={{ width: '100%', height: '200px', marginBottom: '20px' }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
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
        {metricsExplanation.map((metric, index) => (
          <div key={index} style={{ 
            padding: '12px', 
            backgroundColor: metric.backgroundColor, 
            borderRadius: '8px', 
            border: '1px solid var(--cm-border)' 
          }}>
            <Text size="sm" fw={600} c={metric.color}>{metric.title}</Text>
            <Text size="xs" c={index === 1 ? "#475569" : "var(--cm-text-secondary)"}>{metric.description}</Text>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LearningEfficiencyAnalytics;