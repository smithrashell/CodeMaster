import React from "react";
import { Text, Button } from "@mantine/core";

const EmptyLearningPathState = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center'
    }}>
      <Text size="lg" fw={600} mb="md" c="var(--cm-text)">No Learning Progress Yet</Text>
      <Text size="sm" mb="lg">
        Complete some coding sessions to see your learning path visualization.
      </Text>
      <Button 
        variant="light" 
        onClick={() => window.open("https://leetcode.com/problems/", "_blank")}
      >
        Start Your First Session
      </Button>
    </div>
  );
};

export default EmptyLearningPathState;