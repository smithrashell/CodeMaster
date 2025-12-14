import { useDisclosure } from "@mantine/hooks";
import {
  Grid,
  Card,
  Text,
  Collapse,
  UnstyledButton,
  Group,
  Skeleton,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";

export default function MetricCard({ title, value, details, loading = false }) {
  const [opened, { toggle }] = useDisclosure(false);
  
  if (loading) {
    return (
      <Grid.Col span={3}>
        <Card shadow="sm" p="lg" withBorder>
          <div>
            <Skeleton height={20} width="70%" mb={8} />
            <Skeleton height={28} width="50%" mb={16} />
          </div>
          <div>
            <Skeleton height={12} mb={4} />
            <Skeleton height={12} mb={4} />
            <Skeleton height={12} width="80%" />
          </div>
        </Card>
      </Grid.Col>
    );
  }

  return (
    <Grid.Col span={3}>
      <Card shadow="sm" p="lg" withBorder>
        <UnstyledButton onClick={toggle} style={{ width: "100%" }}>
          <Group justify="space-between">
            <div>
              <Text fw={500} size="sm" c="var(--cm-text-dimmed)">
                {title}
              </Text>
              <Text size="lg" fw={700}>
                {value}
              </Text>
            </div>
            {opened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </Group>
        </UnstyledButton>

        <Collapse in={opened} mt="md">
          {details?.map((item, index) => (
            <Group key={index} justify="space-between">
              <Text size="xs" c="var(--cm-text-dimmed)">
                {item.label}
              </Text>
              <Text size="xs" fw={500}>
                {item.value}
              </Text>
            </Group>
          )) || []}
        </Collapse>
      </Card>
    </Grid.Col>
  );
}
