import React from "react";
import { Accordion, List, Text } from "@mantine/core";

export function FAQSection() {
  return (
    <Accordion variant="separated">
      <Accordion.Item value="what-is-codemaster">
        <Accordion.Control>What is CodeMaster?</Accordion.Control>
        <Accordion.Panel>
          <Text>
            CodeMaster is a Chrome extension that helps you master algorithms through personalized spaced repetition and pattern ladders.
            It tracks your LeetCode progress and provides smart analytics to optimize your learning journey.
          </Text>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="how-does-recalibration-work">
        <Accordion.Control>How does the recalibration system work?</Accordion.Control>
        <Accordion.Panel>
          <Text mb="sm">
            The recalibration system helps you get back on track after taking a break from practicing. It uses:
          </Text>
          <List spacing="xs" size="sm">
            <List.Item><strong>Passive Decay:</strong> Gradually adjusts problem difficulty based on time away (90-day half-life)</List.Item>
            <List.Item><strong>Diagnostic Sessions:</strong> 5-problem assessments to recalibrate your skill level</List.Item>
            <List.Item><strong>Adaptive Sessions:</strong> Real-time adjustments based on your performance</List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="box-levels">
        <Accordion.Control>What are box levels and how do they work?</Accordion.Control>
        <Accordion.Panel>
          <Text mb="sm">
            CodeMaster uses the Leitner system with box levels to optimize your learning through spaced repetition:
          </Text>
          <List spacing="xs" size="sm">
            <List.Item><strong>Box 1:</strong> New problems - high frequency review</List.Item>
            <List.Item><strong>Box 2-3:</strong> Learning phase - medium frequency</List.Item>
            <List.Item><strong>Box 4-5:</strong> Mastered - low frequency, longer intervals</List.Item>
            <List.Item>Problems move up when solved correctly, down when incorrect</List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="pattern-ladders">
        <Accordion.Control>How do pattern ladders help me learn?</Accordion.Control>
        <Accordion.Panel>
          <Text>
            Pattern ladders provide structured learning paths for each algorithm topic (Arrays, Trees, Dynamic Programming, etc.).
            They guide you through problems of increasing difficulty, helping you build mastery step by step.
            Each ladder tracks your progress and adjusts to your skill level.
          </Text>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="data-privacy">
        <Accordion.Control>Is my data private and secure?</Accordion.Control>
        <Accordion.Panel>
          <Text>
            Yes! All your data is stored locally in your browser using IndexedDB. CodeMaster does not send your problem history,
            session data, or any personal information to external servers. Your learning journey stays completely private on your device.
          </Text>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="welcome-back-modal">
        <Accordion.Control>Why am I seeing a Welcome Back modal?</Accordion.Control>
        <Accordion.Panel>
          <Text mb="sm">
            The Welcome Back modal appears when you return after an extended break (30+ days). It offers recalibration options:
          </Text>
          <List spacing="xs" size="sm">
            <List.Item><strong>Gentle (30-90 days):</strong> Resume or take a diagnostic session</List.Item>
            <List.Item><strong>Moderate (90-365 days):</strong> Diagnostic session or adaptive first session</List.Item>
            <List.Item><strong>Major (365+ days):</strong> Comprehensive recalibration recommended</List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
