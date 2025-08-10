import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import Input from "@mui/material/Input";
import MenuItem from "@mui/material/MenuItem";
import { Select, FormLabel, FormHelperText, TextField } from "@mui/material";
import { styled } from "@mui/material/styles";
import { usePreviousRoute } from "../../../shared/provider/PreviousRouteProvider.js";
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
});

const ProbSubmission = () => {
  const { state: routeState } = useLocation();
  const navigate = useNavigate();
  const previousRoute = usePreviousRoute();

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
    if (routeState?.problemData) {
      setValue("leetCodeID", routeState.problemData.LeetCodeID || "");
      setValue("title", routeState.problemData.Description || "");
    }
  }, [routeState, setValue]);

  const onSubmit = (data) => {
    // Convert time from minutes to seconds for consistent database storage
    const timeInMinutes = Number(data.timeSpent) || 0;
    const timeInSeconds = AccurateTimer.minutesToSeconds(timeInMinutes);
    
    const formData = {
      ...data,
      timeSpent: timeInSeconds, // Store as seconds
      date: new Date(),
      address: window.location.href,
      id: null,
      success: data.success.trim().toLowerCase() === "true",
      tags: routeState?.Tags || [],
      
      // Enhanced time tracking from timer (if available)
      exceededRecommendedTime: routeState?.exceededRecommendedTime || false,
      overageTime: routeState?.overageTime || 0,
      userIntent: routeState?.userIntent || "completed",
      timeWarningLevel: routeState?.timeWarningLevel || 0,
    };
    
    console.log("📌 ProbSubmission data:", {
      originalTimeMinutes: timeInMinutes,
      timeInSeconds: timeInSeconds,
      formData
    });
    
    chrome.runtime.sendMessage({
      type: "addProblem",
      contentScriptData: formData,
    });
    navigate("/Probstat", { state: data });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      <FormLabel>Problem Number</FormLabel>
      <Controller
        name="leetCodeID"
        control={control}
        render={({ field }) => <Input {...field} disabled />}
      />
      <FormLabel>Title</FormLabel>
      <Controller
        name="title"
        control={control}
        render={({ field }) => <Input {...field} />}
      />
      <FormLabel>Time</FormLabel>
      <Controller
        name="timeSpent"
        control={control}
        render={({ field }) => <Input {...field} />}
      />
      <FormLabel>Solution Found Status</FormLabel>
      <Controller
        name="success"
        control={control}
        rules={{ required: "Please select an option" }}
        render={({ field }) => (
          <>
            <StyledSelect
              {...field}
              error={Boolean(errors.success)}
              labelId="success-label"
              displayEmpty
              variant="standard"
            >
              <MenuItem value="" disabled>
                Select an option
              </MenuItem>
              <MenuItem value="false">No</MenuItem>
              <MenuItem value="true">Yes</MenuItem>
            </StyledSelect>
          </>
        )}
      />
      {errors.success && (
        <FormHelperText error>{errors.success.message}</FormHelperText>
      )}
      <FormLabel>Difficulty Level</FormLabel>
      <Controller
        name="difficulty"
        control={control}
        rules={{ required: "Please select a difficulty level" }}
        render={({ field }) => (
          <>
            <StyledSelect
              {...field}
              error={Boolean(errors.difficulty)}
              labelId="difficulty-label"
              displayEmpty
              variant="standard"
            >
              <MenuItem value="" disabled>
                Select a difficulty level
              </MenuItem>
              <MenuItem value={1}>Easy</MenuItem>
              <MenuItem value={2}>Medium</MenuItem>
              <MenuItem value={3}>Hard</MenuItem>
            </StyledSelect>
          </>
        )}
      />
      {errors.difficulty && (
        <FormHelperText error>{errors.difficulty.message}</FormHelperText>
      )}
      <FormLabel>Comments</FormLabel>
      <Controller
        name="comments"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            multiline
            rows={3}
            className="custom-textarea"
            placeholder="Enter your comments here"
            size="small"
          />
        )}
      />
      <input type="submit" />
    </form>
  );
};

export default ProbSubmission;
