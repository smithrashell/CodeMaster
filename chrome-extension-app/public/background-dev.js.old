// DEVELOPMENT BACKGROUND SCRIPT - Full functionality + Test features
console.log('🚀 SERVICE WORKER: Development background script starting...');

// Extension state control
let EXTENSION_READY = true;  // Always ready in development mode
let TESTS_READY = false;

// Import core services
import { StorageService } from "../src/shared/services/storageService.js";
import { ProblemService } from "../src/shared/services/problemService.js";
import { SessionService } from "../src/shared/services/sessionService.js";
import { AttemptsService } from "../src/shared/services/attemptsService.js";
import { updateSessionInDB, evaluateDifficultyProgression, applyEscapeHatchLogic } from "../src/shared/db/sessions.js";
import { adaptiveLimitsService } from "../src/shared/services/adaptiveLimitsService.js";
import { NavigationService } from "../src/shared/services/navigationService.js";
import { TagService } from "../src/shared/services/tagServices.js";
import { HintInteractionService } from "../src/shared/services/hintInteractionService.js";
import { AlertingService } from "../src/shared/services/AlertingService.js";
import { ChromeAPIErrorHandler } from "../src/shared/services/ChromeAPIErrorHandler.js";
import { backupIndexedDB, getBackupFile } from "../src/shared/db/backupDB.js";
import { createScenarioTestDb, createDbHelper } from "../src/shared/db/dbHelperFactory.js";
import { insertStandardProblems } from "../src/shared/db/standard_problems.js";
import { insertStrategyData } from "../src/shared/db/strategy_data.js";
import { buildTagRelationships } from "../src/shared/db/tag_relationships.js";
import { buildProblemRelationships } from "../src/shared/services/relationshipService.js";
import { initializePatternLaddersForOnboarding } from "../src/shared/services/problemladderService.js";
import {
  onboardUserIfNeeded,
  checkOnboardingStatus,
  completeOnboarding,
  checkContentOnboardingStatus,
  updateContentOnboardingStep,
  completeContentOnboarding,
  checkPageTourStatus,
  markPageTourCompleted,
  resetPageTour
} from "../src/shared/services/onboardingService.js";
import { getStrategyForTag } from "../src/shared/db/strategy_data.js";
import { getProblem, getProblemWithOfficialDifficulty } from "../src/shared/db/problems.js";
import {
  getDashboardStatistics,
  getFocusAreaAnalytics,
  getLearningProgressData,
  getGoalsData,
  getStatsData,
  getSessionHistoryData,
  getProductivityInsightsData,
  getTagMasteryData,
  getLearningPathData,
  getMistakeAnalysisData,
  clearFocusAreaAnalyticsCache,
  getInterviewAnalyticsData,
  getSessionMetrics
} from "../src/app/services/dashboardService.js";
import FocusCoordinationService from "../src/shared/services/focusCoordinationService.js";
import AccurateTimer from "../src/shared/utils/AccurateTimer.js";
import { InterviewService } from "../src/shared/services/interviewService.js";

// Mark this as background script context for database access
if (typeof globalThis !== 'undefined') {
  globalThis.IS_BACKGROUND_SCRIPT_CONTEXT = true;
}

// Service Worker Lifecycle Management for Manifest V3
self.addEventListener('install', (event) => {
  console.log('🔧 SERVICE WORKER: Installing development background script...');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('🔧 SERVICE WORKER: Activated development background script...');
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('✅ SERVICE WORKER: All clients claimed, service worker active');
    })
  );
});

// Track background script startup time for health monitoring
global.backgroundStartTime = Date.now();

// Service initialization with global access
globalThis.StorageService = StorageService;
globalThis.ProblemService = ProblemService;
globalThis.SessionService = SessionService;
globalThis.AttemptsService = AttemptsService;
globalThis.TagService = TagService;
globalThis.HintInteractionService = HintInteractionService;
globalThis.AlertingService = AlertingService;
globalThis.FocusCoordinationService = FocusCoordinationService;
globalThis.InterviewService = InterviewService;

console.log('✅ SERVICE WORKER: Development services initialized');

// Chrome Message Handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 SERVICE WORKER: Message received:', request.type);

  const finishRequest = () => {
    console.log(`✅ SERVICE WORKER: Completed ${request.type}`);
  };

  try {
    switch (request.type) {
      // Dashboard Data Handlers
      case "getStatsData":
        getStatsData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getLearningProgressData":
        getLearningProgressData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getGoalsData":
        (async () => {
          try {
            const focusDecision = await globalThis.FocusCoordinationService.getFocusDecision("session_state");
            const settings = await StorageService.getSettings();

            const providedData = {
              focusAreas: focusDecision?.focusAreas || [],
              adaptiveSettings: settings?.adaptiveSettings || {},
              learningPlan: settings?.learningPlan || {}
            };

            const result = await getGoalsData(request.options || {}, providedData);
            sendResponse({ result });
          } catch (error) {
            sendResponse({ error: error.message });
          } finally {
            finishRequest();
          }
        })();
        return true;

      case "getSessionHistoryData":
        getSessionHistoryData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getProductivityInsightsData":
        getProductivityInsightsData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getTagMasteryData":
        getTagMasteryData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getLearningPathData":
        getLearningPathData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getMistakeAnalysisData":
        getMistakeAnalysisData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getInterviewAnalyticsData":
        getInterviewAnalyticsData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getSessionMetrics":
        getSessionMetrics(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getDashboardStatistics":
        getDashboardStatistics(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getFocusAreaAnalytics":
        getFocusAreaAnalytics(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      // Session Management
      case "getOrCreateSession":
        (async () => {
          const startTime = Date.now();

          if (!request.sessionType) {
            try {
              const bannerResult = await globalThis.InterviewService.shouldShowInterviewBanner();
              if (bannerResult.shouldShow) {
                console.log("📋 Interview banner should be shown, not auto-creating session");
                sendResponse({
                  showInterviewBanner: true,
                  bannerData: bannerResult.bannerData,
                  session: null
                });
                finishRequest();
                return;
              }
            } catch (error) {
              console.warn("⚠️ Interview banner check failed, proceeding with session creation:", error.message);
            }
          }

          try {
            const session = await globalThis.SessionService.getOrCreateSession(request.sessionType || 'standard', request.forceNew || false);
            const duration = Date.now() - startTime;
            console.log(`✅ Session created in ${duration}ms`);
            sendResponse({ session });
          } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ Session creation failed after ${duration}ms:`, error);
            sendResponse({ error: error.message });
          } finally {
            finishRequest();
          }
        })();
        return true;

      case "refreshSession":
        (async () => {
          console.log("🔄 Refreshing session:", request.sessionType || 'standard');
          const refreshStartTime = Date.now();

          try {
            const session = await globalThis.SessionService.refreshSession(request.sessionType || 'standard', true);
            const duration = Date.now() - refreshStartTime;
            console.log(`✅ Session refreshed in ${duration}ms`);
            sendResponse({ session });
          } catch (error) {
            const duration = Date.now() - refreshStartTime;
            console.error(`❌ Session refresh failed after ${duration}ms:`, error);
            sendResponse({ error: error.message });
          } finally {
            finishRequest();
          }
        })();
        return true;

      // Settings Management
      case "getSettings":
        StorageService.getSettings()
          .then((settings) => sendResponse({ settings }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "updateSettings":
        StorageService.updateSettings(request.settings)
          .then((result) => {
            if (chrome.storage?.local) {
              chrome.storage.local.set({ settings: request.settings });
            }
            sendResponse(result);
          })
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      // Onboarding
      case "checkInstallationOnboardingStatus":
        checkOnboardingStatus()
          .then((status) => sendResponse({ status }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "completeOnboarding":
        completeOnboarding()
          .then(() => sendResponse({ success: true }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      // Additional handlers for missing message types
      case "checkOnboardingStatus":
        checkOnboardingStatus()
          .then((status) => sendResponse({ status }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getFocusAreasData":
        (async () => {
          try {
            const focusDecision = await globalThis.FocusCoordinationService.getFocusDecision("session_state");
            const result = {
              focusAreas: focusDecision?.focusAreas || [],
              currentFocus: focusDecision?.currentFocus || null,
              lastUpdated: focusDecision?.lastUpdated || Date.now()
            };
            sendResponse({ result });
          } catch (error) {
            sendResponse({ error: error.message });
          } finally {
            finishRequest();
          }
        })();
        return true;

      case "isStrategyDataLoaded":
        (async () => {
          try {
            // Check if strategy data exists in the database
            const db = await createDbHelper();
            const transaction = db.transaction(['standard_problems'], 'readonly');
            const store = transaction.objectStore('standard_problems');
            const count = await new Promise((resolve, reject) => {
              const countRequest = store.count();
              countRequest.onsuccess = () => resolve(countRequest.result);
              countRequest.onerror = () => reject(countRequest.error);
            });

            const isLoaded = count > 0;
            sendResponse({ isLoaded });
          } catch (error) {
            console.warn("Strategy data check failed:", error);
            sendResponse({ isLoaded: false });
          } finally {
            finishRequest();
          }
        })();
        return true;

      case "onboardingUserIfNeeded":
        (async () => {
          try {
            const status = await checkOnboardingStatus();
            if (status.needsOnboarding) {
              // Trigger onboarding flow
              sendResponse({
                needsOnboarding: true,
                onboardingType: status.onboardingType,
                status
              });
            } else {
              sendResponse({ needsOnboarding: false, status });
            }
          } catch (error) {
            sendResponse({ error: error.message });
          } finally {
            finishRequest();
          }
        })();
        return true;

      // Test Functions (Development Only)
      case "runDevelopmentTests":
        console.log("🧪 Running development tests...");
        sendResponse({ message: "Development tests available in dev mode", testsReady: TESTS_READY });
        finishRequest();
        return true;

      case "seedTestDatabase":
        console.log("🌱 Seeding test database...");
        (async () => {
          try {
            const db = await createDbHelper();
            await insertStandardProblems(db);
            await insertStrategyData();
            await buildTagRelationships();
            await buildProblemRelationships();
            await initializePatternLaddersForOnboarding();

            TESTS_READY = true;
            console.log("✅ Test database seeded successfully");
            sendResponse({ success: true, message: "Test database seeded" });
          } catch (error) {
            console.error("❌ Test database seeding failed:", error);
            sendResponse({ success: false, error: error.message });
          } finally {
            finishRequest();
          }
        })();
        return true;

      case "checkContentOnboardingStatus":
        checkContentOnboardingStatus()
          .then((status) => sendResponse({ status }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "updateContentOnboardingStep":
        updateContentOnboardingStep(request.step)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "completeContentOnboarding":
        completeContentOnboarding()
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "checkPageTourStatus":
        checkPageTourStatus(request.pageId)
          .then((status) => sendResponse(status))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "markPageTourCompleted":
        markPageTourCompleted(request.pageId)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "resetPageTour":
        resetPageTour(request.pageId)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      // Cache Management
      case "clearSettingsCache":
        StorageService.clearSettingsCache();
        sendResponse({ status: "success" });
        finishRequest();
        return true;

      case "clearSessionCache":
        globalThis.SessionService.clearCache?.();
        sendResponse({ status: "success" });
        finishRequest();
        return true;

      case "clearFocusAreaAnalyticsCache":
        clearFocusAreaAnalyticsCache();
        sendResponse({ status: "success" });
        finishRequest();
        return true;

      // Storage Handlers
      case "setStorage":
        StorageService.set(request.key, request.value)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getStorage":
        StorageService.get(request.key)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "removeStorage":
        StorageService.remove(request.key)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "setSettings":
        StorageService.setSettings(request.message || request.settings)
          .then((result) => {
            if (chrome.storage?.local) {
              chrome.storage.local.set({ settings: request.message || request.settings });
            }
            sendResponse(result);
          })
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getSessionState":
        StorageService.getSessionState("session_state")
          .then((state) => sendResponse(state))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      // Problem Management
      case "getProblemByDescription":
        globalThis.ProblemService.getProblemByDescription(request.description, request.slug)
          .then((problem) => sendResponse(problem))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getProblemById":
        getProblemWithOfficialDifficulty(request.problemId)
          .then((problem) => sendResponse({ success: true, data: problem }))
          .catch((error) => sendResponse({ success: false, error: error.message }))
          .finally(finishRequest);
        return true;

      case "addProblem":
        globalThis.ProblemService.addOrUpdateProblemWithRetry(request.contentScriptData)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "problemSubmitted":
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.url?.startsWith('http://') || tab.url?.startsWith('https://')) {
              chrome.tabs.sendMessage(tab.id, { type: "problemSubmitted" }, () => {
                if (chrome.runtime.lastError) {
                  console.log(`Tab ${tab.id} no content script`);
                }
              });
            }
          });
        });
        sendResponse({ status: "success" });
        finishRequest();
        return true;

      case "skipProblem":
        sendResponse({ message: "Problem skipped successfully" });
        finishRequest();
        return true;

      case "getAllProblems":
        globalThis.ProblemService.getAllProblems()
          .then((problems) => sendResponse(problems))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getProblemAttemptStats":
        globalThis.AttemptsService.getProblemAttemptStats(request.problemId)
          .then((stats) => sendResponse({ success: true, data: stats }))
          .catch((error) => sendResponse({ success: false, error: error.message }))
          .finally(finishRequest);
        return true;

      case "countProblemsByBoxLevel":
        globalThis.ProblemService.countProblemsByBoxLevel()
          .then((counts) => sendResponse({ status: "success", data: counts }))
          .catch((error) => sendResponse({ status: "error", error: error.message }))
          .finally(finishRequest);
        return true;

      // Session Management - Additional
      case "getSession":
        globalThis.SessionService.getSession()
          .then((session) => sendResponse({ session }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getCurrentSession":
        StorageService.getSettings()
          .then(async (settings) => {
            let sessionType = 'standard';
            if (settings?.interviewMode && settings.interviewMode !== "disabled") {
              sessionType = settings.interviewMode;
            }
            return globalThis.SessionService.getOrCreateSession(sessionType);
          })
          .then((session) => sendResponse({ session }))
          .catch((error) => sendResponse({ error: error.message, session: [] }))
          .finally(finishRequest);
        return true;

      case "manualSessionCleanup":
        globalThis.SessionService.cleanupStalledSessions?.()
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getSessionAnalytics":
        (async () => {
          try {
            const stalledSessions = await globalThis.SessionService.detectStalledSessions?.() || [];
            const cleanupAnalytics = await new Promise(resolve => {
              chrome.storage.local.get(["sessionCleanupAnalytics"], (result) => {
                resolve(result.sessionCleanupAnalytics || []);
              });
            });
            sendResponse({
              stalledSessions: stalledSessions.length,
              recentCleanups: cleanupAnalytics.slice(-5)
            });
          } catch (error) {
            sendResponse({ error: error.message });
          }
        })().finally(finishRequest);
        return true;

      case "classifyAllSessions":
        (async () => {
          try {
            const sessions = await globalThis.SessionService.getAllSessionsFromDB?.() || [];
            const classifications = sessions.map(session => ({
              id: session.id?.substring(0, 8),
              status: session.status,
              classification: globalThis.SessionService.classifySessionState?.(session)
            }));
            sendResponse({ classifications });
          } catch (error) {
            sendResponse({ error: error.message });
          }
        })().finally(finishRequest);
        return true;

      // Strategy Management
      case "getStrategyForTag":
        getStrategyForTag(request.tag)
          .then((strategy) => sendResponse(strategy))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getStrategyMapData":
        (async () => {
          try {
            const currentTierData = await globalThis.TagService.getCurrentTier?.() || {};
            sendResponse({
              currentTier: currentTierData.classification || "Core Concept",
              focusTags: currentTierData.focusTags || []
            });
          } catch (error) {
            sendResponse({ error: error.message });
          }
        })().finally(finishRequest);
        return true;

      // Navigation
      case "navigate":
        globalThis.NavigationService.navigate?.(request.url)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      // Health & Debug
      case "backgroundScriptHealth":
        sendResponse({
          status: "healthy",
          ready: EXTENSION_READY,
          uptime: Date.now() - (global.backgroundStartTime || Date.now())
        });
        finishRequest();
        return true;

      case "emergencyReset":
        console.log("🚨 Emergency reset triggered");
        sendResponse({ status: "reset_acknowledged" });
        finishRequest();
        return true;

      // Backup
      case "backupIndexedDB":
        backupIndexedDB()
          .then(() => sendResponse({ message: "Backup successful" }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getBackupFile":
        getBackupFile()
          .then((backup) => sendResponse({ backup }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      // Interview Mode
      case "checkInterviewFrequency":
        (async () => {
          try {
            const shouldTrigger = await globalThis.InterviewService.checkInterviewFrequency?.() || false;
            sendResponse({ shouldTrigger });
          } catch (error) {
            sendResponse({ shouldTrigger: false, error: error.message });
          }
        })().finally(finishRequest);
        return true;

      case "getInterviewReadiness":
        globalThis.InterviewService.getInterviewReadiness?.()
          .then((readiness) => sendResponse(readiness))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getInterviewAnalytics":
        globalThis.InterviewService.getInterviewAnalytics?.()
          .then((analytics) => sendResponse(analytics))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "completeInterviewSession":
        globalThis.InterviewService.completeInterviewSession?.(request.sessionId)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      // Hint Interactions
      case "saveHintInteraction":
        globalThis.HintInteractionService.saveHintInteraction?.(request.interaction)
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getInteractionStats":
        globalThis.HintInteractionService.getInteractionStats?.()
          .then((stats) => sendResponse(stats))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getInteractionsByProblem":
        globalThis.HintInteractionService.getInteractionsByProblem?.(request.problemId)
          .then((interactions) => sendResponse(interactions))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getInteractionsBySession":
        globalThis.HintInteractionService.getInteractionsBySession?.(request.sessionId)
          .then((interactions) => sendResponse(interactions))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      default:
        console.log(`⚠️ Unknown message type: ${request.type}`);
        sendResponse({ error: `Unknown message type: ${request.type}` });
        finishRequest();
        return true;
    }
  } catch (error) {
    console.error(`❌ Error handling ${request.type}:`, error);
    sendResponse({ error: error.message });
    finishRequest();
  }
});

// Chrome Action Click Handler (App Menu Button)
chrome.action.onClicked.addListener(async (tab) => {
  console.log("🖱️ Extension button clicked");

  if (!EXTENSION_READY) {
    console.log("⚠️ Extension not ready, blocking dashboard access");
    return;
  }

  try {
    // Check for existing dashboard tabs first
    const existingTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("app.html") });

    if (existingTabs.length > 0) {
      // Focus the existing dashboard tab instead of creating a new one
      const existingTab = existingTabs[0];
      await chrome.tabs.update(existingTab.id, { active: true });
      await chrome.windows.update(existingTab.windowId, { focused: true });
      console.log("📱 Focused existing dashboard tab:", existingTab.id);
    } else {
      // No existing dashboard tab found, create a new one
      await chrome.tabs.create({ url: "app.html" });
      console.log("📱 Created new dashboard tab");
    }
  } catch (error) {
    console.error("❌ Error handling dashboard tab:", error);
  }
});

// Extension Installation/Update Handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🚀 SERVICE WORKER: Extension installed/updated:', details.reason);

  // Initialize extension immediately in development
  EXTENSION_READY = true;
  console.log("✅ Development mode - extension ready immediately");

  if (details.reason === 'install') {
    console.log("🎉 First-time install - opening dashboard");
    chrome.tabs.create({ url: "app.html" });
  } else if (details.reason === 'update') {
    console.log("⬆️ Extension updated - opening dashboard");
    chrome.tabs.create({ url: "app.html" });
  }
});

// Extension Startup Handler
chrome.runtime.onStartup.addListener(() => {
  console.log("🚀 Development background script startup");
  EXTENSION_READY = true;
  console.log("✅ Development mode - extension ready on startup");
});

console.log('✅ SERVICE WORKER: Development background script fully initialized');