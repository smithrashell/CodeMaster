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
  Group,
} from "@mantine/core";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import TimeGranularChartCard from "./TimeGranularChartCard";

// Mock functions (replace with getCurrentLearningState())
const fetchMockData = (data) => {
  return {
    classification: data.classification,
    masteredTags: data.masteredTags,
    unmasteredTags: data.unmasteredTags,
    tagsinTier: data.tagsinTier,
    masteryData: data.masteryData,
  };
};

export default function MasteryDashboard(props) {
  const [selectedTag, setSelectedTag] = useState(null);
  const [data, setData] = useState(props.data);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    (async () => {
      const formattedData = fetchMockData(props.data);
      setData(formattedData);
    })();
  }, [props.data]);

  if (!data) return <Text>Loading...</Text>;

  const getPieData = () => {
    if (selectedTag) {
      const { successfulAttempts, totalAttempts } = selectedTag;
      return [
        { name: "Successful", value: successfulAttempts },
        { name: "Unsuccessful", value: totalAttempts - successfulAttempts },
      ];
    }

    const mastered = data.masteryData.filter(
      (t) => t.successfulAttempts / t.totalAttempts >= 0.8
    ).length;
    const unmastered = data.masteryData.length - mastered;
    return [
      { name: "Mastered", value: mastered },
      { name: "Unmastered", value: unmastered },
    ];
  };

  const pieTitle = selectedTag
    ? `Mastery: ${selectedTag.tag}`
    : "Mastery Overview";

  // Helper: case-insensitive inclusion
  const isUnmastered = (tag) =>
    data.unmasteredTags.map((t) => t.toLowerCase()).includes(tag.toLowerCase());

  // SORT: unmastered first, then search match
  const sortedMastery = [...data.masteryData].sort((a, b) => {
    const aPinned = isUnmastered(a.tag) ? -1 : 1;
    const bPinned = isUnmastered(b.tag) ? -1 : 1;
    if (aPinned !== bPinned) return aPinned - bPinned;

    const aMatch = a.tag.toLowerCase().includes(search.toLowerCase()) ? -1 : 1;
    const bMatch = b.tag.toLowerCase().includes(search.toLowerCase()) ? -1 : 1;
    return aMatch - bMatch;
  });

  // PAGINATION: always applied to the sorted list
  const filteredMastery = sortedMastery.filter((tag) =>
    tag.tag.toLowerCase().includes(search.toLowerCase())
  );
  const paginatedTags = filteredMastery.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize
  );

  const currentTierTags = sortedMastery.filter((t) =>
    data.tagsinTier.includes(t.tag)
  );
  const paginatedTierTags = currentTierTags.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize
  );

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  const handleNextPage = () => {
    if ((currentPage + 1) * pageSize < sortedMastery.length) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const renderTagTable = (
    tags,
    searchable = false,
    highlightUnmastered = false,
    showPagination = true
  ) => (
    <Card shadow="sm" p="md" withBorder>
      {searchable && (
        <TextInput
          placeholder="Search tag..."
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setCurrentPage(0);
          }}
          mb="md"
        />
      )}
      <ScrollArea style={{ maxHeight: 300 }}>
        <Table striped highlightOnHover withBorder withColumnBorders>
          <thead>
            <tr>
              <th>Tag</th>
              <th>Mastery %</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tagObj) => {
              const mastery =
                tagObj.totalAttempts > 0
                  ? (tagObj.successfulAttempts / tagObj.totalAttempts) * 100
                  : 0;

              const isUnmastered =
                highlightUnmastered &&
                data.unmasteredTags
                  .map((t) => t.toLowerCase())
                  .includes(tagObj.tag.toLowerCase());

              return (
                <tr
                  key={tagObj.tag}
                  style={{
                    cursor: "pointer",
                    backgroundColor: isUnmastered
                      ? "rgba(3, 13, 22, 0.5)"
                      : "transparent",
                  }}
                  onClick={() => setSelectedTag(tagObj)}
                >
                  <td>{tagObj.tag}</td>
                  <td>{mastery.toFixed(1)}%</td>
                  <td>{tagObj.totalAttempts}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </ScrollArea>
      {showPagination && (
        <Group position="apart" mt="md">
          <Button
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            variant="light"
          >
            <IconArrowLeft size={16} />
          </Button>
          <Text>
            Page {currentPage + 1} of{" "}
            {Math.ceil(sortedMastery.length / pageSize)}
          </Text>
          <Button
            onClick={handleNextPage}
            disabled={(currentPage + 1) * pageSize >= sortedMastery.length}
            variant="light"
          >
            <IconArrowRight size={16} />
          </Button>
        </Group>
      )}
    </Card>
  );

  return (
    <Tabs style={{ backgroundColor: "white" }} defaultValue="overall">
      <Tabs.List>
        <Tabs.Tab value="overall">Overall Mastery</Tabs.Tab>
        <Tabs.Tab value="tier">Current Tier Mastery</Tabs.Tab>
        {selectedTag && (
          <Button mt="sm" variant="light" onClick={() => setSelectedTag(null)}>
            Back to Overview
          </Button>
        )}
      </Tabs.List>

      {/* Overall Mastery */}
      <Tabs.Panel value="overall" pt="md">
        <Grid>
          <Grid.Col span={6}>
            <TimeGranularChartCard
              title={pieTitle}
              chartType="pie"
              useTimeGranularity={false}
              data={getPieData()}
              dataKeys={[{ key: "value", color: "#8884d8" }]}
            />
          </Grid.Col>

          <Grid.Col span={6}>
            {renderTagTable(
              paginatedTags,
              true /* searchable */,
              false /* no highlight */
            )}
          </Grid.Col>
        </Grid>
      </Tabs.Panel>

      {/* Current Tier Mastery */}
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
            {renderTagTable(paginatedTierTags, false, true /* highlight */)}
          </Grid.Col>
        </Grid>
      </Tabs.Panel>
    </Tabs>
  );
}
