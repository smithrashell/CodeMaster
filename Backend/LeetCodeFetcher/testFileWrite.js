import fs from "fs";

// Sample test data
const testProblems = [
  {
    stat: {
      question__title: "Test Problem",
      question__title_slug: "test-problem",
      frontend_question_id: 1,
    },
    difficulty: { level: 1 },
    tags: ["Array", "Greedy"],
  },
  {
    stat: {
      question__title: "Second Problem",
      question__title_slug: "second-problem",
      frontend_question_id: 2,
    },
    difficulty: { level: 2 },
    tags: ["Dynamic Programming", "Math"],
  },
];

// Build CSV rows
const csvRows = ["Problem Number,Title,Slug,Difficulty,Tags"]; // Header row
testProblems.forEach((problem) => {
  const {
    stat: { question__title, question__title_slug, frontend_question_id },
    difficulty: { level },
    tags,
  } = problem;

  const difficultyLevel = ["Easy", "Medium", "Hard"][level - 1]; // Map level to string
  csvRows.push(
    `"${frontend_question_id}","${question__title}","${question__title_slug}","${difficultyLevel}","${tags.join(
      ","
    )}"`
  );
});

// Write CSV file
const outputFilename = "test_output.csv";
try {
  fs.writeFileSync(outputFilename, csvRows.join("\n"));
  console.log(`Test CSV file written successfully: ${outputFilename}`);
} catch (error) {
  console.error(`Error writing test CSV file:`, error);
}
