/**
 * Hint Interaction Message Handlers
 * Extracted from messageRouter.js
 */

import { HintInteractionService } from "../../shared/services/hints/hintInteractionService.js";
import { getProblem } from "../../shared/db/stores/problems.js";

export const hintHandlers = {
  saveHintInteraction: (request, _dependencies, sendResponse, finishRequest) => {
    console.log("Saving hint interaction from content script", {
      hasData: !!request.data,
      hasInteractionData: !!request.interactionData,
      problemIdFromData: request.data?.problemId,
      problemIdFromInteractionData: request.interactionData?.problemId
    });

    (async () => {
      const interactionData = request.interactionData || request.data;
      let enrichedData = { ...interactionData };

      if (interactionData.problemId) {
        try {
          const problem = await getProblem(interactionData.problemId);
          if (problem) {
            enrichedData.boxLevel = problem.box || 1;
            enrichedData.problemDifficulty = problem.difficulty || "Medium";
            console.log("Enriched hint interaction with problem context:", {
              problemId: problem.id,
              boxLevel: enrichedData.boxLevel,
              difficulty: enrichedData.problemDifficulty
            });
          }
        } catch (error) {
          console.warn("Could not enrich with problem context:", error);
        }
      }

      return HintInteractionService.saveHintInteraction(enrichedData, request.sessionContext || {});
    })()
      .then((interaction) => sendResponse({ interaction }))
      .catch((error) => {
        console.error("Background script failed to save hint interaction:", error);
        sendResponse({ error: error.message });
      })
      .finally(finishRequest);
    return true;
  },

  getInteractionsByProblem: (request, _dependencies, sendResponse, finishRequest) => {
    HintInteractionService.getInteractionsByProblem(request.problemId)
      .then((interactions) => sendResponse({ interactions }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getInteractionsBySession: (request, _dependencies, sendResponse, finishRequest) => {
    HintInteractionService.getInteractionsBySession(request.sessionId)
      .then((interactions) => sendResponse({ interactions }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  },

  getInteractionStats: (request, _dependencies, sendResponse, finishRequest) => {
    HintInteractionService.getInteractionStats(request.filters || {})
      .then((stats) => sendResponse({ stats }))
      .catch((error) => sendResponse({ error: error.message }))
      .finally(finishRequest);
    return true;
  }
};
