/**
 * Storage and Settings Message Handlers
 * Extracted from messageRouter.js
 */

import { StorageService } from "../../shared/services/storage/storageService.js";
import { backupIndexedDB, getBackupFile } from "../../shared/db/migrations/backupDB.js";
import { getWelcomeBackStrategy, createDiagnosticSession, processDiagnosticResults, createAdaptiveRecalibrationSession, processAdaptiveSessionCompletion } from "../../shared/services/schedule/recalibrationService.js";

export const storageHandlers = {
  backupIndexedDB: (_request, _dependencies, sendResponse, _finishRequest) => {
    console.log("Starting backup process...");
    backupIndexedDB()
      .then(() => {
        console.log("Backup completed.");
        sendResponse({ message: "Backup successful" });
      })
      .catch((error) => {
        console.error("Backup error:", error);
        sendResponse({ error: error.message });
      });
    return true;
  },

  getBackupFile: (_request, _dependencies, sendResponse, _finishRequest) => {
    console.log("Retrieving backup file...");
    getBackupFile()
      .then((backup) => {
        console.log("Backup file retrieved.");
        sendResponse({ backup });
      })
      .catch((error) => {
        console.error("Error getting backup file:", error);
        sendResponse({ error: error.message });
      });
    return true;
  },

  setStorage: (request, _dependencies, sendResponse, finishRequest) => {
    StorageService.set(request.key, request.value)
      .then(sendResponse)
      .finally(finishRequest);
    return true;
  },

  getStorage: (request, _dependencies, sendResponse, finishRequest) => {
    StorageService.get(request.key)
      .then(sendResponse)
      .finally(finishRequest);
    return true;
  },

  removeStorage: (request, _dependencies, sendResponse, finishRequest) => {
    StorageService.remove(request.key)
      .then(sendResponse)
      .finally(finishRequest);
    return true;
  },

  setSettings: (request, _dependencies, sendResponse, finishRequest) => {
    StorageService.setSettings(request.message)
      .then((result) => {
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({
            settings: request.message
          }, () => {
            if (chrome.runtime.lastError) {
              console.warn("Failed to sync settings to Chrome storage:", chrome.runtime.lastError.message);
            }
          });
        }
        sendResponse(result);
      })
      .catch((error) => {
        console.error("Failed to save settings:", error);
        sendResponse({ status: "error", message: error.message });
      })
      .finally(finishRequest);
    return true;
  },

  getSettings: (_request, _dependencies, sendResponse, finishRequest) => {
    StorageService.getSettings().then(sendResponse).finally(finishRequest);
    return true;
  },

  getSessionState: (_request, _dependencies, sendResponse, finishRequest) => {
    StorageService.getSessionState("session_state")
      .then(sendResponse)
      .finally(finishRequest);
    return true;
  },

  getWelcomeBackStrategy: (_request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        const dismissed = await StorageService.get('welcome_back_dismissed');
        const today = new Date().toISOString().split('T')[0];

        if (dismissed && dismissed.timestamp && dismissed.timestamp.startsWith(today)) {
          console.log(`Welcome back modal dismissed today (${today}), skipping`);
          sendResponse({ type: 'normal' });
          finishRequest();
          return;
        }

        const daysSinceLastUse = await StorageService.getDaysSinceLastActivity();
        const strategy = getWelcomeBackStrategy(daysSinceLastUse);
        sendResponse(strategy);
      } catch (error) {
        console.error("Error getting welcome back strategy:", error);
        sendResponse({ type: 'normal' });
      } finally {
        finishRequest();
      }
    })();
    return true;
  },

  dismissWelcomeBack: (request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        await StorageService.set('welcome_back_dismissed', {
          timestamp: request.timestamp,
          daysSinceLastUse: request.daysSinceLastUse
        });

        console.log(`Welcome back modal dismissed (${request.daysSinceLastUse} days gap)`);
        sendResponse({ status: 'success' });
      } catch (error) {
        console.error("Error dismissing welcome back modal:", error);
        sendResponse({ status: 'error', message: error.message });
      } finally {
        finishRequest();
      }
    })();
    return true;
  },

  recordRecalibrationChoice: (request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        await StorageService.set('last_recalibration_choice', {
          approach: request.approach,
          daysSinceLastUse: request.daysSinceLastUse,
          timestamp: new Date().toISOString()
        });

        console.log(`Recorded recalibration choice: ${request.approach} (${request.daysSinceLastUse} days gap)`);
        sendResponse({ status: 'success' });
      } catch (error) {
        console.error("Error recording recalibration choice:", error);
        sendResponse({ status: 'error', message: error.message });
      } finally {
        finishRequest();
      }
    })();
    return true;
  },

  createDiagnosticSession: (request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        const result = await createDiagnosticSession({
          problemCount: request.problemCount || 5,
          daysSinceLastUse: request.daysSinceLastUse || 0
        });

        await StorageService.set('pending_diagnostic_session', {
          problems: result.problems,
          metadata: result.metadata,
          createdAt: new Date().toISOString()
        });

        console.log(`Diagnostic session created with ${result.problems.length} problems`);
        sendResponse({
          status: 'success',
          problemCount: result.problems.length,
          metadata: result.metadata
        });
      } catch (error) {
        console.error("Error creating diagnostic session:", error);
        sendResponse({ status: 'error', message: error.message });
      } finally {
        finishRequest();
      }
    })();
    return true;
  },

  processDiagnosticResults: (request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        const result = await processDiagnosticResults({
          sessionId: request.sessionId,
          attempts: request.attempts
        });

        console.log(`Diagnostic results processed: ${result.summary.accuracy}% accuracy`);
        sendResponse({
          status: 'success',
          recalibrated: result.recalibrated,
          summary: result.summary
        });
      } catch (error) {
        console.error("Error processing diagnostic results:", error);
        sendResponse({ status: 'error', message: error.message });
      } finally {
        finishRequest();
      }
    })();
    return true;
  },

  createAdaptiveRecalibrationSession: (request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        const result = await createAdaptiveRecalibrationSession({
          daysSinceLastUse: request.daysSinceLastUse || 0
        });

        console.log(`Adaptive recalibration session enabled: ${result.message}`);
        sendResponse(result);
      } catch (error) {
        console.error("Error creating adaptive recalibration session:", error);
        sendResponse({ status: 'error', message: error.message });
      } finally {
        finishRequest();
      }
    })();
    return true;
  },

  processAdaptiveSessionCompletion: (request, _dependencies, sendResponse, finishRequest) => {
    (async () => {
      try {
        const result = await processAdaptiveSessionCompletion({
          sessionId: request.sessionId,
          accuracy: request.accuracy,
          totalProblems: request.totalProblems
        });

        console.log(`Adaptive session processed: ${result.action}`);
        sendResponse(result);
      } catch (error) {
        console.error("Error processing adaptive session completion:", error);
        sendResponse({ status: 'error', message: error.message });
      } finally {
        finishRequest();
      }
    })();
    return true;
  }
};
