/**
 * Problem Generator Helper Functions
 * Extracted from ProblemGenerator.jsx
 */

import logger from "../../../shared/utils/logger.js";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler";

/**
 * Get fresh settings before creating session
 */
export const getFreshSettings = async (fallbackSettings) => {
  logger.info('Getting fresh settings before creating session');
  try {
    const settingsResponse = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "getSettings"
    });
    const freshSettings = settingsResponse || fallbackSettings;
    logger.info('Fresh settings retrieved:', freshSettings);
    return freshSettings;
  } catch (error) {
    logger.warn('Failed to get fresh settings, using cached:', error);
    return fallbackSettings;
  }
};

/**
 * Process session API response and update handlers
 */
export const processSessionResponse = (response, handlers, sessionCreationAttempted, operationName) => {
  const { setProblems, setSessionData, setShowRegenerationBanner } = handlers;
  logger.info(`${operationName} API Response:`, {
    hasSession: !!response.session,
    sessionId: response.session?.id?.substring(0, 8),
    session_type: response.session?.session_type,
    isSessionStale: response.isSessionStale,
    last_activity_time: response.session?.last_activity_time
  });

  if (response.session) {
    const { problems: sessionProblems, ...restOfSession } = response.session;
    setProblems(sessionProblems || []);
    setSessionData(restOfSession);

    logger.info(`${operationName} - Setting regeneration banner state:`, response.isSessionStale || false);
    setShowRegenerationBanner(response.isSessionStale || false);

    sessionCreationAttempted.current = true;
    logger.info(`${operationName} session created successfully`);
    return true;
  } else {
    logger.warn(`No session in ${operationName} response - showing banner again`);
    return false;
  }
};

/**
 * Determine if interview banner should be shown
 */
export const shouldShowInterviewBanner = (settings, settingsLoaded) => {
  logger.info('Interview Banner Logic Check:', {
    settingsLoaded,
    settingsObject: settings,
    interviewMode: settings?.interviewMode,
    interviewFrequency: settings?.interviewFrequency,
    conditionMet: settings?.interviewMode &&
                 settings.interviewMode !== 'disabled' &&
                 settings?.interviewFrequency === 'manual',
    willShowBanner: settings?.interviewMode &&
                  settings.interviewMode !== 'disabled' &&
                  settings?.interviewFrequency === 'manual'
  });

  return (
    (settings?.interviewMode &&
     settings.interviewMode !== 'disabled' &&
     settings?.interviewFrequency === 'manual') ||
    (settings?.interviewFrequency === 'manual' &&
     settings?.interviewMode !== 'disabled')
  );
};

/**
 * Process session loader response
 */
export const processSessionLoaderResponse = (response, handlers, sessionCreationAttempted, settings, pathName = '') => {
  const { setProblems, setSessionData, setShowRegenerationBanner, setShowInterviewBanner, settingsLoaded } = handlers;
  if (response.session) {
    setSessionData(response.session);

    logger.info('Setting regeneration banner state:', response.isSessionStale || false);
    setShowRegenerationBanner(response.isSessionStale || false);

    if (response.session.problems && Array.isArray(response.session.problems)) {
      setProblems(response.session.problems);
    } else {
      setProblems([]);
    }
    setShowInterviewBanner(false);

    sessionCreationAttempted.current = false;
  } else {
    setProblems([]);
    setSessionData(null);
    setShowRegenerationBanner(false);

    if (shouldShowInterviewBanner(settings, settingsLoaded)) {
      logger.info(`Setting showInterviewBanner to true${pathName ? ` (${pathName})` : ''}`);
      setShowInterviewBanner(true);
    } else {
      logger.info(`Interview banner conditions not met${pathName ? ` (${pathName})` : ''} - staying in empty state`);
    }
  }
};

/**
 * Get mode display configuration for interview banners
 */
export const getModeDisplay = (mode) => {
  switch (mode) {
    case 'interview-like':
      return {
        icon: '🟡',
        title: 'Interview-Like Mode',
        description: 'Limited hints • Mild time pressure • Practice interview conditions',
        color: '#f59e0b'
      };
    case 'full-interview':
      return {
        icon: '🔴',
        title: 'Full Interview Mode',
        description: 'No hints • Strict timing • Realistic interview simulation',
        color: '#ef4444'
      };
    default:
      return {
        icon: '🎯',
        title: 'Interview Mode',
        description: 'Interview practice session',
        color: '#3b82f6'
      };
  }
};

/**
 * Get interview-specific styling for problems
 */
export const getInterviewProblemStyle = (interviewMode) => {
  if (!interviewMode || interviewMode === 'standard') return {};

  return {
    borderLeft: interviewMode === 'full-interview' ? '3px solid #ef4444' : '3px solid #f59e0b',
    paddingLeft: '8px'
  };
};
