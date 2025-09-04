import fetch from "node-fetch";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI(process.env.OPENAI_API_KEY);

// Middleware setup
app.use(cors());
app.use(express.json());

// Constants
const MAX_RETRIES = 2;

// Helper Functions
async function fetchTags(problem, assistantId) {
  try {
    console.log(`Fetching tags for problem: ${problem.title}`);
    const threadResponse = await openai.beta.threads.create();
    const threadId = threadResponse.id;

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: JSON.stringify(problem.title),
    });

    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
      model: "gpt-4-turbo",
      tool_choice: {
        type: "function",
        function: { name: "assign_tags_to_problems" },
      },
    });

    console.log("Run details:", run);

    return await handleRunStatus(run);
  } catch (error) {
    console.error(`Error fetching tags for problem "${problem.title}":`, error);
    throw error;
  }
}

async function fetchTagsAlternative(problem, assistantId) {
  try {
    console.log(`Using alternative strategy for problem: ${problem.title}`);
    const threadResponse = await openai.beta.threads.create();
    const threadId = threadResponse.id;

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: JSON.stringify({
        problem: problem.title,
        alternativeStrategy: true,
      }),
    });

    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
      model: "gpt-4-turbo",
      tool_choice: {
        type: "function",
        function: { name: "assign_tags_to_problems" },
      },
    });

    return await handleRunStatus(run);
  } catch (error) {
    console.error(
      `Error with alternative strategy for problem "${problem.title}":`,
      error
    );
    throw error;
  }
}

async function retryFetchingTags(problem, assistantId) {
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      if (retryCount < 2) {
        return await fetchTags(problem, assistantId);
      } else {
        return await fetchTagsAlternative(problem, assistantId);
      }
    } catch (error) {
      console.error(
        `Retry #${retryCount + 1} failed for problem "${problem.title}":`,
        error.message
      );
      retryCount++;
    }
  }

  throw new Error(
    `Failed to fetch tags for problem "${problem.title}" after ${MAX_RETRIES} retries.`
  );
}

async function handleRunStatus(run) {
  if (!run || !run.status) {
    console.error("Run object or its status is undefined:", run);
    throw new Error("Run object or its status is undefined.");
  }

  if (run.status === "completed") {
    const messages = await openai.beta.threads.messages.list(run.thread_id);
    for (const message of messages.data) {
      if (message.content) {
        const parsedContent = parseMessageContent(message.content);
        if (parsedContent) return parsedContent;
      }
    }
  } else if (run.status === "requires_action") {
    console.log("Run requires action. Handling...");
    return await handleRequiresAction(run);
  } else {
    console.error(`Unexpected run status: ${run.status}`, run);
    throw new Error(`Unexpected run status: ${run.status}`);
  }
}

function parseMessageContent(contentValue) {
  console.log("Content Value Type:", typeof contentValue);
  console.log("Content Value:", contentValue);

  if (typeof contentValue !== "string") {
    console.error("Content value is not a string:", contentValue);
    return null; // Exit if it's not a string
  }

  try {
    const jsonMatch = contentValue.match(/{.*}/s);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error("Failed to parse JSON object:", error);
    return null;
  }
}


async function handleRequiresAction(run) {
  if (run.required_action?.submit_tool_outputs?.tool_calls) {
    const toolOutputs = run.required_action.submit_tool_outputs.tool_calls.map(
      (toolCall) => ({
        tool_call_id: toolCall.id,
        output: JSON.stringify({ success: true }),
      })
    );

    try {
      console.log(
        "Submitting tool outputs:",
        JSON.stringify(toolOutputs, null, 2)
      );
      const updatedRun =
        await openai.beta.threads.runs.submitToolOutputsAndPoll(
          run.thread_id,
          run.id,
          { tool_outputs: toolOutputs }
        );
      console.log("Tool outputs submitted successfully.");
      return handleRunStatus(updatedRun);
    } catch (error) {
      console.error("Error submitting tool outputs:", error);
      throw error;
    }
  }
  console.log("No tool outputs to submit.");
  return run;
}

// Endpoint for fetching tags
app.post("/fetch-tags", async (req, res) => {
  const { title } = req.body;

  // Validate input
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title must be a non-empty string." });
  }

  const problem = { title };

  try {
    const assistantId = process.env.TAG_ASSISTANT_ID;
    if (!assistantId) {
      throw new Error("Assistant ID is not configured.");
    }

    // Retry fetching tags
    const tags = await retryFetchingTags(problem, assistantId);

    // Construct response
    const result = {
      LeetCodeID: tags.LeetCodeID,
      Description: title,
      Tags: tags.Tags,
    };

    res.json(result); // Return the single object
  } catch (error) {
    console.error("Error fetching tags:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// import fetch from "node-fetch";
// import express from "express";
// import cors from "cors";
// import OpenAI from "openai";
// import dotenv from "dotenv";

// dotenv.config();

// const app = express();
// const port = process.env.PORT || 3000;
// const openai = new OpenAI(process.env.OPENAI_API_KEY);

// // Middleware setup
// app.use(cors());
// app.use(express.json());

// // Constants
// const MAX_RETRIES = 4;

// // Helper Functions
// async function fetchTags(problem, assistantId) {
//   try {
//     console.log(
//       `Fetching tags for problem: ${problem.title} (ID: ${problem.problemId})`
//     );
//     const threadResponse = await openai.beta.threads.create();
//     const threadId = threadResponse.id;

//     await openai.beta.threads.messages.create(threadId, {
//       role: "user",
//       content: JSON.stringify(problem),
//     });

//     const run = await openai.beta.threads.runs.createAndPoll(threadId, {
//       assistant_id: assistantId,
//       model: "gpt-4-turbo",
//       tool_choice: {
//         type: "function",
//         function: { name: "assign_tags_to_problems" },
//       },
//     });

//     return await handleRunStatus(run);
//   } catch (error) {
//     console.error(`Error fetching tags for problem "${problem.title}":`, error);
//     throw error;
//   }
// }

// async function fetchTagsAlternative(problem, assistantId) {
//   try {
//     console.log(
//       `Using alternative strategy for problem: ${problem.title} (ID: ${problem.problemId})`
//     );
//     const threadResponse = await openai.beta.threads.create();
//     const threadId = threadResponse.id;

//     await openai.beta.threads.messages.create(threadId, {
//       role: "user",
//       content: JSON.stringify({
//         ...problem,
//         alternativeStrategy: true,
//       }),
//     });

//     const run = await openai.beta.threads.runs.createAndPoll(threadId, {
//       assistant_id: assistantId,
//       model: "gpt-4-turbo",
//       tool_choice: {
//         type: "function",
//         function: { name: "assign_tags_to_problems" },
//       },
//     });

//     return await handleRunStatus(run);
//   } catch (error) {
//     console.error(
//       `Error with alternative strategy for problem "${problem.title}":`,
//       error
//     );
//     throw error;
//   }
// }

// async function retryFetchingTags(problem, assistantId) {
//   let retryCount = 0;

//   while (retryCount < MAX_RETRIES) {
//     try {
//       if (retryCount < 2) {
//         return await fetchTags(problem, assistantId);
//       } else {
//         return await fetchTagsAlternative(problem, assistantId);
//       }
//     } catch (error) {
//       console.error(
//         `Retry #${retryCount + 1} failed for problem "${problem.title}"`
//       );
//       retryCount++;
//     }
//   }

//   throw new Error(
//     `Failed to fetch tags for problem "${problem.title}" after ${MAX_RETRIES} retries.`
//   );
// }

// async function handleRunStatus(run) {
//   if (run.status === "completed") {
//     const messages = await openai.beta.threads.messages.list(run.thread_id);
//     for (const message of messages.data) {
//       if (message.content) {
//         const parsed = parseMessageContent(message.content);
//         if (parsed) return parsed;
//       }
//     }
//   } else if (run.status === "requires_action") {
//     console.log("Run requires action. Handling...");
//     return await handleRequiresAction(run);
//   } else {
//     throw new Error(`Unexpected run status: ${run.status}`);
//   }
// }

// function parseMessageContent(contentValue) {
//   try {
//     const jsonMatch = contentValue.match(/{.*}/s);
//     return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
//   } catch (error) {
//     console.error("Failed to parse message content:", error);
//     return null;
//   }
// }

// async function handleRequiresAction(run) {
//   if (run.required_action?.submit_tool_outputs?.tool_calls) {
//     const toolOutputs = run.required_action.submit_tool_outputs.tool_calls.map(
//       (toolCall) => ({
//         tool_call_id: toolCall.id,
//         output: JSON.stringify({ success: true }),
//       })
//     );

//     try {
//       console.log("Submitting tool outputs...");
//       await openai.beta.threads.runs.submitToolOutputsAndPoll(
//         run.thread_id,
//         run.id,
//         { tool_outputs: toolOutputs }
//       );
//     } catch (error) {
//       console.error("Error submitting tool outputs:", error);
//       throw error;
//     }
//   }
//   return run;
// }

// // Endpoint for fetching tags
// app.post("/fetch-tags", async (req, res) => {
//   const { title } = req.body;

//   // Validate input
//   if (typeof title !== "string" || !title.trim()) {
//     return res.status(400).json({ error: "Title must be a non-empty string." });
//   }

//   try {
//     // Fetch tags from ChatGPT (replace with your logic for fetching tags)
//     const tags = await fetchTagsFromChatGPT(title);

//     // Construct response
//     const result = {
//       LeetCodeID: tags.LeetCodeID,
//       Description: title,
//       Tags: tags.Tags,
//     };

//     res.json(result); // Return the single object
//   } catch (error) {
//     console.error("Error fetching tags:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // Start the server
// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });
