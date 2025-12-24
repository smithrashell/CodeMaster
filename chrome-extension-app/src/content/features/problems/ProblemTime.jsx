// ProbTime.js
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNav } from "../../../shared/provider/navprovider";
import { usePreviousRoute } from "../../../shared/provider/PreviousRouteProvider.js";
import { useAnimatedClose } from "../../../shared/hooks/useAnimatedClose";
import ProbSubmission from "../problems/ProblemSubmission";
import ProbDetail from "../problems/ProblemDetail";
import Header from "../../components/navigation/header.jsx";


const ProbTime = () => {
  const { state: routeState, pathname } = useLocation();
  const navigate = useNavigate();
  const { isAppOpen, setIsAppOpen } = useNav();
  const { shouldRender, isClosing } = useAnimatedClose(isAppOpen);

  const handleClose = () => {
    setIsAppOpen(false);
  };
  const previousRoute = usePreviousRoute();
  const [loading, _setLoading] = useState(false);

  // Note: This component only renders ProbSubmission or ProbDetail
  // All form functionality is handled by those components

  useEffect(() => {
    chrome.storage.local.set({ currentRoute: pathname }, () => {
      console.log(`📌Route saved to storage: ${pathname}`);
    });
  }, [pathname]);

  console.log(
    "📌previousRoute",
    previousRoute,
    "📌equality",
    previousRoute === "/Timer"
  );

  console.log("🔍 ProbTime Debug:", {
    previousRoute,
    pathname,
    routeState,
    isFromTimer: previousRoute === "/Timer",
    shouldShowSubmission: previousRoute === "/Timer"
  });

  const _onSkip = () => {
    chrome.runtime.sendMessage(
      { type: "skipProblem", consentScriptData: routeState.problemData },
      function (response) {
        console.log("📌Response from content script", response);
        navigate("/Probgen");
      }
    );
  };

  // Render the form if coming from the Timer route
  // NOTE: We use CSS display:none instead of returning null to prevent unmounting.
  // This preserves form state when the sidebar is closed and reopened.
  // See: fix/form-state-persistence branch

  return (
    <div
      id="cm-mySidenav"
      className={`cm-sidenav problink${isClosing ? ' cm-closing' : ''}`}
      style={{ display: shouldRender ? 'flex' : 'none' }}
    >
      <Header
        title={
          previousRoute == "/Timer" ? "Problem Submission" : "Problem Details"
        }
        onClose={handleClose}
      />
      <div className="cm-sidenav__content">
        {previousRoute === "/Timer" ? (
          <ProbSubmission />
        ) : (
          <ProbDetail isLoading={loading} />
        )}
      </div>
    </div>
  );
};

export default ProbTime;
