import { useState } from "react";
import {
  Card,
  TextInput,
  Table,
  Text,
  ScrollArea,
  Group,
  Button,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

export default function SearchableTagTable({ tags = [], onSelect }) {
  const [search, setSearch] = useState("");

  const filteredTags = tags.filter((tag) =>
    tag.tag.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card shadow="sm" p="md" withBorder>
      <TextInput
        placeholder="Search tag..."
        icon={<IconSearch size="1rem" />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="md"
      />

      <ScrollArea style={{ maxHeight: 300 }}>
        <Table striped highlightOnHover withBorder withColumnBorders>
          <thead>
            <tr>
              <th>Tag</th>
              <th>Mastery %</th>
              <th>Attempts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredTags.map((tag) => {
              const mastery =
                tag.totalAttempts > 0
                  ? (tag.successfulAttempts / tag.totalAttempts) * 100
                  : 0;

              return (
                <tr key={tag.tag}>
                  <td>{tag.tag}</td>
                  <td>{mastery.toFixed(1)}%</td>
                  <td>{tag.totalAttempts}</td>
                  <td>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => onSelect(tag)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
