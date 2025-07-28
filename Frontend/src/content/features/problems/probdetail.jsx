import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TagInput from "../../../shared/components/TagInput";
import Header from "../../../shared/components/header";

const ProbDetail = (isLoading) => {
  const { state: routeState } = useLocation();

  console.log("📌routeState  being read in component ", routeState);
  const LeetCodeID =
    routeState?.problemData?.leetCodeID || routeState?.problemData?.id;
  const Description =
    routeState?.problemData?.ProblemDescription ||
    routeState?.problemData?.title;
  const [Tags, setTags] = useState(routeState?.problemData?.tags || []);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isLoading);
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    setShowSkip(!routeState.problemFound);
    console.log("routeState", routeState);
    console.log("Tags", Tags);
  }, [setShowSkip, setTags]);

  const onSkip = () => {
    chrome.runtime.sendMessage({
      type: "skipProblem",
      consentScriptData: routeState.problemData,
    });
    navigate("/Probgen");
  };

  return (
    <div className="cd-simple-details">
      {loading && !LeetCodeID ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="cd-detail-row">
            <strong>Problem ID:</strong> {LeetCodeID || "N/A"}
          </div>
          
          <div className="cd-detail-row">
            <strong>Title:</strong> {Description || "N/A"}
          </div>
          
          <div className="cd-detail-row">
            <strong>Tags:</strong> {Tags && Tags.length > 0 ? (
              Tags.map((tag, index) => (
                <span key={index} className="cd-simple-tag">
                  {tag.charAt(0).toUpperCase() + tag.slice(1)}
                </span>
              ))
            ) : (
              "No tags available"
            )}
          </div>

          <div className="cd-simple-actions">
            <button
              className="cd-primary-button"
              onClick={() =>
                navigate("/Timer", { state: { LeetCodeID, Description, Tags } })
              }
            >
              <span className="cd-nav-icon cd-retry-icon"></span>
              New Attempt
            </button>
            
            {showSkip && (
              <button
                className="cd-skip-button"
                onClick={() => onSkip()}
              >
                Skip
              </button>
            )}
          </div>
          
          <p className="cd-simple-status">Problem data received</p>
        </>
      )}
    </div>
  );
};

export default ProbDetail;
