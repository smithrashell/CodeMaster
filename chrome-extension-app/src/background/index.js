// Message Router (extracted handlers)
import { routeMessage } from "./messageRouter.js";

// Core Services (used by background script directly, not just message handlers)
import { StorageService } from "../shared/services/storage/storageService.js";
import { ProblemService } from "../shared/services/problem/problemService.js";
import { SessionService } from "../shared/services/session/sessionService.js";
import { AttemptsService } from "../shared/services/attempts/attemptsService.js";
import { TagService } from "../shared/services/attempts/tagServices.js";
import { HintInteractionService } from "../shared/services/hints/hintInteractionService.js";
import { AlertingService } from "../shared/services/monitoring/AlertingService.js";
import { NavigationService } from "../shared/services/chrome/navigationService.js";
import FocusCoordinationService from "../shared/services/focus/focusCoordinationService.js";
import AccurateTimer from "../shared/utils/timing/AccurateTimer.js";
import ChromeAPIErrorHandler from "../shared/services/chrome/ChromeAPIErrorHandler.js";
import { checkAndApplyDecay } from "../shared/services/schedule/recalibrationService.js";

// Onboarding (only functions passed as dependencies to messageRouter)
import { checkOnboardingStatus, completeOnboarding } from "../shared/services/focus/onboardingService.js";

// Background helpers
import {
  withTimeout,
  cleanupStalledSessions,
  getStrategyMapData,
  initializeConsistencySystem,
  setupDevTestFunctions,
} from "./backgroundHelpers.js";

// Hot reload
import { connect } from "chrome-extension-hot-reload";
connect();

// Mark this as background script context for database access
if (typeof globalThis !== 'undefined') {
  globalThis.IS_BACKGROUND_SCRIPT_CONTEXT = true;
}

// Service Worker Lifecycle Management for Manifest V3
self.addEventListener('install', (event) => {
  console.log('🔧 SERVICE WORKER: Installing background script...');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('🔧 SERVICE WORKER: Activated background script...');
  event.waitUntil(
    self.clients.claim().then(async () => {
      console.log('✅ SERVICE WORKER: All clients claimed, service worker active');

      try {
        console.log('🔄 Checking if passive decay needed...');
        const decayResult = await checkAndApplyDecay();

        if (decayResult.decayApplied) {
          console.log(`✅ Passive decay applied: ${decayResult.problemsAffected} problems affected`);
        } else {
          console.log(`✅ No decay needed (${decayResult.daysSinceLastUse} days since last use)`);
        }
      } catch (error) {
        console.error('❌ Passive decay check failed:', error);
      }
    })
  );
});

global.backgroundStartTime = Date.now();
console.log('🚀 SERVICE WORKER: Background script loaded and ready for messages');

// Setup development test functions
setupDevTestFunctions({
  ProblemService,
  SessionService,
  AttemptsService,
  TagService,
  HintInteractionService,
  AlertingService,
  NavigationService,
  AccurateTimer,
  ChromeAPIErrorHandler,
  FocusCoordinationService,
});

// Force service worker to stay active with PING handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    console.log('🏓 SERVICE WORKER: PING received, sending PONG');
    sendResponse({ status: 'PONG', timestamp: Date.now() });
    return true;
  }
});

console.log('🏓 SERVICE WORKER: PING handler registered');

let activeRequests = {};
let requestQueue = [];
let isProcessing = false;

// Background script health monitoring
const backgroundScriptHealth = {
  startTime: Date.now(),
  requestCount: 0,
  timeoutCount: 0,

  recordRequest() {
    this.requestCount++;
  },

  recordTimeout(duration) {
    this.timeoutCount++;
    console.warn(`⏰ Request timeout recorded: ${duration}ms (total timeouts: ${this.timeoutCount})`);
  },

  getHealthReport() {
    return {
      uptime: Date.now() - this.startTime,
      requestCount: this.requestCount,
      timeoutCount: this.timeoutCount,
      activeRequests: Object.keys(activeRequests).length,
      queueLength: requestQueue.length,
      isProcessing
    };
  }
};

const processNextRequest = () => {
  if (requestQueue.length === 0) {
    isProcessing = false;
    return;
  }
  isProcessing = true;
  const { request, sender, sendResponse } = requestQueue.shift();
  handleRequest(request, sender, sendResponse).finally(() => {
    processNextRequest();
  });
};

const handleRequest = async (request, sender, sendResponse) => {
  backgroundScriptHealth.recordRequest();
  const requestStartTime = Date.now();

  let requestId = `${request.type}-${sender.tab?.id || "background"}`;
  if (request.type === "getStrategyForTag" && request.tag) {
    requestId = `${request.type}-${request.tag}-${sender.tab?.id || "background"}`;
  }

  if (activeRequests[requestId]) return;
  activeRequests[requestId] = true;

  const finishRequest = () => {
    delete activeRequests[requestId];
    const duration = Date.now() - requestStartTime;

    if (duration > 10000) {
      backgroundScriptHealth.recordTimeout(duration);
      console.warn(`⏰ Slow request detected: ${request.type} took ${duration}ms`);
    }

    processNextRequest();
  };

  try {
    return await routeMessage(request, sendResponse, finishRequest, {
      backgroundScriptHealth,
      withTimeout,
      cleanupStalledSessions,
      getStrategyMapData,
      checkOnboardingStatus,
      completeOnboarding
    });

  } catch (error) {
    sendResponse({ error: "Failed to handle request" });
    finishRequest();
  }
};

chrome.action.onClicked.addListener(async (_tab) => {
  try {
    const onboardingStatus = await StorageService.get('installation_onboarding_complete');
    const isOnboardingComplete = onboardingStatus === true || (onboardingStatus && onboardingStatus.completed === true);

    if (!isOnboardingComplete) {
      console.log("⏳ Dashboard not ready yet - showing setup notification");

      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'CodeMaster Setup',
          message: 'CodeMaster is still setting up your database. Please wait a moment and try again.',
          priority: 1
        });
      } catch (notificationError) {
        console.warn("⚠️ Could not show notification:", notificationError);
      }

      try {
        await chrome.action.setBadgeText({ text: '...' });
        await chrome.action.setBadgeBackgroundColor({ color: '#3498db' });
      } catch (badgeError) {
        console.warn("⚠️ Could not update badge:", badgeError);
      }

      return;
    }

    try {
      await chrome.action.setBadgeText({ text: '' });
    } catch (clearError) {
      console.warn("⚠️ Could not clear badge:", clearError);
    }

    const existingTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("app.html") });

    if (existingTabs.length > 0) {
      const existingTab = existingTabs[0];
      await chrome.tabs.update(existingTab.id, { active: true });

      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
    } else {
      chrome.tabs.create({ url: "app.html" });
    }
  } catch (error) {
    console.error("❌ Error handling dashboard tab:", error);
    try {
      const fallbackStatus = await StorageService.get('installation_onboarding_complete');
      const isComplete = fallbackStatus === true || (fallbackStatus && fallbackStatus.completed === true);
      if (isComplete) {
        chrome.tabs.create({ url: "app.html" });
      }
    } catch (fallbackError) {
      console.error("❌ Fallback error:", fallbackError);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'HEALTH_CHECK') {
    console.log('💚 SERVICE WORKER: Health check received');
    const healthData = {
      status: 'healthy',
      timestamp: Date.now(),
      ...backgroundScriptHealth.getHealthReport(),
      memory: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      } : null,
      activeRequestTypes: Object.keys(activeRequests)
    };
    sendResponse(healthData);
    return true;
  }

  requestQueue.push({ request, sender, sendResponse });
  if (!isProcessing) processNextRequest();

  return true;
});

// Initialize consistency check alarm on startup
chrome.runtime.onStartup.addListener(() => {
  console.log("🚀 Background script startup - initializing consistency system");
  initializeConsistencySystem();
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log("🚀 Extension installed/updated - initializing system");
  initializeConsistencySystem();

  if (details.reason === 'install') {
    console.log("🎉 First-time install - opening dashboard");
    chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
  }
});
