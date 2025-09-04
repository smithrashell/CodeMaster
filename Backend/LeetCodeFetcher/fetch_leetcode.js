import fetch from "node-fetch";

import fs from "fs"; // File system module for writing files

const url = "https://leetcode.com/api/problems/algorithms/";

fetch(url)
  .then((response) => response.json())
  .then((data) => {
    const problems = data.stat_status_pairs;

    // Log the total number of problems
    console.log(`Total number of problems: ${problems.length}\n`);

    // Create an array of rows for the CSV file
    const csvRows = [
      "Problem Number,Title,Slug,Internal ID,Difficulty,Paid Only,Favorite,Frequency", // Header row
    ];

    problems.forEach((problem) => {
      const {
        question_id,
        question__title,
        question__title_slug,
        frontend_question_id,
      } = problem.stat;

      const difficultyLevel = ["Easy", "Medium", "Hard"][
        problem.difficulty.level - 1
      ];
      const isPaidOnly = problem.paid_only;
      const isFavor = problem.is_favor;
      const frequency = problem.frequency;

      // Add a row of data
      csvRows.push(
        `"${frontend_question_id}","${question__title}","${question__title_slug}","${question_id}","${difficultyLevel}","${isPaidOnly}","${isFavor}","${frequency}"`
      );
    });

    // Combine all rows into a single CSV string
    const csvContent = csvRows.join("\n");

    // Write the CSV content to a file
    fs.writeFileSync("leetcode_problems.csv", csvContent);

    console.log("Data successfully exported to leetcode_problems.csv");
  })
  .catch((error) => console.error("Error fetching data:", error));

