import { Card, Text } from "@mantine/core";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function SelectedTagDetailCard({ tag }) {
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
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
      <Text size="sm" mt="sm">
        Decay Score: {tag.decayScore.toFixed(2)}
      </Text>
    </Card>
  );
}
