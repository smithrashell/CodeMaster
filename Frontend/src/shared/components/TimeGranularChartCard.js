import { useState, useEffect } from "react";
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

const PIE_COLORS = ["#82ca9d", "#8884d8", "#ffc658", "#ff7300", "#d0ed57"];
function isPromotionTrendShape(data) {
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
}

export default function TimeGranularChartCard({
  title,
  data,
  chartType = "line", // can now be "line", "bar", or "pie"
  dataKeys = [],
  yAxisFormatter = (v) => v,
  tooltipFormatter = (v, n) => [v, n],
}) {
  const [noData, setNoData] = useState(false);
  const isTimeBased =
    typeof data === "object" &&
    !Array.isArray(data) &&
    (data?.weekly || data?.monthly || data?.yearly);

  const [view, setView] = useState("weekly");

  const currentData = isTimeBased
    ? data?.[view] ?? []
    : Array.isArray(data)
    ? data
    : [];

  useEffect(() => {
    if (!data || typeof data !== "object") {
      setNoData(true);
      return;
    }

    const series = isTimeBased
      ? data[view] ?? []
      : Array.isArray(data)
      ? data
      : [];

    if (!Array.isArray(series) || series.length === 0) {
      setNoData(true);
      return;
    }

    const hasValidData = series.some((item) =>
      dataKeys.some(
        (keyObj) => typeof item[keyObj.key] === "number" && item[keyObj.key] > 0
      )
    );

    setNoData(!hasValidData);
  }, [data, view, dataKeys, isTimeBased]);

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
  if (isPromotionTrendShape(data)) {
    console.log("🔍 currentData for view:", view, currentData);
    console.log("🔑 dataKeys:", dataKeys);
  }
  return (
    <Card shadow="sm" p="lg">
      <Text weight={500} size="lg" mb="sm">
        {title} {isTimeBased && `(${view})`}
      </Text>

      {isTimeBased && (
        <SegmentedControl
          value={view}
          onChange={setView}
          data={[
            { label: "Weekly", value: "weekly" },
            { label: "Monthly", value: "monthly" },
            { label: "Yearly", value: "yearly" },
          ]}
          mb="md"
        />
      )}

      <ResponsiveContainer width="100%" height={300}>
        {chartType === "line" ? (
          <LineChart data={currentData}>
            <XAxis dataKey="name" />
            <YAxis tickFormatter={yAxisFormatter} />
            <Tooltip formatter={tooltipFormatter} />
            <CartesianGrid stroke="#f5f5f5" />
            {dataKeys.map((item, index) => (
              <Line
                key={index}
                type="monotone"
                dataKey={item.key}
                stroke={item.color || "#8884d8"}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        ) : chartType === "bar" ? (
          <BarChart data={currentData}>
            <XAxis dataKey="name" />
            <YAxis tickFormatter={yAxisFormatter} />
            <Tooltip formatter={tooltipFormatter} />
            <CartesianGrid stroke="#f5f5f5" />
            {dataKeys.map((item, index) => (
              <Bar
                key={index}
                dataKey={item.key}
                fill={item.color || "#8884d8"}
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
