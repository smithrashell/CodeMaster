import { useState } from "react";
import CodeEditor from "../codeeditor";

export function Flashcards() {
  const [code, setCode] = useState("// Write your code here\n");
  const [output, setOutput] = useState("");

  const exercises = [
    {
      title: "Rotate Array",
      description:
        "Write a function to rotate an array to the right by k steps.",
      starterCode: `function rotateArray(nums, k) {\n  // Your code here\n}`,
      testCases: [
        {
          input: "[1, 2, 3, 4, 5, 6, 7], 3",
          expected: "[5, 6, 7, 1, 2, 3, 4]",
        },
        { input: "[1, 2, 3], 2", expected: "[2, 3, 1]" },
        { input: "[1], 0", expected: "[1]" },
      ],
    },
  ];

  const currentExercise = exercises[0];
  const _handleTestResults = (results) => {
    setOutput(results.join("\n"));
  };

  const runCode = async () => {
    setOutput("Code execution coming soon! This feature requires a backend service and will be available in a future update.");

    // TODO: Implement code execution backend
    // This feature is currently disabled for Chrome Web Store submission
    // Will be enabled in future version with proper backend integration

    /* Original localhost code - disabled for production
    try {
      const response = await fetch("http://localhost:3000/execute-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          testCases: currentExercise.testCases,
        }),
      });

      const data = await response.json();
      const results = data.results.map(
        ({ input, expected, result, passed }) =>
          `Input: ${input}, Expected: ${expected}, Got: ${result}, Passed: ${passed}`
      );
      setOutput(results.join("\n"));
    } catch (error) {
      setOutput(`Error: ${error.message}`);
    }
    */
  };

  const _handleResult = (result) => {
    setOutput(result);
  };

  return (
    <div id="flashcard-container">
      <div id="flashcard">
        <h2>{currentExercise.title}</h2>
        <p>{currentExercise.description}</p>
        <CodeEditor code={code} setCode={setCode} />

        <button onClick={runCode}>Run Code</button>
        <pre id="output">{output}</pre>
      </div>
    </div>
  );
}
// export function Flashcards() {
//   return <h1>Flashcards</h1>;
// }
