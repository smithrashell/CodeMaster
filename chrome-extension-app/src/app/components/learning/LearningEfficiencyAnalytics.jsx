import React, { useState, useEffect } from "react";
import { Card, Title, Text, Loader, Center } from "@mantine/core";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ChromeAPIErrorHandler from "../../../shared/services/chrome/ChromeAPIErrorHandler";
import { METRICS_EXPLANATION } from "./learningAnalyticsConstants";

const LearningEfficiencyAnalytics = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const fetchEfficiencyData = async () => {
      try {
        setLoading(true);
        const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: 'getLearningEfficiencyData'
        });

        if (response && response.result) {
          setChartData(response.result.chartData || []);
          setHasData(response.result.hasData || false);
          setError(response.result.hasData ? null : response.result.message);
        }
      } catch (err) {
        console.error('Error fetching learning efficiency data:', err);
        setError('Failed to load efficiency data');
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };

    fetchEfficiencyData();
  }, []);

  if (loading) {
    return (
      <Card withBorder p="lg">
        <Center h={300}>
          <Loader size="lg" />
        </Center>
      </Card>
    );
  }

  if (error || !hasData) {
    return (
      <Card withBorder p="lg">
        <Title order={4} mb="md">Learning Efficiency Analytics</Title>
        <Center h={200}>
          <Text>{error || 'Complete some sessions to see your learning efficiency trends'}</Text>
        </Center>
      </Card>
    );
  }

  return (
    <Card withBorder p="lg">
      <Title order={4} mb="md">Learning Efficiency Analytics</Title>
      <Text size="sm" mb="lg">Track how each session impacts your overall learning progress</Text>
      
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
        {METRICS_EXPLANATION.map((metric, index) => (
          <div key={index} style={{
            padding: '12px',
            backgroundColor: metric.backgroundColor,
            borderRadius: '8px',
            border: '1px solid var(--cm-border)'
          }}>
            <Text size="sm" fw={600} c={metric.color} mb={4}>{metric.title}</Text>
            <Text size="xs" c="var(--cm-text-secondary)" mb={6}>{metric.description}</Text>
            {metric.ranges.map((range, rangeIndex) => (
              <Text key={rangeIndex} size="xs" c="var(--cm-text-secondary)" style={{ marginBottom: '2px' }}>
                <span style={{ fontWeight: 600 }}>{range.range}</span> {range.meaning}
              </Text>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LearningEfficiencyAnalytics;