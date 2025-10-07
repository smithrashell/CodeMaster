import { Card, Text } from "@mantine/core";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useThemeColors } from "../../../shared/hooks/useThemeColors";

export default function SelectedTagDetailCard({ tag }) {
  const colors = useThemeColors();
  
  if (!tag) return null;

  const chartData = [
    { name: "Successful", value: tag.successfulAttempts },
    { name: "Unsuccessful", value: tag.totalAttempts - tag.successfulAttempts },
  ];

  return (
    <Card shadow="sm" p="md" mt="md" withBorder>
      <Text fw={600} mb="xs">
        Mastery Details – {tag.tag}
      </Text>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <XAxis 
            dataKey="name" 
            tick={{ fill: colors.textSecondary || '#6b7280', fontSize: 12 }}
            axisLine={{ stroke: colors.border || '#e5e7eb' }}
          />
          <YAxis 
            tick={{ fill: colors.textSecondary || '#6b7280', fontSize: 12 }}
            axisLine={{ stroke: colors.border || '#e5e7eb' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: colors.tooltipBg || '#ffffff',
              border: `1px solid ${colors.tooltipBorder || '#e5e7eb'}`,
              borderRadius: '6px',
              color: colors.tooltipText || '#111827'
            }}
          />
          <Bar dataKey="value" fill={colors.chartPrimary || '#3b82f6'} />
        </BarChart>
      </ResponsiveContainer>
      <Text size="sm" mt="sm">
        Decay Score: {tag.decayScore.toFixed(2)}
      </Text>
    </Card>
  );
}
