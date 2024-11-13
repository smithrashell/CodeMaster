import express from "express";
import { EventEmitter } from "events";
import cors from "cors";
import OpenAI from "openai";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI(process.env.OPENAI_API_KEY);

// Middleware setup
app.use(cors());
app.use(express.json());

// Open the database connection
// let db;

// async function openDb() {
//   db = await open({
//     filename: "./database.db",
//     driver: sqlite3.Database,
//   });

// Clear table for testing
//await db.run("DROP TABLE IF EXISTS threads");

// Create the threads table if it doesn't exist
//   await db.run(
//         CREATE TABLE IF NOT EXISTS threads (
//             assistant_id TEXT,
//             thread_id TEXT
//         )
//     );
// }

// await openDb()
//   .then(() => {
//     console.log(
//       "Connected to the SQLite database and ensured threads table exists."
//     );
//   })
//   .catch((error) => {
//     console.error("Error connecting to the database:", error);
//   });

const handleRequiresAction = async (run) => {
  // Check if there are tools that require outputs
  if (
    run.required_action &&
    run.required_action.submit_tool_outputs &&
    run.required_action.submit_tool_outputs.tool_calls
  ) {
    // Loop through each tool in the required action section
    const toolOutputs = run.required_action.submit_tool_outputs.tool_calls.map(
      (toolCall) => {
        if (toolCall.function.name === "assign_tags_to_problems") {
          return {
            tool_call_id: toolCall.id,
            output: `${{ success: true }}`,
          };
        }
      }
    );

    // Submit all tool outputs at once after collecting them in a list
    if (toolOutputs.length > 0) {
      run = await openai.beta.threads.runs.submitToolOutputsAndPoll(
        run.thread_id,
        run.id,
        { tool_outputs: toolOutputs }
      );
      console.log("Tool outputs submitted successfully.");
    } else {
      console.log("No tool outputs to submit.");
    }

    // Check statuys after submitting tool outputs
    return handleRunStatus(run);
  }
};
const handleRunStatus = async (run) => {
  if (run.status === "completed") {
    let messages = await openai.beta.threads.messages.list(run.thread_id);
    let result = null; // Initialize result as null to store the desired object

    console.log("Messages data:", JSON.stringify(messages.data, null, 2)); // Log the entire messages data in a readable format

    // Iterate over the messages to access the content
    messages.data.forEach((message) => {
      console.log("Message content:", JSON.stringify(message.content, null, 2)); // Log the content of each message in a readable format

      if (message.content && Array.isArray(message.content)) {
        message.content.forEach((contentItem) => {
          console.log("Content item:", JSON.stringify(contentItem, null, 2)); // Log each content item in a readable format

          if (
            contentItem.type === "text" &&
            contentItem.text &&
            contentItem.text.value
          ) {
            let contentValue = contentItem.text.value;

            // Extract the JSON part using a regular expression
            const jsonMatch = contentValue.match(/{.*}/s);
            if (jsonMatch) {
              const cleanedContentValue = jsonMatch[0]; // The matched JSON part

              // Attempt to parse the cleaned contentValue if it's a valid JSON string
              try {
                let parsedValue = JSON.parse(cleanedContentValue);
                console.log("Parsed content item value:", parsedValue); // Log the parsed JSON object

                // Check if the parsed object has the required keys
                if (
                  parsedValue.LeetCodeID &&
                  parsedValue.Description &&
                  Array.isArray(parsedValue.Tags)
                ) {
                  result = parsedValue; // Store the parsed object as the result
                  console.log(
                    "Matching content found:",
                    JSON.stringify(result, null, 2)
                  );
                }
              } catch (error) {
                console.log("Failed to parse JSON object:", error);
              }
            } else {
              console.log("No JSON found in message content.");
            }
          }
        });
      }
    });

    console.log("Final result:\n", JSON.stringify(result, null, 2)); // Log the final result
    return result;
  } else if (run.status === "requires_action") {
    console.log(run.status);
    return await handleRequiresAction(run);
  } else {
    console.error("Run did not complete:", run);
  }
};


let isProcessing = false;

app.post("/fetch-tags", async (req, res) => {
  // console.log("Received request for /fetch-problem-id", req.body);
  if (isProcessing) {
    console.log(
      "A request is already in progress. Waiting for it to finish..."
    );
    try {
      const result = await ongoingRequest;
      console.log("Returning result from ongoing request:", result);
      return res.json(result); // Ensure response is sent here
    } catch (error) {
      console.error("Error from ongoing request:", error);
      return res.status(500).json({ error: error.message }); // Ensure response is sent here
    }
  }

  isProcessing = true;
  console.log("Processing new request...");

  ongoingRequest = (async () => {
    console.log("Request started");
    try {
      const assistantId = process.env.TAG_ASSISTANT_ID;
      let threadId = null;

      console.log(
        "response",
        req.body,
        "assistantId",
        assistantId,
        "threadId",
        threadId
      );

      console.log("Creating new thread...");
      const threadResponse = await openai.beta.threads.create();
      threadId = threadResponse.id;
      console.log("Created new thread with ID:", threadId);

      if (!threadId) {
        throw new Error("Thread ID is undefined. Cannot proceed.");
      }

      const message = await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: JSON.stringify(req.body),
      });
      console.log("req", req.body);
      const run = await openai.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: assistantId,
        model: "gpt-4o",
        tool_choice: {
          type: "function",
          function: {
            name: "assign_tags_to_problems",
          },
        },
      });

      console.log("Run details:", run);

      // Step 3: Handle the response and extract the LeetCode ID and tags
      let result = await handleRunStatus(run);

      if (result) {
        console.log("result", result);
        return { results: result }; // Return result instead of sending response
      } else {
        throw new Error("Problem ID and tags not found or tool_uses is empty.");
      }
    } catch (error) {
      console.error("Error during the processing:", error);
      throw error;
    } finally {
      isProcessing = false;
      ongoingRequest = null;
      console.log("Request processing completed.");
    }
  })();

  try {
    const result = await ongoingRequest;
    console.log("Returning result from new request:", result);
    res.json(result); // Corrected to send the result directly
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

let ongoingRequest = null;
// Helper function to compare arrays
const arraysEqual = (a, b) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};


//Endpoint to execute code
app.post("/execute-code", (req, res) => {
  const { code, testCases } = req.body;

  // Validate inputs
  if (!code || !testCases) {
    return res.status(400).json({ error: "Code and test cases are required." });
  }

  const vm = new VM({
    timeout: 1000, // 1 second timeout for code execution
    sandbox: {},
  });

  // Prepare results array
  const results = testCases.map((testCase) => {
    const { input, expected } = testCase;

    try {
      // Dynamically execute the code inside the VM with test inputs
      const result = vm.run(`
        ${code}
        rotateArray(${input});
      `);

      // Parse the expected result from string to array
      const expectedArray = JSON.parse(expected);
      const passed = arraysEqual(result, expectedArray);

      return {
        input,
        expected,
        result: JSON.stringify(result),
        passed,
      };
    } catch (error) {
      return {
        input,
        expected,
        error: error.message,
      };
    }
  });

  // Send results back to the client
  res.json({ results });
});

app.listen(port, () => {
  console.log("Server is running on port 3000");
});
