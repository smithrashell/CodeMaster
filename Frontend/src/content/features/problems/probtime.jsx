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
    borderBottom: "1px solid var(--cd-btn-bg) !important",
  },
  "&.MuiInput-underline:hover:not(.Mui-disabled):before": {
    borderBottom: "2px solid var(--cd-btn-bg) !important",
  },
  "&.MuiInput-underline:after": {
    borderBottom: "2px solid var(--cd-active-blue) !important",
  },
  "& .MuiSelect-select": {
    color: "var(--cd-text) !important",
    backgroundColor: "transparent !important",
    padding: "8px 0 !important",
  },
  "& .MuiInputBase-root": {
    color: "var(--cd-text) !important",
  },
  "& .MuiMenuItem-root": {
    color: "var(--cd-dropdown-color) !important",
    backgroundColor: "var(--cd-dropdown-bg) !important",
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
    const formData = {
      ...data,
      date: new Date(),
      address: window.location.href,
      id: null,
      success: data.success.trim().toLowerCase() === "true",
      tags: routeState.Tags || [],
    };
    console.log("📌formData being sent to content script", formData);
    console.log("📌Tags from routeState", routeState, routeState.Tags);
    chrome.runtime.sendMessage(
      { type: "addProblem", contentScriptData: formData },

      function (response) {
        console.log("📌Response from content script", response);
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
    <div id="cd-mySidenav" className="cd-sidenav problink">
      <Header
        title={
          previousRoute == "/Timer" ? "Problem Submission" : "Problem Details"
        }
      />
      <div className="cd-sidenav__content">
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
