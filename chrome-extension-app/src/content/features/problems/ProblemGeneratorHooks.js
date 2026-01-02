/**
 * Problem Generator Custom Hooks
 * Extracted from ProblemGenerator.jsx
 */

import { useState, useCallback, useEffect } from "react";
import logger from "../../../shared/utils/logging/logger.js";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import ChromeAPIErrorHandler from "../../../shared/services/chrome/chromeAPIErrorHandler.js";
import {
  getFreshSettings,
  processSessionResponse,
  shouldShowInterviewBanner,
  processSessionLoaderResponse
} from "./ProblemGeneratorHelpers.js";

/**
 * Custom hook for settings loading and management
 */
export const useSettingsManager = () => {
  const [settings, setSettings] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const {
    data: _settingsData,
    loading: settingsLoading,
    error: _settingsError
  } = useChromeMessage({ type: "getSettings" }, [], {
    onSuccess: (response) => {
      if (response) {
        setSettings(response);
      }
      setSettingsLoaded(true);
    },
    onError: (error) => {
      logger.error("Failed to load settings:", error);
      setSettingsLoaded(true);
    }
  });

  return {
    settings,
    settingsLoaded,
    settingsLoading
  };
};

/**
 * Custom hook for session management
 */
export const useSessionManagement = (settings, settingsLoaded, sessionCreationAttempted, lastSettingsHash, setProblems) => {
  const [sessionData, setSessionData] = useState(null);
  const [showInterviewBanner, setShowInterviewBanner] = useState(false);
  const [showRegenerationBanner, setShowRegenerationBanner] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleInterviewChoice = async () => {
    const freshSettings = await getFreshSettings(settings);

    const canCreateInterviewSession = freshSettings?.interviewMode && freshSettings.interviewMode !== 'disabled';
    const defaultInterviewMode = canCreateInterviewSession ? freshSettings.interviewMode : 'interview-like';

    logger.info('handleInterviewChoice called:', {
      settingsInterviewMode: freshSettings?.interviewMode,
      canCreateInterviewSession,
      willUseMode: defaultInterviewMode,
      settingsFrequency: freshSettings?.interviewFrequency,
      freshSettings,
      cachedSettings: settings
    });

    setShowInterviewBanner(false);

    try {
      logger.info('Creating interview session with session_type:', defaultInterviewMode);
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "getOrCreateSession",
        session_type: defaultInterviewMode
      });

      const success = processSessionResponse(response, { setProblems, setSessionData, setShowRegenerationBanner }, sessionCreationAttempted, 'handleInterviewChoice');
      if (!success) {
        setShowInterviewBanner(true);
      }
    } catch (error) {
      logger.error("Failed to create interview session:", {
        error: error.message,
        stack: error.stack,
        settingsState: {
          interviewMode: settings?.interviewMode,
          interviewFrequency: settings?.interviewFrequency
        }
      });
      setShowInterviewBanner(true);
    }
  };

  const handleRegularChoice = async () => {
    logger.info('handleRegularChoice called - creating standard session');
    setShowInterviewBanner(false);

    try {
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "getOrCreateSession",
        session_type: 'standard'
      });

      const success = processSessionResponse(response, { setProblems, setSessionData, setShowRegenerationBanner }, sessionCreationAttempted, 'handleRegularChoice');
      if (!success) {
        setShowInterviewBanner(true);
      }
    } catch (error) {
      logger.error("Failed to create standard session:", {
        error: error.message,
        stack: error.stack
      });
      setShowInterviewBanner(true);
    }
  };

  const handleRegenerateSession = async () => {
    setIsRegenerating(true);
    setShowRegenerationBanner(false);

    try {
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "refreshSession",
        session_type: sessionData?.session_type || 'standard'
      });

      if (response.session) {
        const { problems: sessionProblems, ...restOfSession } = response.session;
        setProblems(sessionProblems || []);
        setSessionData(restOfSession);
        sessionCreationAttempted.current = true;
      }
    } catch (error) {
      logger.error("Failed to regenerate session:", error);
      setShowRegenerationBanner(true);
    } finally {
      setIsRegenerating(false);
    }
  };

  return {
    sessionData,
    setSessionData,
    showInterviewBanner,
    setShowInterviewBanner,
    showRegenerationBanner,
    setShowRegenerationBanner,
    isRegenerating,
    handleInterviewChoice,
    handleRegularChoice,
    handleRegenerateSession
  };
};

/**
 * Custom hook for session loading and effects
 */
export const useSessionLoader = (options) => {
  const {
    settings,
    settingsLoaded,
    sessionCreationAttempted,
    lastSettingsHash,
    setProblems,
    setSessionData,
    setShowInterviewBanner,
    setShowRegenerationBanner,
    cacheClearedRecently
  } = options;
  const [_manualSessionTypeOverride, _setManualSessionTypeOverride] = useState(null);

  const {
    data: sessionResponse,
    loading: sessionLoading,
    error: _sessionError,
    retry: triggerSessionLoad
  } = useChromeMessage(
    {
      type: "getOrCreateSession",
      ...(_manualSessionTypeOverride && { session_type: _manualSessionTypeOverride }),
      ...(settings?.interviewMode &&
          settings.interviewMode !== 'disabled' &&
          settings.interviewFrequency !== 'manual' &&
          !_manualSessionTypeOverride &&
          { session_type: settings.interviewMode }),
      ...(settings?.interviewMode &&
          settings.interviewMode !== 'disabled' &&
          cacheClearedRecently &&
          !_manualSessionTypeOverride &&
          { session_type: settings.interviewMode })
    },
    [settings, settingsLoaded, _manualSessionTypeOverride],
    {
      immediate: false,
      onSuccess: (response) => {
        logger.info('ProblemGenerator API Response:', {
          hasSession: !!response.session,
          sessionId: response.session?.id?.substring(0, 8),
          session_type: response.session?.session_type,
          isSessionStale: response.isSessionStale,
          last_activity_time: response.session?.last_activity_time,
          backgroundScriptData: response.backgroundScriptData
        });

        processSessionLoaderResponse(response, { setProblems, setSessionData, setShowRegenerationBanner, setShowInterviewBanner, settingsLoaded }, sessionCreationAttempted, settings);
      },
      onError: (error) => {
        logger.error('ProblemGenerator session fetch error:', error);

        setProblems([]);
        setSessionData(null);
        setShowRegenerationBanner(false);

        sessionCreationAttempted.current = false;

        if (shouldShowInterviewBanner(settings, settingsLoaded)) {
          logger.info('Setting showInterviewBanner to true (ERROR PATH)');
          setShowInterviewBanner(true);
        } else {
          logger.info('Interview banner conditions not met (ERROR PATH) - staying in empty state');
        }
      }
    }
  );

  const handleSessionLoad = useCallback(() => {
    if (sessionCreationAttempted.current) {
      return;
    }

    sessionCreationAttempted.current = true;
    triggerSessionLoad();
  }, [triggerSessionLoad, sessionCreationAttempted]);

  useEffect(() => {
    if (settingsLoaded && settings && !sessionLoading && !sessionResponse) {
      const settingsHash = JSON.stringify({
        interviewMode: settings.interviewMode,
        interviewFrequency: settings.interviewFrequency,
        interviewReadinessThreshold: settings.interviewReadinessThreshold
      });

      if (lastSettingsHash.current !== settingsHash) {
        logger.info('ProblemGenerator: Settings changed, resetting session creation', {
          oldHash: lastSettingsHash.current,
          newHash: settingsHash,
          changedSettings: {
            interviewMode: settings.interviewMode,
            interviewFrequency: settings.interviewFrequency,
            interviewReadinessThreshold: settings.interviewReadinessThreshold
          }
        });
        sessionCreationAttempted.current = false;
        lastSettingsHash.current = settingsHash;
      }

      handleSessionLoad();
    }
  }, [settingsLoaded, settings, sessionLoading, sessionResponse, handleSessionLoad, lastSettingsHash, sessionCreationAttempted]);

  return {
    sessionLoading,
    sessionResponse,
    triggerSessionLoad,
    _manualSessionTypeOverride,
    _setManualSessionTypeOverride
  };
};

/**
 * Custom hook for session cache listener and problem submission updates
 */
export const useSessionCacheListener = (setters, sessionCreationAttempted, setCacheClearedRecently, triggerSessionRefresh) => {
  const { setSessionData, setProblems, setShowInterviewBanner, setShowRegenerationBanner } = setters;
  useEffect(() => {
    const handleSessionCacheCleared = () => {
      logger.info("ProblemGenerator: Received session cache cleared signal, resetting session state");
      sessionCreationAttempted.current = false;
      setSessionData(null);
      setProblems([]);
      setShowInterviewBanner(false);
      setShowRegenerationBanner(false);
      setCacheClearedRecently(true);
      setTimeout(() => setCacheClearedRecently(false), 2000);
    };

    const handleProblemSubmitted = () => {
      logger.info("ProblemGenerator: Received problemSubmitted, refreshing session from database");
      // Refetch session from database to get updated attempted status
      if (triggerSessionRefresh) {
        triggerSessionRefresh();
      }
    };

    const messageListener = (message, _sender, sendResponse) => {
      if (message.type === "sessionCacheCleared") {
        handleSessionCacheCleared();
        sendResponse({ status: "success" });
      } else if (message.type === "problemSubmitted") {
        handleProblemSubmitted();
        sendResponse({ status: "success" });
      }
    };

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    return () => {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, [setters, sessionCreationAttempted, setCacheClearedRecently, triggerSessionRefresh, setSessionData, setProblems, setShowInterviewBanner, setShowRegenerationBanner]);
};
