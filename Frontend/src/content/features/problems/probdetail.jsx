import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TagInput from "../../../shared/components/TagInput";

const ProbDetail = (isLoading) => {
  const { state: routeState } = useLocation();

  console.log("📌routeState  being read in component ", routeState);
  const LeetCodeID =
    routeState?.problemData?.leetCodeID || routeState?.problemData?.id;
  const Description =
    routeState?.problemData?.ProblemDescription ||
    routeState?.problemData?.title;
  const [Tags, setTags] = useState(routeState?.problemData?.Tags || []);
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
    <div className="cd-sidenav problink">
      {loading && !LeetCodeID ? (
        <p>Loading...</p>
      ) : (
        <>
          <p>Problem ID: {LeetCodeID || "N/A"}</p>
          <p>Title: {Description || "N/A"}</p>
          <p>
            Tags:{" "}
            {Tags && Tags.length > 0
              ? Tags.map(
                  (tag) => tag.charAt(0).toUpperCase() + tag.slice(1)
                ).join(", ")
              : "No tags available"}
          </p>
          <TagInput setTags={setTags} />
          <button
            onClick={() =>
              navigate("/Timer", { state: { LeetCodeID, Description, Tags } })
            }
          >
            New Attempt
          </button>
          <input
            type="button"
            value="Skip"
            onClick={() => onSkip()}
            style={
              !showSkip
                ? { display: "none" }
                : { marginLeft: "10px", color: "red" }
            }
          />
          <p>Problem data received </p>
        </>
      )}
    </div>
  );
};

export default ProbDetail;
