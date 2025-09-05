import { Container, Title, Text, Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";

export function StatsErrorState({ error, refresh }) {
  return (
    <Container size="xl" p="md">
      <Title order={2} mb="md">Dashboard Overview</Title>
      <Text color="red">Error loading statistics: {error.message}</Text>
      <Button leftSection={<IconRefresh size={16} />} onClick={refresh} mt="md">
        Retry
      </Button>
    </Container>
  );
}