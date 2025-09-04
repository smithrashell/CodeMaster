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

// PIE_COLORS will be set dynamically using theme colors
// Utility function for performance (removed memo to avoid React Hooks issue)
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

function TimeGranularChartCard({
  title,
  data,
  chartType = "line", // can now be "line", "bar", or "pie"
  dataKeys = [],
  yAxisFormatter = (v) => v,
  tooltipFormatter = (v, n) => [v, n],
}) {
  const colors = useThemeColors();
  
  // Memoized pie colors for performance
  const PIE_COLORS = useMemo(() => [
    colors.dataColors?.data1 || "#3b82f6",
    colors.dataColors?.data2 || "#8b5cf6", 
    colors.dataColors?.data3 || "#10b981",
    colors.dataColors?.data4 || "#f59e0b",
    colors.dataColors?.data5 || "#ef4444"
  ], [colors.dataColors]);
  
  const [noData, setNoData] = useState(false);
  
  // Memoize data type detection for performance
  const isTimeBased = useMemo(() => 
    typeof data === "object" &&
    !Array.isArray(data) &&
    (data?.weekly || data?.monthly || data?.yearly),
    [data]
  );

  const [view, setView] = useState("weekly");

  // Memoize current data processing
  const currentData = useMemo(() => {
    if (isTimeBased) {
      return data?.[view] ?? [];
    }
    return Array.isArray(data) ? data : [];
  }, [data, view, isTimeBased]);

  // Memoize data validation for better performance
  const hasValidData = useMemo(() => {
    if (!data || typeof data !== "object") return false;

    const series = currentData;
    if (!Array.isArray(series) || series.length === 0) return false;

    return series.some((item) =>
      dataKeys.some(
        (keyObj) => typeof item[keyObj.key] === "number" && item[keyObj.key] > 0
      )
    );
  }, [data, currentData, dataKeys]);
  
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
    <Card shadow="sm" p="lg">
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

      <ResponsiveContainer width="100%" height={300}>
        {chartType === "line" ? (
          <LineChart data={currentData}>
            <XAxis 
              dataKey="name" 
              tick={{ fill: colors.textSecondary || '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: colors.border || '#e5e7eb' }}
            />
            <YAxis 
              tickFormatter={yAxisFormatter} 
              tick={{ fill: colors.textSecondary || '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: colors.border || '#e5e7eb' }}
            />
            <Tooltip 
              formatter={tooltipFormatter}
              contentStyle={{
                backgroundColor: colors.tooltipBg || '#ffffff',
                border: `1px solid ${colors.tooltipBorder || '#e5e7eb'}`,
                borderRadius: '6px',
                color: colors.tooltipText || '#111827'
              }}
            />
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
        ) : chartType === "bar" ? (
          <BarChart data={currentData}>
            <XAxis 
              dataKey="name" 
              tick={{ fill: colors.textSecondary || '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: colors.border || '#e5e7eb' }}
            />
            <YAxis 
              tickFormatter={yAxisFormatter} 
              tick={{ fill: colors.textSecondary || '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: colors.border || '#e5e7eb' }}
            />
            <Tooltip 
              formatter={tooltipFormatter}
              contentStyle={{
                backgroundColor: colors.tooltipBg || '#ffffff',
                border: `1px solid ${colors.tooltipBorder || '#e5e7eb'}`,
                borderRadius: '6px',
                color: colors.tooltipText || '#111827'
              }}
            />
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
        ) : (
          <PieChart>
            <Pie
              data={currentData}
              dataKey="value"
              nameKey="name"
              outerRadius={100}
              label
            >
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
        )}
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
  if (prevProps.dataKeys.length !== nextProps.dataKeys.length) return false;
  for (let i = 0; i < prevProps.dataKeys.length; i++) {
    if (prevProps.dataKeys[i].key !== nextProps.dataKeys[i].key ||
        prevProps.dataKeys[i].color !== nextProps.dataKeys[i].color) {
      return false;
    }
  }
  
  // Deep compare data (most expensive, so do last)
  return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});
