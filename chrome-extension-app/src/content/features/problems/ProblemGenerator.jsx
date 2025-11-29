import logger from "../../../shared/utils/logger.js";
import { useState, useRef } from "react";
import "../../css/probrec.css";
import Header from "../../components/navigation/header";
import { useNav } from "../../../shared/provider/navprovider";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler";
import { usePageTour } from "../../components/onboarding/usePageTour";
import { useAnimatedClose } from "../../../shared/hooks/useAnimatedClose";
import { ProblemGeneratorContent } from "./ProblemGeneratorComponents.jsx";
import {
  useSettingsManager,
  useSessionManagement,
  useSessionLoader,
  useSessionCacheListener
} from "./ProblemGeneratorHooks.js";

function ProbGen() {
  const { isAppOpen, setIsAppOpen } = useNav();
  const { shouldRender, isClosing } = useAnimatedClose(isAppOpen);
  const [problems, setProblems] = useState([]);
  const [cacheClearedRecently, setCacheClearedRecently] = useState(false);

  const sessionCreationAttempted = useRef(false);
  const lastSettingsHash = useRef(null);

  const { showTour: showPageTour } = usePageTour();

  const { settings, settingsLoaded, settingsLoading } = useSettingsManager();

  const {
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
  } = useSessionManagement(settings, settingsLoaded, sessionCreationAttempted, lastSettingsHash, setProblems);

  const { sessionLoading } = useSessionLoader({
    settings,
    settingsLoaded,
    sessionCreationAttempted,
    lastSettingsHash,
    setProblems,
    setSessionData,
    setShowInterviewBanner,
    setShowRegenerationBanner,
    cacheClearedRecently
  });

  useSessionCacheListener(
    { setSessionData, setProblems, setShowInterviewBanner, setShowRegenerationBanner },
    sessionCreationAttempted,
    setCacheClearedRecently
  );

  const handleClose = () => {
    setIsAppOpen(false);
  };

  const handleLinkClick = (problem) => {
    setShowRegenerationBanner(false);

    if (showPageTour) {
      ChromeAPIErrorHandler.sendMessageWithRetry({
        type: 'markPageTourCompleted',
        pageId: 'probgen'
      }).catch(error => {
        logger.warn('Failed to mark page tour completed:', error);
      });
    }

    window.location.href =
      problem.leetcode_address ||
      `https://leetcode.com/problems/${problem.slug}/description/`;
  };

  return shouldRender ? (
    <div id="cm-mySidenav" className={`cm-sidenav problink${isClosing ? ' cm-closing' : ''}`}>
      <Header title="Generator" onClose={handleClose} />
      <div className="cm-sidenav__content">
        <ProblemGeneratorContent
          sessionData={sessionData}
          showRegenerationBanner={showRegenerationBanner}
          handleRegenerateSession={handleRegenerateSession}
          settingsLoading={settingsLoading}
          settingsLoaded={settingsLoaded}
          sessionLoading={sessionLoading}
          isRegenerating={isRegenerating}
          problems={problems}
          showInterviewBanner={showInterviewBanner}
          settings={settings}
          handleInterviewChoice={handleInterviewChoice}
          handleRegularChoice={handleRegularChoice}
          onLinkClick={handleLinkClick}
        />
      </div>
    </div>
  ) : null;
}

export default ProbGen;
