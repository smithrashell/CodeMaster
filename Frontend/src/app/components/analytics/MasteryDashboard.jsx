 import { useState, useEffect } from "react";
import {
  Tabs,
  Grid,
  Text,
  Button,
  Card,
  Table,
  TextInput,
  ScrollArea,
  Badge,
  Progress,
  Box,
  Group,
  Tooltip,
  Anchor,
} from "@mantine/core";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import TimeGranularChartCard from "../charts/TimeGranularChartCard";

/* ---------- helpers ---------- */

// map mastery → color based on new color scheme
const getMasteryColor = (pct) => (pct >= 80 ? "var(--cm-table-mastery-good)" : pct >= 50 ? "var(--cm-table-mastery-medium)" : "var(--cm-table-mastery-low)");

// map mastery → mantine color names for badges
const getMantineMasteryColor = (pct) => (pct >= 80 ? "green" : pct >= 50 ? "yellow" : "red");

/* ---------- mock adapter (same as yours) ---------- */
const fetchMockData = (data) => ({
  currentTier: data?.currentTier || "Core Concepts",
  masteredTags: data?.masteredTags || [],
  allTagsInCurrentTier: data?.allTagsInCurrentTier || [],
  focusTags: data?.focusTags || [],
  masteryData: data?.masteryData || [],
  unmasteredTags: data?.unmasteredTags || [],
  tagsinTier: data?.tagsinTier || [],
});

export default function MasteryDashboard(props) {
  const [selectedTag, setSelectedTag] = useState(null);
  const [data, setData] = useState(props.data);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [activeFocusFilter, setActiveFocusFilter] = useState(null); // chip filter
  const pageSize = 10;

  useEffect(() => {
    setData(fetchMockData(props.data));
  }, [props.data]);

  if (!data) return <Text>Loading mastery data...</Text>;
  if (!data.masteryData || data.masteryData.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Text size="lg" fw={600} mb="xs">No Mastery Data Yet</Text>
        <Text c="dimmed">Complete a session to see tag mastery analytics.</Text>
      </Card>
    );
  }

  /* ---------- pie data ---------- */
  const getPieData = () => {
    if (selectedTag) {
      const { successfulAttempts, totalAttempts } = selectedTag;
      return [
        { name: "Successful", value: successfulAttempts },
        { name: "Unsuccessful", value: totalAttempts - successfulAttempts },
      ];
    }
    const mastered = (data.masteryData || []).filter(
      (t) => t.totalAttempts > 0 && t.successfulAttempts / t.totalAttempts >= 0.8
    ).length;
    const total = (data.masteryData || []).length;
    return [
      { name: "Mastered", value: mastered },
      { name: "Unmastered", value: Math.max(total - mastered, 0) },
    ];
  };

  const pieTitle = selectedTag ? `Mastery: ${selectedTag.tag}` : "Mastery Overview";

  const isUnmasteredTag = (tag) =>
    (data.unmasteredTags || []).map((t) => t.toLowerCase()).includes(tag.toLowerCase());

  /* ---------- sorting, filtering, paging ---------- */
  const base = [...(data.masteryData || [])];

  // pin unmastered to top
  base.sort((a, b) => {
    const au = isUnmasteredTag(a.tag);
    const bu = isUnmasteredTag(b.tag);
    return au === bu ? 0 : au ? -1 : 1;
  });

  // search filter
  const searched = base.filter((t) =>
    t.tag.toLowerCase().includes(search.toLowerCase())
  );

  // focus chip filter (optional)
  const focusFiltered = activeFocusFilter
    ? searched.filter((t) => t.tag.toLowerCase() === activeFocusFilter.toLowerCase())
    : searched;

  // tier filter for "Current Tier" tab will be applied later

  const paginate = (arr) =>
    arr.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const makeRows = (arr, { highlightUnmastered = false }) =>
    arr.map((tagObj) => {
      const mastery =
        tagObj.totalAttempts > 0
          ? (tagObj.successfulAttempts / tagObj.totalAttempts) * 100
          : 0;

      const focus = (data.focusTags || []).some(
        (t) => t.toLowerCase() === tagObj.tag.toLowerCase()
      );
      const unmastered = highlightUnmastered && isUnmasteredTag(tagObj.tag);

      return (
        <tr
          key={tagObj.tag}
          onClick={() => setSelectedTag(tagObj)}
          className={focus ? "cm-table-row-focus" : ""}
        >
          <td>
            <Group gap={8} wrap="nowrap">
              <Text fw={600} size="sm" c="var(--cm-table-text-primary)">{tagObj.tag}</Text>
              {focus && (
                <Badge variant="outline" size="xs" className="cm-badge-focus">focus</Badge>
              )}
              {unmastered && (
                <Badge variant="outline" size="xs" className="cm-badge-practice">practice</Badge>
              )}
            </Group>
          </td>

          <td className="cm-table-cell-numeric">
            <Tooltip label={`${tagObj.successfulAttempts}/${tagObj.totalAttempts} solved`}>
              <Badge color={getMantineMasteryColor(mastery)} variant="light" size="sm" fw={700}>
                {mastery.toFixed(1)}%
              </Badge>
            </Tooltip>
          </td>

          <td className="cm-table-cell-numeric">
            <Text size="sm" fw={600} c="var(--cm-table-text-primary)">{tagObj.totalAttempts}</Text>
          </td>

          <td style={{ textAlign: "left" }}>
            <Box w={100}>
              <Progress
                value={mastery}
                size="sm"
                radius="xs"
                styles={{ 
                  root: { background: "var(--cm-table-progress-track)" },
                  bar: { backgroundColor: "#6b7280" }
                }}
              />
            </Box>
          </td>
        </tr>
      );
    });

  /* ---------- table renderer ---------- */
  const TagTable = ({
    source,
    searchable = true,
    highlightUnmastered = false,
    withFocusBar = true,
  }) => {
    const rows = makeRows(paginate(source), { highlightUnmastered });

    const totalPages = Math.max(1, Math.ceil(source.length / pageSize));

    return (
      <Card withBorder p="md" style={{ background: "var(--cm-card-bg)" }} className="cm-enhanced-table">
        {withFocusBar && (data.focusTags?.length > 0) && (
          <Group gap={8} mb="xs" wrap="wrap">
            <Text size="sm" c="dimmed">Focus tags:</Text>
            {data.focusTags.map((t) => (
              <Badge
                key={t}
                color="cyan"
                variant={activeFocusFilter === t ? "filled" : "outline"}
                size="xs"
                styles={{ root: { cursor: "pointer" } }}
                onClick={() =>
                  setActiveFocusFilter((prev) => (prev === t ? null : t))
                }
              >
                {t}
              </Badge>
            ))}
            {activeFocusFilter && (
              <Anchor size="sm" onClick={() => setActiveFocusFilter(null)}>
                Clear
              </Anchor>
            )}
          </Group>
        )}

        {searchable && (
          <TextInput
            placeholder="Search tag…"
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setCurrentPage(0);
            }}
            mb="sm"
            size="sm"
            styles={{
              input: {
                backgroundColor: "var(--cm-dropdown-bg)",
                borderColor: "var(--cm-border)",
                color: "var(--cm-dropdown-color)",
              },
            }}
          />
        )}

        <ScrollArea h={350} type="auto">
          <Table
            verticalSpacing="xs"
            withColumnBorders
            withBorder
          >
            <thead>
              <tr>
                <th>Tag</th>
                <th className="cm-table-cell-numeric">Mastery</th>
                <th className="cm-table-cell-numeric">Attempts</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </Table>
        </ScrollArea>

        <Group justify="space-between" mt="sm">
          <Button onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
                  disabled={currentPage === 0} variant="light" size="xs">
            <IconArrowLeft size={14} />
          </Button>
          <Text size="sm" c="dimmed">
            Page {currentPage + 1} of {totalPages}
          </Text>
          <Button
            onClick={() => setCurrentPage((p) => (p + 1 < totalPages ? p + 1 : p))}
            disabled={currentPage + 1 >= totalPages}
            variant="light"
            size="xs"
          >
            <IconArrowRight size={14} />
          </Button>
        </Group>
      </Card>
    );
  };

  /* ---------- tier subset ---------- */
  const tierOnly = focusFiltered.filter((t) =>
    (data.tagsinTier || []).includes(t.tag)
  );

  return (
    <Tabs defaultValue="overall" onChange={() => setCurrentPage(0)}>
      <Tabs.List>
        <Tabs.Tab value="overall">Overall Mastery</Tabs.Tab>
        <Tabs.Tab value="tier">Current Tier Mastery</Tabs.Tab>
        {selectedTag && (
          <Button
            ml="auto"
            variant="subtle"
            size="xs"
            onClick={() => setSelectedTag(null)}
          >
            Back to overview
          </Button>
        )}
      </Tabs.List>

      {/* Overall */}
      <Tabs.Panel value="overall" pt="md">
        <Grid>
          <Grid.Col span={6}>
            <TimeGranularChartCard
              title={pieTitle}
              chartType="pie"
              useTimeGranularity={false}
              data={getPieData()}
              dataKeys={[{ key: "value", color: "#a9c1ff" }]}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TagTable source={focusFiltered} searchable highlightUnmastered withFocusBar />
          </Grid.Col>
        </Grid>
      </Tabs.Panel>

      {/* Tier */}
      <Tabs.Panel value="tier" pt="md">
        <Grid>
          <Grid.Col span={6}>
            <TimeGranularChartCard
              title={pieTitle}
              chartType="pie"
              useTimeGranularity={false}
              data={getPieData()}
              dataKeys={[{ key: "value", color: "#82ca9d" }]}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TagTable source={tierOnly} searchable={false} highlightUnmastered withFocusBar />
          </Grid.Col>
        </Grid>
      </Tabs.Panel>
    </Tabs>
  );
}
