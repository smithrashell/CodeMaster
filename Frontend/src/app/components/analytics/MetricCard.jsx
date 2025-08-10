import { useDisclosure } from "@mantine/hooks";
import {
  Grid,
  Card,
  Text,
  Collapse,
  UnstyledButton,
  Group,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";

export default function MetricCard({ title, value, details }) {
  const [opened, { toggle }] = useDisclosure(false);

  return (
    <Grid.Col span={4}>
      <Card shadow="sm" p="lg" withBorder>
        <UnstyledButton onClick={toggle} sx={{ width: "100%" }}>
          <Group position="apart">
            <div>
              <Text weight={500} size="lg">
                {title}
              </Text>
              <Text size="xl" weight={700}>
                {value}
              </Text>
            </div>
            {opened ? <IconChevronUp /> : <IconChevronDown />}
          </Group>
        </UnstyledButton>

        <Collapse in={opened} mt="md">
          {details.map((item, index) => (
            <Group key={index} position="apart">
              <Text size="sm" color="dimmed">
                {item.label}
              </Text>
              <Text size="sm" weight={500}>
                {item.value}
              </Text>
            </Group>
          ))}
        </Collapse>
      </Card>
    </Grid.Col>
  );
}
