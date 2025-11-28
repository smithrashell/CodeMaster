/**
 * Message Router Module
 *
 * Extracted from background/index.js to improve maintainability
 * Handles all Chrome message routing for the extension
 */

import { NavigationService } from "../shared/services/navigationService.js";
import { adaptiveLimitsService } from "../shared/services/adaptiveLimitsService.js";
import { InterviewService } from "../shared/services/interviewService.js";

import { sessionHandlers } from "./handlers/sessionHandlers.js";
import { problemHandlers } from "./handlers/problemHandlers.js";
import { onboardingHandlers } from "./handlers/onboardingHandlers.js";
import { dashboardHandlers } from "./handlers/dashboardHandlers.js";
import { strategyHandlers } from "./handlers/strategyHandlers.js";
import { storageHandlers } from "./handlers/storageHandlers.js";
import { hintHandlers } from "./handlers/hintHandlers.js";

/**
 * Main message routing function
 * @param {Object} request - The incoming message request
 * @param {Function} sendResponse - Callback to send response
 * @param {Function} finishRequest - Cleanup callback to mark request as complete
 * @param {Object} dependencies - Dependencies from background script
 * @returns {boolean} - True if response will be sent asynchronously
 */
// eslint-disable-next-line max-lines-per-function, complexity
export function routeMessage(request, sendResponse, finishRequest, dependencies = {}) {
  const {
    backgroundScriptHealth,
    getStrategyMapData,
  } = dependencies;

  const handlerRegistry = {
    ...sessionHandlers,
    ...problemHandlers,
    ...onboardingHandlers,
    ...dashboardHandlers,
    ...strategyHandlers,
    ...storageHandlers,
    ...hintHandlers,
  };

  const handler = handlerRegistry[request.type];
  if (handler) {
    return handler(request, dependencies, sendResponse, finishRequest);
  }

  switch (request.type) {
    case "getInterviewReadiness":
      console.log("Assessing interview readiness");
      InterviewService.assessInterviewReadiness()
        .then((readiness) => {
          console.log("Interview readiness assessed:", readiness);
          sendResponse(readiness);
        })
        .catch((error) => {
          console.error("Failed to assess interview readiness:", error);
          sendResponse({
            interviewLikeUnlocked: true,
            fullInterviewUnlocked: true,
            reasoning: "Fallback mode - all modes available",
            metrics: { accuracy: 0, masteredTagsCount: 0, totalTags: 0, transferReadinessScore: 0 }
          });
        })
        .finally(finishRequest);
      return true;

    case "getLimits":
      console.log("Getting adaptive limits for problem", request.id);
      adaptiveLimitsService
        .getLimits(request.id)
        .then((limitsConfig) => {
          if (!limitsConfig) {
            console.error("AdaptiveLimitsService returned null/undefined");
            sendResponse({ error: "Service returned no data" });
            return;
          }

          const limits = {
            limit: limitsConfig.difficulty,
            Time: limitsConfig.recommendedTime,
            adaptiveLimits: limitsConfig,
          };

          sendResponse({ limits });
        })
        .catch((error) => {
          console.error("Error getting adaptive limits:", error, error.stack);
          sendResponse({ error: "Failed to get limits: " + error.message });
        })
        .finally(finishRequest);
      return true;

    case "navigate":
      NavigationService.navigate(request.route, request.time)
        .then(() => sendResponse({ result: "success" }))
        .catch(() => sendResponse({ result: "error" }))
        .finally(finishRequest);
      return true;

    case "backgroundScriptHealth": {
      const healthReport = backgroundScriptHealth.getHealthReport();
      console.log("Background script health check:", healthReport);
      sendResponse({ status: "success", data: healthReport });
      finishRequest();
      return true;
    }

    case "TEST_FUNCTIONS_AVAILABLE": {
      console.log("Checking test function availability...");
      const testFunctionStatus = {
        testSimple: typeof globalThis.testSimple,
        testAsync: typeof globalThis.testAsync,
        runTestsSilent: typeof globalThis.runTestsSilent,
        quickHealthCheck: typeof globalThis.quickHealthCheck,
        backgroundScriptLoaded: true,
        timestamp: Date.now()
      };
      console.log("Test function status:", testFunctionStatus);
      sendResponse({ status: "success", data: testFunctionStatus });
      finishRequest();
      return true;
    }

    case "RUN_SIMPLE_TEST":
      console.log("Running simple test...");
      try {
        const result = globalThis.testSimple();
        console.log("Simple test result:", result);
        sendResponse({ status: "success", data: result });
      } catch (error) {
        console.error("Simple test failed:", error);
        sendResponse({ status: "error", error: error.message });
      }
      finishRequest();
      return true;

    case "emergencyReset":
      console.warn("Emergency reset requested from content script");
      backgroundScriptHealth.emergencyReset();
      sendResponse({ status: "success", message: "Emergency reset completed" });
      finishRequest();
      return true;

    case "getStrategyMapData":
      console.log("Getting Strategy Map data...");
      getStrategyMapData()
        .then((data) => sendResponse({ status: "success", data }))
        .catch((error) => {
          console.error("Strategy Map error:", error);
          sendResponse({ status: "error", error: error.message });
        })
        .finally(finishRequest);
      return true;

    default:
      sendResponse({ error: "Unknown request type" });
      finishRequest();
      return false;
  }
}
