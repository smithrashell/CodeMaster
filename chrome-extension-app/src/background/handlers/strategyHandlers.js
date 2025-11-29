/**
 * Strategy and Database Operation Handlers
 * Extracted from messageRouter.js
 */

import { getStrategyForTag, isStrategyDataLoaded } from "../../shared/db/strategy_data.js";
import { getAllFromStore, getRecord, addRecord, updateRecord, deleteRecord } from "../../shared/db/common.js";
import { buildRelationshipMap } from "../../shared/db/problem_relationships.js";
import { fetchAllProblems } from "../../shared/db/problems.js";
import { getAllStandardProblems } from "../../shared/db/standard_problems.js";
import { buildProblemRelationships } from "../../shared/services/relationshipService.js";

export const strategyHandlers = {
  getStrategyForTag: (request, _dependencies, sendResponse, finishRequest) => {
    console.log(`Getting strategy for tag "${request.tag}"`);
    (async () => {
      try {
        const strategy = await getStrategyForTag(request.tag);
        console.log(`Strategy result for "${request.tag}":`, strategy ? "FOUND" : "NOT FOUND");
        sendResponse({ status: "success", data: strategy });
      } catch (error) {
        console.error(`Strategy error for "${request.tag}":`, error);
        sendResponse({ status: "error", error: error.message });
      }
    })().finally(finishRequest);
    return true;
  },

  getStrategiesForTags: (request, _dependencies, sendResponse, finishRequest) => {
    console.log(`Getting strategies for tags:`, request.tags);
    (async () => {
      try {
        const strategies = {};
        await Promise.all(
          request.tags.map(async (tag) => {
            try {
              const strategy = await getStrategyForTag(tag);
              if (strategy) {
                strategies[tag] = strategy;
              }
            } catch (error) {
              console.error(`Error getting strategy for "${tag}":`, error);
            }
          })
        );

        console.log(`Bulk strategies result:`, Object.keys(strategies));
        sendResponse({ status: "success", data: strategies });
      } catch (error) {
        console.error(`Bulk strategies error:`, error);
        sendResponse({ status: "error", error: error.message });
      }
    })().finally(finishRequest);
    return true;
  },

  isStrategyDataLoaded: (_request, _dependencies, sendResponse, finishRequest) => {
    console.log(`Handling isStrategyDataLoaded request`);
    (async () => {
      try {
        const loaded = await isStrategyDataLoaded();
        console.log(`Strategy data loaded result:`, loaded);
        sendResponse({ status: "success", data: loaded });
      } catch (error) {
        console.error(`Strategy data check error:`, error);
        sendResponse({ status: "error", error: error.message });
      }
    })().finally(finishRequest);
    return true;
  },

  getSimilarProblems: (request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        console.log("getSimilarProblems: Starting similarity search...");

        const relationshipMap = await buildRelationshipMap();
        const _allUserProblems = await fetchAllProblems();
        const standardProblems = await getAllStandardProblems();

        const standardProblemsById = new Map();
        const slugToStandardProblem = new Map();
        const titleToStandardProblem = new Map();

        standardProblems.forEach(problem => {
          standardProblemsById.set(problem.id, problem);
          if (problem.slug) {
            slugToStandardProblem.set(problem.slug, problem);
          }
          if (problem.title) {
            titleToStandardProblem.set(problem.title, problem);
          }
        });

        const numericProblemId = Number(request.problemId);
        const relationships = relationshipMap.get(numericProblemId) || {};

        console.log(`getSimilarProblems: Processing problem ${numericProblemId}, found ${Object.keys(relationships).length} relationships`);

        const similarProblems = [];

        if (relationshipMap.size === 0) {
          console.warn("getSimilarProblems: Relationship map is empty");
          sendResponse({
            similarProblems: [],
            debug: { message: "Problem relationships not initialized", mapSize: 0 }
          });
          return;
        }

        const sortedRelationships = Object.entries(relationships)
          .sort(([, a], [, b]) => b - a)
          .slice(0, request.limit || 5);

        for (const [relatedNumericId, strength] of sortedRelationships) {
          const relatedId = Number(relatedNumericId);

          if (relatedId === numericProblemId) {
            continue;
          }

          const relatedStandardProblem = standardProblemsById.get(relatedId);

          if (relatedStandardProblem) {
            similarProblems.push({
              id: relatedStandardProblem.id,
              title: relatedStandardProblem.title,
              difficulty: relatedStandardProblem.difficulty,
              slug: relatedStandardProblem.slug,
              strength: strength
            });
          }
        }

        console.log("getSimilarProblems: Found", similarProblems.length, "similar problems");
        sendResponse({ similarProblems });
      } catch (error) {
        console.error("getSimilarProblems error:", error);
        sendResponse({ similarProblems: [] });
      }
    })().finally(finishRequest);
    return true;
  },

  rebuildProblemRelationships: (_request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        console.log("Starting problem relationships rebuild...");
        await buildProblemRelationships();
        console.log("Problem relationships rebuilt successfully");
        sendResponse({ success: true, message: "Problem relationships rebuilt successfully" });
      } catch (error) {
        console.error("Error rebuilding problem relationships:", error);
        sendResponse({ success: false, error: error.message });
      }
    })().finally(finishRequest);
    return true;
  },

  DATABASE_OPERATION: (request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        const { operation, params } = request;
        console.log(`DATABASE_OPERATION: ${operation} on ${params.storeName}`, params);

        let result;
        switch (operation) {
          case "getRecord":
            result = await getRecord(params.storeName, params.id);
            break;
          case "addRecord":
            result = await addRecord(params.storeName, params.record);
            break;
          case "updateRecord":
            console.log(`Updating record ${params.id} in ${params.storeName}:`, params.record);
            result = await updateRecord(params.storeName, params.id, params.record);
            console.log(`Update completed for ${params.id}:`, result);
            break;
          case "deleteRecord":
            result = await deleteRecord(params.storeName, params.id);
            break;
          case "getAllFromStore":
            result = await getAllFromStore(params.storeName);
            break;
          default:
            throw new Error(`Unknown database operation: ${operation}`);
        }

        console.log(`DATABASE_OPERATION result:`, result);
        sendResponse({ data: result });
      } catch (error) {
        console.error(`Database proxy error for ${request.operation}:`, error);
        sendResponse({ error: error.message });
      }
    })().finally(finishRequest);
    return true;
  }
};
