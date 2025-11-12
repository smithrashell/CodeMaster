 import { useState, useEffect } from "react";
import {
  Tabs,
  Grid,
  Text,
  Button,
  Card,
  Table,
  TextInput,
  Badge,
  Group,
  Pagination,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import TimeGranularChartCard from "../charts/TimeGranularChartCard";

/* ---------- helpers ---------- */

/* ---------- data adapter with service-based defaults ---------- */
const normalizeData = (data) => ({
  currentTier: data?.currentTier || null,
  masteredTags: data?.masteredTags || [],
  allTagsInCurrentTier: data?.allTagsInCurrentTier || [],
  focusTags: data?.focusTags || [],
  masteryData: data?.masteryData || [],
  allTagsData: data?.allTagsData || [], // All known tags for Overall view
  tierTagsData: data?.tierTagsData || [], // Current tier tags for Tier view
  unmasteredTags: data?.unmasteredTags || [],
  tagsinTier: data?.tagsinTier || [],
});

// Helper functions (support both snake_case and PascalCase)
const generatePieData = (selectedTag, masteryData, _currentTab) => {
  if (selectedTag) {
    const successfulAttempts = selectedTag.successful_attempts ?? selectedTag.successfulAttempts ?? 0;
    const totalAttempts = selectedTag.total_attempts ?? selectedTag.totalAttempts ?? 0;
    return [
      { name: "Successful", value: successfulAttempts },
      { name: "Failed", value: totalAttempts - successfulAttempts }
    ];
  }

  // Filter data based on current tab context if provided
  const dataToUse = masteryData || [];
  const mastered = dataToUse.filter(tag => tag.mastered).length;
  const unmastered = dataToUse.length - mastered;
  return [
    { name: "Mastered", value: mastered },
    { name: "Learning", value: unmastered }
  ];
};

const paginateData = (arr, currentPage, pageSize) => {
  const start = currentPage * pageSize;
  return arr.slice(start, start + pageSize);
};

const processTagData = (masteryData, unmasteredTags, search, activeFocusFilter) => {
  return masteryData
    .filter((tag) => {
      if (search && tag.tag && !tag.tag.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeFocusFilter && tag.tag !== activeFocusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const aIsUnmastered = unmasteredTags?.includes(a.tag);
      const bIsUnmastered = unmasteredTags?.includes(b.tag);
      if (aIsUnmastered && !bIsUnmastered) return -1;
      if (!aIsUnmastered && bIsUnmastered) return 1;
      return b.progress - a.progress;
    });
};

const createTableRows = (data, _options, callbacks) => {
  const { setSelectedTag } = callbacks;

  return data.map((tag) => {
    // Support both snake_case and PascalCase field names
    const successfulAttempts = tag.successful_attempts ?? tag.successfulAttempts ?? 0;
    const totalAttempts = tag.total_attempts ?? tag.totalAttempts ?? 0;
    const progress = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0;
    const isFocus = tag.isFocus;
    const isUnmastered = !tag.mastered;

    return (
      <Table.Tr
        key={tag.tag}
        onClick={() => setSelectedTag(tag)}
        style={{
          cursor: "pointer"
        }}
      >
        <Table.Td>
          <Group gap="xs">
            <Text fw={isFocus ? 600 : 400}>
              {tag.tag}
            </Text>
            {isFocus && <Badge size="xs" color="cyan">focus</Badge>}
            {isUnmastered && totalAttempts > 0 && <Badge size="xs" color="orange">learning</Badge>}
          </Group>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{totalAttempts}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{progress}%</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c={tag.mastered ? "green" : "orange"}>
            {tag.mastered ? "Mastered" : "Learning"}
          </Text>
        </Table.Td>
      </Table.Tr>
    );
  });
};

const TagTable = ({
  source,
  searchable = true,
  highlightUnmastered = false,
  withFocusBar = true,
  data,
  activeFocusFilter,
  setActiveFocusFilter,
  currentPage,
  setCurrentPage,
  pageSize,
  search,
  setSearch,
  setSelectedTag,
  height
}) => {
  const rows = createTableRows(paginateData(source, currentPage, pageSize),
    { highlightUnmastered },
    { setSelectedTag }
  );
  const totalPages = Math.max(1, Math.ceil(source.length / pageSize));

  return (
    <Card withBorder p="md" style={{ background: "var(--cm-card-bg)", height: height }} className="cm-enhanced-table">
      {withFocusBar && (data.focusTags?.length > 0) && (
        <Group gap={8} mb="xs" wrap="wrap">
          <Text size="sm">Focus tags:</Text>
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
          <Badge
            color="gray"
            variant="outline"
            size="xs"
            styles={{ root: { cursor: "pointer" } }}
            onClick={() => setActiveFocusFilter(null)}
          >
            Clear
          </Badge>
        </Group>
      )}

      {searchable && (
        <TextInput
          placeholder="Search tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          mb="md"
          leftSection={<IconSearch size={16} />}
        />
      )}

      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tag</Table.Th>
            <Table.Th>Attempts</Table.Th>
            <Table.Th>Success Rate</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows}
        </Table.Tbody>
      </Table>

      <Group justify="space-between" mt="sm">
        <Text size="sm">
          Showing {Math.min(source.length, pageSize)} of {source.length} tags
        </Text>
        <Pagination
          total={totalPages}
          value={currentPage + 1}
          onChange={(page) => setCurrentPage(page - 1)}
          size="sm"
        />
      </Group>
    </Card>
  );
};

export default function MasteryDashboard(props) {
  const [selectedTag, setSelectedTag] = useState(null);
  const [data, setData] = useState(props.data);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [activeFocusFilter, setActiveFocusFilter] = useState(null); // chip filter
  const [activeTab, setActiveTab] = useState("tier"); // Track active tab
  const pageSize = 10;

  useEffect(() => {
    setData(normalizeData(props.data));
  }, [props.data]);

  if (!data) return <Text>Loading mastery data...</Text>;
  if (!data.masteryData || data.masteryData.length === 0) {
    return (
      <Card withBorder p="xl" ta="center">
        <Text size="lg" fw={600} mb="xs">No Mastery Data Yet</Text>
        <Text>Complete a session to see tag mastery analytics.</Text>
      </Card>
    );
  }


  // Dynamic pie chart title based on active tab and selection
  const getPieTitle = (tab) => {
    if (selectedTag) return `Mastery: ${selectedTag.tag}`;
    return tab === "tier" ? "Current Tier Mastery Overview" : "Overall Mastery Overview";
  };

  // Use allTagsData for Overall view (includes all known tags with placeholders for unattempted)
  // Fall back to masteryData if allTagsData is empty
  const allTagsSource = (data.allTagsData && data.allTagsData.length > 0) ? data.allTagsData : data.masteryData;
  const allTagsFiltered = processTagData(allTagsSource || [], data.unmasteredTags || [], search, activeFocusFilter);

  // Use tierTagsData for Tier view (includes all tier tags with placeholders for unattempted)
  // Fall back to masteryData filtered by tier if tierTagsData is empty
  const tierTagsSource = (data.tierTagsData && data.tierTagsData.length > 0)
    ? data.tierTagsData
    : (data.masteryData || []).filter(t => (data.tagsinTier || []).includes(t.tag));
  const tierTagsFiltered = processTagData(tierTagsSource || [], data.unmasteredTags || [], search, activeFocusFilter);

  return (
    <Tabs
      defaultValue="tier"
      value={activeTab}
      onChange={(value) => {
        setCurrentPage(0);
        setActiveTab(value);
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="tier">
          Current Tier Mastery
        </Tabs.Tab>
        <Tabs.Tab value="overall">
          Overall Mastery (All Tags)
        </Tabs.Tab>
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

      {/* Tier - Show only current tier tags */}
      <Tabs.Panel value="tier" pt="md">
        <Grid>
          <Grid.Col span={6}>
            <div style={{ height: '600px' }}>
              <TimeGranularChartCard
                title={getPieTitle("tier")}
                chartType="pie"
                useTimeGranularity={false}
                data={generatePieData(selectedTag, tierTagsFiltered, "tier")}
                dataKeys={[{ key: "value", color: "#82ca9d" }]}
                chartHeight={450}
              />
            </div>
          </Grid.Col>
          <Grid.Col span={6}>
            <TagTable
              source={tierTagsFiltered}
              searchable={false}
              highlightUnmastered={false}
              withFocusBar
              data={data}
              activeFocusFilter={activeFocusFilter}
              setActiveFocusFilter={setActiveFocusFilter}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              pageSize={pageSize}
              search={search}
              setSearch={setSearch}
              setSelectedTag={setSelectedTag}
              height="600px"
            />
          </Grid.Col>
        </Grid>
      </Tabs.Panel>

      {/* Overall - Show all tags (with and without attempts) */}
      <Tabs.Panel value="overall" pt="md">
        <Grid>
          <Grid.Col span={6}>
            <div style={{ height: '600px' }}>
              <TimeGranularChartCard
                title={getPieTitle("overall")}
                chartType="pie"
                useTimeGranularity={false}
                data={generatePieData(selectedTag, allTagsFiltered, "overall")}
                dataKeys={[{ key: "value", color: "#a9c1ff" }]}
                chartHeight={450}
              />
            </div>
          </Grid.Col>
          <Grid.Col span={6}>
            <TagTable
              source={allTagsFiltered}
              searchable
              highlightUnmastered
              withFocusBar
              data={data}
              activeFocusFilter={activeFocusFilter}
              setActiveFocusFilter={setActiveFocusFilter}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              pageSize={pageSize}
              search={search}
              setSearch={setSearch}
              setSelectedTag={setSelectedTag}
              height="600px"
            />
          </Grid.Col>
        </Grid>
      </Tabs.Panel>
    </Tabs>
  );
}
