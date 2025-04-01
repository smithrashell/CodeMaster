import { StorageService } from "../src/shared/services/storageService.js";
import { ProblemService } from "../src/shared/services/problemService.js";
import { SessionService } from "../src/shared/services/sessionService.js";
import { ScheduleService } from "../src/shared/services/scheduleService.js";
import { LimitService } from "../src/shared/services/limitService.js";
import { NavigationService } from "../src/shared/services/navigationService.js";
import { backupIndexedDB, getBackupFile } from "../src/shared/db/backupDB.js";
import { buildAndStoreTagGraph } from "../src/shared/db/tag_relationships.js";
import { classifyTags } from "../src/shared/db/tag_relationships.js";
import { updateStandardProblems } from "../src/shared/db/standard_problems.js";
import { updateProblemTags } from "../src/shared/db/standard_problems.js";
import { calculateTagMastery } from "../src/shared/db/tag_mastery.js";
import { rebuildProblemRelationships } from "../src/shared/db/problem_relationships.js";
import { recreateSessions } from "../src/shared/db/sessions.js";
import { addStabilityToProblems } from "../src/shared/db/problems.js";
import { connect } from "chrome-extension-hot-reload";
connect(); // handles app and popup



let activeRequests = {};
let requestQueue = [];
let isProcessing = false;

const processNextRequest = () => {
  if (requestQueue.length === 0) {
    isProcessing = false;
    return;
  }
  isProcessing = true;
  const { request, sender, sendResponse } = requestQueue.shift();
  handleRequest(request, sender, sendResponse).finally(() =>
    processNextRequest()
  );
};

const handleRequest = async (request, sender, sendResponse) => {
  const requestId = `${request.type}-${sender.tab?.id || "background"}`;

  if (activeRequests[requestId]) return;
  activeRequests[requestId] = true;
  const finishRequest = () => {
    delete activeRequests[requestId];
    processNextRequest();
  };

  try {
    /* ──────────────── Backup & Restore ──────────────── */

    switch (request.type) {
      case "backupIndexedDB":
        console.log("📌 Starting backup process...");
        backupIndexedDB()
          .then(() => {
            console.log("✅ Backup completed.");
            sendResponse({ message: "Backup successful" });
          })
          .catch((error) => {
            console.error("❌ Backup error:", error);
            sendResponse({ error: error.message });
          });
        return true; // Keep response channel open for async call

      case "getBackupFile":
        console.log("📌 Retrieving backup file...");
        getBackupFile()
          .then((backup) => {
            console.log("✅ Backup file retrieved.");
            sendResponse({ backup });
          })
          .catch((error) => {
            console.error("❌ Error getting backup file:", error);
            sendResponse({ error: error.message });
          });
        return true;

      /** ──────────────── Storage Handlers ──────────────── **/
      // TODO: setStorage
      case "setStorage":
        StorageService.set(request.key, request.value)
          .then(sendResponse)
          .finally(finishRequest);
        return true;
      // TODO: getStorage
      case "getStorage":
        StorageService.get(request.key)
          .then(sendResponse)
          .finally(finishRequest);
        return true;
      // TODO: removeStorage
      case "removeStorage":
        StorageService.remove(request.key)
          .then(sendResponse)
          .finally(finishRequest);
        return true;

      /** ──────────────── User Settings ──────────────── **/
      // TODO: setSettings
      case "setSettings":
        StorageService.setSettings(request.message)
          .then(sendResponse)
          .finally(finishRequest);
        return true;
      // TODO: getSettings
      case "getSettings":
        StorageService.getSettings().then(sendResponse).finally(finishRequest);
        return true;

      /** ──────────────── Problems Management ──────────────── **/
      // TODO: getProblemByDescription
      case "getProblemByDescription":
        ProblemService.getProblemByDescription(
          request.description,
          request.slug
        )
          .then(sendResponse)
          .catch(() => sendResponse({ error: "Problem not found" }))
          .finally(finishRequest);
        return true;
      // TODO: countProblemsByBoxLevel
      case "countProblemsByBoxLevel":
        ProblemService.countProblemsByBoxLevel()
          .then((counts) => sendResponse({ status: "success", data: counts }))
          .catch(() => sendResponse({ status: "error" }))
          .finally(finishRequest);
        return true;

      // TODO: addProblem
      case "addProblem":
        ProblemService.addOrUpdateProblem(
          request.contentScriptData,
          sendResponse
        )
          .then(() => sendResponse({ message: "Problem added successfully" }))
          .catch(() => sendResponse({ error: "Failed to add problem" }))
          .finally(finishRequest);
        return true;
      // TODO: getAllProblems
      case "getAllProblems":
        ProblemService.getAllProblems()
          .then(sendResponse)
          .catch(() => sendResponse({ error: "Failed to retrieve problems" }))
          .finally(finishRequest);
        return true;

      /** ──────────────── Sessions Management ──────────────── **/
      // TODO: getSession
      case "getSession":
        SessionService.getSession()
          .then((session) => sendResponse({ session }))
          .catch(() => sendResponse({ error: "Failed to get session" }))
          .finally(finishRequest);
        return true;

      // TODO: getCurrentSession
      case "getCurrentSession":
        // updateStandardProblems("./db/Strict_Approved_Tags_IndexedDB_Backup.json").then(() => {
        //   sendResponse({ message: "Standard problems updated" });
        // }).catch((error) => {
        //   console.error("Error updating standard problems:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error updating standard problems",
        //   });
        // })
        // buildAndStoreTagGraph().then(() => {
        //   sendResponse({ message: "Tag graph built" });
        // }).catch((error) => {
        //   console.error("Error building tag graph:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error building tag graph",
        //   });
        // })
        // classifyTags()
        //   .then(() => {
        //     sendResponse({ message: "Tags classified" });
        //   })
        //   .catch((error) => {
        //     console.error("Error classifying tags:", error);
        //     sendResponse({
        //       backgroundScriptData: "Error classifying tags",
        //     });
        //   })
        // calculateTagMastery().then(() => {
        //   sendResponse({ message: "Tag mastery calculated" });
        // }).catch((error) => {
        //   console.error("Error calculating tag mastery:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error calculating tag mastery",
        //   });
        // })
        // rebuildProblemRelationships().then(() => {
        //   sendResponse({ message: "Problem relationships rebuilt" });
        // }).catch((error) => {
        //   console.error("Error rebuilding problem relationships:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error rebuilding problem relationships",
        //   })})
        // rebuildProblemRelationships().then(() => {
        //   sendResponse({ message: "Problem relationships rebuilt" });
        // }).catch((error) => {
        //   console.error("Error rebuilding problem relationships:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error rebuilding problem relationships",
        //   })})
        // recreateSessions().then(() => {
        //   sendResponse({ message: "Sessions recreated" });
        // }).catch((error) => {
        //   console.error("Error recreating sessions:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error recreating sessions",
        //   });
        // })
        // addStabilityToProblems().then(() => {
        //   sendResponse({ message: "Stability added to problems" });
        // }).catch((error) => {
        //   console.error("Error adding stability to problems:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error adding stability to problems",
        //   });
        // })
        SessionService.getOrCreateSession()
          .then((session) => {
            console.log("session", session);
            sendResponse({
              backgroundScriptData: "Schedule received from content script",
              session: session,
            });
          })
          .catch((error) => {
            console.error("Error retrieving problems from Schedule:", error);
            sendResponse({
              backgroundScriptData:
                "There was an error retrieving problems from Schedule",
            });
          })
          .finally(finishRequest);
        return true;

      /** ──────────────── Limits & Problem Tracking ──────────────── **/
      // TODO: getLimits
      case "getLimits":
        console.log("✅ Getting limits for problem", request.id);
        LimitService.getLimits(request.id)
          .then((limits) => sendResponse({ limits }))
          .catch(() => sendResponse({ error: "Failed to get limits" }))
          .finally(finishRequest);
        return true;

      /** ──────────────── Navigation Management ──────────────── **/
      // TODO: navigate
      case "navigate":
        NavigationService.navigate(request.route, request.time)
          .then(() => sendResponse({ result: "success" }))
          .catch(() => sendResponse({ result: "error" }))
          .finally(finishRequest);
        return true;

      default:
        sendResponse({ error: "Unknown request type" });
        finishRequest();
        return false;
    }
  } catch (error) {
    sendResponse({ error: "Failed to handle request" });
    finishRequest();
  }
};

const contentPorts = {};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "content-script") {
    console.log(`🔌 Connected: Tab ${port.sender.tab.id}`);
    contentPorts[port.sender.tab.id] = port;

    port.onDisconnect.addListener(() => {
      console.log(`❌ Disconnected: Tab ${port.sender.tab.id}`);
      delete contentPorts[port.sender.tab.id];
    });
  }
});
chrome.action.onClicked.addListener((tab) => {
  // Open your React application in a new tab
  chrome.tabs.create({ url: "app.html" });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received request:", request);

  if (request.action === "forceReload") {
    console.log("♻️ Force Reload Triggered...");

    // Reload popup & app
    chrome.runtime.reload();

    // Reinject content script into leetcode tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.url && tab.url.includes("leetcode.com")) {
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              files: ["content.js"],
            },
            () => {
              console.log(`📥 Reinjected content script into ${tab.url}`);
            }
          );
        }
      });
    });

    return true;
  }

  requestQueue.push({ request, sender, sendResponse });
  if (!isProcessing) processNextRequest();

  return true; // Keep response channel open
});

