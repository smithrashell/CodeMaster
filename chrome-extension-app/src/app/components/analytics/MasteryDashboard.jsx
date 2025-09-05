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
  unmasteredTags: data?.unmasteredTags || [],
  tagsinTier: data?.tagsinTier || [],
});

// Helper functions
const generatePieData = (selectedTag, masteryData) => {
  if (selectedTag) {
    const { successfulAttempts, totalAttempts } = selectedTag;
    return [
      { name: "Successful", value: successfulAttempts },
      { name: "Failed", value: totalAttempts - successfulAttempts }
    ];
  }
  
  const mastered = masteryData.filter(tag => tag.mastered).length;
  const unmastered = masteryData.length - mastered;
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
      if (search && !tag.tag.toLowerCase().includes(search.toLowerCase())) return false;
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

const createTableRows = (data, options, callbacks) => {
  const { highlightUnmastered } = options;
  const { setSelectedTag } = callbacks;
  
  return data.map((tag) => {
    const progress = Math.round((tag.successfulAttempts / tag.totalAttempts) * 100) || 0;
    const isFocus = tag.isFocus;
    const isUnmastered = !tag.mastered;
    
    return (
      <Table.Tr
        key={tag.tag}
        onClick={() => setSelectedTag(tag)}
        style={{
          backgroundColor: highlightUnmastered && isUnmastered ? "var(--mantine-color-red-0)" : undefined,
          cursor: "pointer"
        }}
      >
        <Table.Td>
          <Group gap="xs">
            <Text fw={isFocus ? 600 : 400}>
              {tag.tag}
            </Text>
            {isFocus && <Badge size="xs" color="cyan">focus</Badge>}
            {isUnmastered && <Badge size="xs" color="orange">learning</Badge>}
          </Group>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{tag.totalAttempts}</Text>
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
  setSelectedTag
}) => {
  const rows = createTableRows(paginateData(source, currentPage, pageSize), 
    { highlightUnmastered }, 
    { setSelectedTag }
  );
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
        <Text size="sm" c="dimmed">
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
  const pageSize = 10;

  useEffect(() => {
    setData(normalizeData(props.data));
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


  const pieTitle = selectedTag ? `Mastery: ${selectedTag.tag}` : "Mastery Overview";
  const focusFiltered = processTagData(data.masteryData || [], data.unmasteredTags || [], search, activeFocusFilter);



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
              data={generatePieData(selectedTag, data.masteryData)}
              dataKeys={[{ key: "value", color: "#a9c1ff" }]}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TagTable 
              source={focusFiltered} 
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
            />
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
              data={generatePieData(selectedTag, data.masteryData)}
              dataKeys={[{ key: "value", color: "#82ca9d" }]}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TagTable 
              source={tierOnly} 
              searchable={false} 
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
            />
          </Grid.Col>
        </Grid>
      </Tabs.Panel>
    </Tabs>
  );
}
