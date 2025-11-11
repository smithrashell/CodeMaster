import { useState, useEffect, useMemo, memo } from "react";
import { Card, Text, SegmentedControl } from "@mantine/core";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  PieChart,
  Pie,
  Cell,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useThemeColors } from "../../../shared/hooks/useThemeColors";

// Extracted helper hooks for TimeGranularChartCard

const usePieColors = (colors) => useMemo(() => [
  colors.dataColors?.data1 || "#3b82f6",
  colors.dataColors?.data2 || "#8b5cf6", 
  colors.dataColors?.data3 || "#10b981",
  colors.dataColors?.data4 || "#f59e0b",
  colors.dataColors?.data5 || "#ef4444"
], [colors.dataColors]);

const useIsTimeBased = (data) => useMemo(() => 
  typeof data === "object" &&
  !Array.isArray(data) &&
  (data?.weekly || data?.monthly || data?.yearly),
  [data]
);

const useCurrentData = (data, view, isTimeBased) => useMemo(() => {
  if (isTimeBased) {
    return data?.[view] ?? [];
  }
  return Array.isArray(data) ? data : [];
}, [data, view, isTimeBased]);

const useHasValidData = (data, currentData, dataKeys) => useMemo(() => {
  if (!data || typeof data !== "object") return false;

  const series = currentData;
  if (!Array.isArray(series) || series.length === 0) return false;

  return series.some((item) =>
    dataKeys.some(
      (keyObj) => typeof item[keyObj.key] === "number" && item[keyObj.key] > 0
    )
  );
}, [data, currentData, dataKeys]);

// Chart helper functions
const isPromotionTrendShape = (data) => {
  const requiredKeys = ["weekly", "monthly", "yearly"];
  const requiredFields = ["name", "attempted", "passed", "failed"];

  if (typeof data !== "object" || data === null) return false;

  for (const key of requiredKeys) {
    const section = data[key];
    if (!Array.isArray(section)) return false;

    for (const item of section) {
      if (typeof item !== "object" || item === null) return false;

      for (const field of requiredFields) {
        if (!(field in item)) return false;
        if (field === "name" && typeof item[field] !== "string") return false;
        if (field !== "name" && typeof item[field] !== "number") return false;
      }
    }
  }

  return true;
};

// Chart styling helpers
const getAxisProps = (colors) => ({
  tick: { fill: colors.textSecondary || '#6b7280', fontSize: 12 },
  axisLine: { stroke: colors.border || '#e5e7eb' }
});

const getTooltipProps = (tooltipFormatter, colors) => ({
  formatter: tooltipFormatter,
  contentStyle: {
    backgroundColor: colors.tooltipBg || '#ffffff',
    border: `1px solid ${colors.tooltipBorder || '#e5e7eb'}`,
    borderRadius: '6px',
    color: colors.tooltipText || '#111827'
  }
});

// Props comparison helpers
const compareDataKeys = (prevKeys, nextKeys) => {
  if (prevKeys.length !== nextKeys.length) return false;
  for (let i = 0; i < prevKeys.length; i++) {
    if (prevKeys[i].key !== nextKeys[i].key ||
        prevKeys[i].color !== nextKeys[i].color) {
      return false;
    }
  }
  return true;
};

// Chart rendering helper
const renderChart = ({ chartType, currentData, dataKeys, yAxisFormatter, tooltipFormatter, colors, PIE_COLORS }) => {
  const axisProps = getAxisProps(colors);
  const tooltipProps = getTooltipProps(tooltipFormatter, colors);
  
  if (chartType === "line") {
    return (
      <LineChart data={currentData}>
        <XAxis dataKey="name" {...axisProps} />
        <YAxis tickFormatter={yAxisFormatter} {...axisProps} />
        <Tooltip {...tooltipProps} />
        <CartesianGrid stroke={colors.chartGrid || '#f3f4f6'} strokeOpacity={0.3} />
        {dataKeys.map((item, index) => (
          <Line
            key={index}
            type="monotone"
            dataKey={item.key}
            stroke={item.color || colors.chartPrimary || '#3b82f6'}
            strokeWidth={3}
            dot={{ r: 4, fill: item.color || colors.chartPrimary || '#3b82f6' }}
            activeDot={{ r: 6, fill: item.color || colors.chartPrimary || '#3b82f6' }}
          />
        ))}
      </LineChart>
    );
  }
  
  if (chartType === "bar") {
    return (
      <BarChart data={currentData}>
        <XAxis dataKey="name" {...axisProps} />
        <YAxis tickFormatter={yAxisFormatter} {...axisProps} />
        <Tooltip {...tooltipProps} />
        <CartesianGrid stroke={colors.chartGrid || '#f3f4f6'} strokeOpacity={0.3} />
        {dataKeys.map((item, index) => (
          <Bar
            key={index}
            dataKey={item.key}
            fill={item.color || colors.chartPrimary || '#3b82f6'}
            stackId={dataKeys.length > 1 ? "a" : undefined}
          />
        ))}
      </BarChart>
    );
  }
  
  return (
    <PieChart>
      <Pie data={currentData} dataKey="value" nameKey="name" outerRadius={150} label>
        {currentData.map((entry, index) => (
          <Cell
            key={`cell-${index}`}
            fill={PIE_COLORS[index % PIE_COLORS.length]}
          />
        ))}
      </Pie>
      <Tooltip />
      <Legend />
    </PieChart>
  );
};

function TimeGranularChartCard({
  title,
  data,
  chartType = "line", // can now be "line", "bar", or "pie"
  dataKeys = [],
  yAxisFormatter = (v) => v,
  tooltipFormatter = (v, n) => [v, n],
  chartHeight = 300, // Allow custom height, default 300
}) {
  const colors = useThemeColors();
  
  const PIE_COLORS = usePieColors(colors);
  
  const [noData, setNoData] = useState(false);
  
  const isTimeBased = useIsTimeBased(data);

  const [view, setView] = useState("weekly");

  const currentData = useCurrentData(data, view, isTimeBased);

  const hasValidData = useHasValidData(data, currentData, dataKeys);
  
  // Memoize promotion trend detection
  const isPromotionTrend = useMemo(() => isPromotionTrendShape(data), [data]);
  
  useEffect(() => {
    setNoData(!hasValidData);
  }, [hasValidData]);

  if (noData) {
    return (
      <Card
        shadow="sm"
        p="lg"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center", // center vertically
          alignItems: "center", // center horizontally
          height: "100%",
          width: "100%", // ensure full width
        }}
      >
        <Text weight={500} size="lg" mb="sm">
          {title} {isTimeBased && `(${view})`}
        </Text>

        <div
          style={{
            flexGrow: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
          }}
        >
          <p style={{ color: "gray", textAlign: "center" }}>
            No Data to display
          </p>
        </div>
      </Card>
    );
  }
  if (isPromotionTrend) {
    // Debug: currentData processing for promotion trends
  }
  return (
    <Card shadow="sm" p="lg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Text weight={500} size="lg" mb="sm">
        {title} {isTimeBased && `(${view})`}
      </Text>

      {isTimeBased && (
        <SegmentedControl
          radius="md"
          size="sm"
          value={view}
          onChange={setView}
          data={[
            { label: "Weekly", value: "weekly" },
            { label: "Monthly", value: "monthly" },
            { label: "Yearly", value: "yearly" },
          ]}
          color={colors.info || '#3b82f6'}
          mb="md"
        />
      )}

      <ResponsiveContainer width="100%" height={chartHeight}>
        {renderChart({ chartType, currentData, dataKeys, yAxisFormatter, tooltipFormatter, colors, PIE_COLORS })}
      </ResponsiveContainer>
    </Card>
  );
}

// Memoized export with custom comparison for better performance
export default memo(TimeGranularChartCard, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  if (prevProps.title !== nextProps.title) return false;
  if (prevProps.chartType !== nextProps.chartType) return false;
  if (prevProps.yAxisFormatter !== nextProps.yAxisFormatter) return false;
  if (prevProps.tooltipFormatter !== nextProps.tooltipFormatter) return false;
  
  // Deep compare dataKeys array
  if (!compareDataKeys(prevProps.dataKeys, nextProps.dataKeys)) return false;
  
  // Deep compare data (most expensive, so do last)
  return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});
