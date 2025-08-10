// ProbTime.js
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import Input from "@mui/material/Input";
import MenuItem from "@mui/material/MenuItem";
import {
  Select,
  FormLabel,
  FormHelperText,
  TextField,
  InputLabel,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { usePreviousRoute } from "../../../shared/provider/PreviousRouteProvider.js";
import TagInput from "../../components/forms/TagInput";
import ProbSubmission from "../problems/probsubmission";
import ProbDetail from "../problems/probdetail";
import Header from "../../components/navigation/header.jsx";
import AccurateTimer from "../../../shared/utils/AccurateTimer.js";

const StyledSelect = styled(Select)({
  "&.MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none !important",
      outline: "none !important",
    },
    "&:hover fieldset": {
      border: "none !important",
    },
    "&.Mui-focused fieldset": {
      border: "none !important",
    },
  },
  "&.MuiInput-underline:before": {
    borderBottom: "1px solid var(--cm-btn-bg) !important",
  },
  "&.MuiInput-underline:hover:not(.Mui-disabled):before": {
    borderBottom: "2px solid var(--cm-btn-bg) !important",
  },
  "&.MuiInput-underline:after": {
    borderBottom: "2px solid var(--cm-active-blue) !important",
  },
  "& .MuiSelect-select": {
    color: "var(--cm-text) !important",
    backgroundColor: "transparent !important",
    padding: "8px 0 !important",
  },
  "& .MuiInputBase-root": {
    color: "var(--cm-text) !important",
  },
  "& .MuiMenuItem-root": {
    color: "var(--cm-dropdown-color) !important",
    backgroundColor: "var(--cm-dropdown-bg) !important",
  },
});

const ProbTime = () => {
  const { state: routeState, pathname } = useLocation();
  const navigate = useNavigate();
  const [problemTitle, setProblemTitle] = useState("");
  const previousRoute = usePreviousRoute();
  const [loading, setLoading] = useState(false);
  const [problemData, setProblemData] = useState(null);
  const [Tags, setTags] = useState([]);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      leetCodeID: routeState?.LeetCodeID || "",
      title: routeState?.Description || "",
      timeSpent: routeState?.Time ? `${Math.round(routeState.Time)}` : "",
      success: "",
      difficulty: "",
      comments: "",
    },
  });

  useEffect(() => {
    if (routeState.problemData) {
      console.log(
        "📌Incoming routeState proptery problemData",
        routeState.problemData
      );
      setValue("leetCodeID", routeState?.problemData?.LeetCodeID || "");
      setValue("title", routeState?.problemData?.Description || "");
      setTags(routeState.problemData.Tags || []);
    }
  }, [routeState, setValue]);

  const onSubmit = (data) => {
    // Convert time to seconds for consistent storage
    const timeInMinutes = Number(data.timeSpent) || 0;
    const timeInSeconds = AccurateTimer.minutesToSeconds(timeInMinutes);
    
    const formData = {
      ...data,
      timeSpent: timeInSeconds, // Store as seconds in database
      date: new Date(),
      address: window.location.href,
      id: null,
      success: data.success.trim().toLowerCase() === "true",
      tags: routeState.Tags || [],
      
      // Enhanced time tracking from timer (if available)
      exceededRecommendedTime: routeState?.exceededRecommendedTime || false,
      overageTime: routeState?.overageTime || 0,
      userIntent: routeState?.userIntent || "completed",
      timeWarningLevel: routeState?.timeWarningLevel || 0,
    };
    
    console.log("📌 Form data being sent:", {
      originalTimeMinutes: timeInMinutes,
      timeInSeconds: timeInSeconds,
      formData
    });
    
    chrome.runtime.sendMessage(
      { type: "addProblem", contentScriptData: formData },
      function (response) {
        console.log("📌 Response from content script", response);
      }
    );
    navigate("/Probstat", { state: data });
  };

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
