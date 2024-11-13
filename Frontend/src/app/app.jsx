import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import {
  HomePage,
  DashboardPage,
  AnalyticsPage,
  SettingsPage,
  AccountPage,
  FlashcardPage,
  Stats,
  Reports,
  Goals,
  Progress,
  Conversions,
  Sources,
  General,
  Appearance,
  Accessibility,
  Profile,
  Settings,
  Notifications,
  Flashcards,
  Practice,
  Review,
} from "./pages/mockup";
import { MantineProvider } from "@mantine/core";
import { DoubleNavbar } from "../content/components/DoubleNavbar";
import "@mantine/core/styles.css";
import "../app/app.css";

function App() {
  return (
    <MantineProvider>
      <Router>
        <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
          <DoubleNavbar />
          <main style={{ padding: "20px", flex: 1 }}>
            <Routes>
              <Route path="/app.html" element={<Navigate to="/" replace />} />
              <Route path="/" element={<DashboardPage />}>
                <Route path="stats" element={<Stats />} />
                <Route path="reports" element={<Reports />} />
                <Route path="goals" element={<Goals />} />
              </Route>
              <Route path="/analytics" element={<AnalyticsPage />}>
                <Route path="progress" element={<Progress />} />
                <Route path="conversions" element={<Conversions />} />
                <Route path="sources" element={<Sources />} />
              </Route>
              <Route path="/settings" element={<SettingsPage />}>
                <Route path="general" element={<General />} />
                <Route path="appearance" element={<Appearance />} />
                <Route path="accessibility" element={<Accessibility />} />
              </Route>
              <Route path="/account" element={<AccountPage />}>
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>
              <Route path="/review" element={<FlashcardPage />}>
                <Route path="flashcards" element={<Flashcards />} />
                <Route path="practice" element={<Practice />} />
                <Route path="review" element={<Review />} />
              </Route>
            </Routes>
          </main>
        </div>
      </Router>
    </MantineProvider>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
// function FlashcardApp() {
//   const [code, setCode] = useState("// Write your code here\n");
//   const [output, setOutput] = useState("");

//   const exercises = [
//     {
//       title: "Rotate Array",
//       description:
//         "Write a function to rotate an array to the right by k steps.",
//       starterCode: `function rotateArray(nums, k) {\n  // Your code here\n}`,
//       testCases: [
//         {
//           input: "[1, 2, 3, 4, 5, 6, 7], 3",
//           expected: "[5, 6, 7, 1, 2, 3, 4]",
//         },
//         { input: "[1, 2, 3], 2", expected: "[2, 3, 1]" },
//         { input: "[1], 0", expected: "[1]" },
//       ],
//     },
//   ];

//   const currentExercise = exercises[0];
//   const handleTestResults = (results) => {
//     setOutput(results.join("\n"));
//   };

//   const runCode = async () => {
//     setOutput("Running...");

//     try {
//       const response = await fetch("http://localhost:3000/execute-code", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           code,
//           testCases: currentExercise.testCases,
//         }),
//       });

//       const data = await response.json();
//       const results = data.results.map(
//         ({ input, expected, result, passed }) =>
//           `Input: ${input}, Expected: ${expected}, Got: ${result}, Passed: ${passed}`
//       );
//       setOutput(results.join("\n"));
//     } catch (error) {
//       setOutput(`Error: ${error.message}`);
//     }
//   };

//   const handleResult = (result) => {
//     setOutput(result);
//   };

//   return (
//     <div id="flashcard-container">
//       <div id="flashcard">
//         <h2>{currentExercise.title}</h2>
//         <p>{currentExercise.description}</p>
//         <CodeEditor code={code} setCode={setCode} />

//         <button onClick={runCode}>Run Code</button>
//         <pre id="output">{output}</pre>
//       </div>
//     </div>
//   );
// }