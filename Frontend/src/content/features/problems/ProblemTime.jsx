// ProbTime.js
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNav } from "../../../shared/provider/navprovider";
import { usePreviousRoute } from "../../../shared/provider/PreviousRouteProvider.js";
import ProbSubmission from "../problems/ProblemSubmission";
import ProbDetail from "../problems/ProblemDetail";
import Header from "../../components/navigation/header.jsx";
import AccurateTimer from "../../../shared/utils/AccurateTimer.js";


const ProbTime = () => {
  const { state: routeState, pathname } = useLocation();
  const navigate = useNavigate();
  const { setIsAppOpen } = useNav();

  const handleClose = () => {
    setIsAppOpen(false);
  };
  const previousRoute = usePreviousRoute();
  const [loading, setLoading] = useState(false);

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

  const onSkip = () => {
    chrome.runtime.sendMessage(
      { type: "skipProblem", consentScriptData: routeState.problemData },
      function (response) {
        console.log("📌Response from content script", response);
        navigate("/Probgen");
      }
    );
  };

  // Render the form if coming from the Timer route

  return (
    <div id="cm-mySidenav" className="cm-sidenav problink">
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
