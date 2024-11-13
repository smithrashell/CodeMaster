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
import { usePreviousRoute } from "../components/PreviousRouteProvider";

const StyledSelect = styled(Select)({
  "&.MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none",
    },
    "&:hover fieldset": {
      border: "none",
    },
    "&.Mui-focused fieldset": {
      border: "none",
    },
  },
  "&.MuiInput-underline:before": {
    borderBottom: "1px solid #0c433d",
  },
  "&.MuiInput-underline:hover:not(.Mui-disabled):before": {
    borderBottom: "2px solid #0c433d",
  },
  "&.MuiInput-underline:after": {
    borderBottom: "2px solid #0c433d",
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
      leetCodeID: problemData?.LeetCodeID || "",
      title: problemData?.Description || "",
      timeSpent: routeState?.time ? `${Math.round(routeState.time / 60)}` : "",
      success: "",
      difficulty: "",
      comments: "",
    },
  });

  useEffect(() => {
    if (routeState) {
      console.log("routeState", routeState);
      setValue("leetCodeID", routeState?.LeetCodeID || "");
      setValue("title", routeState?.Description || "");
      setTags(routeState.Tags || []);
      console.log("Tags", Tags);
    }
  }, [routeState, setValue]);

  // useEffect(() => {
  //   console.log("from probtime routeState", routeState);
  //   if(routeState.title && routeState.problem == null){
  //     setLoading(true);
  //      chrome.runtime.sendMessage({ type: "callChatGPT", description: routeState.title.toLowerCase()}, (response) => {
  //         console.log("ChatGPT response:", response);
  //         setProblemData(response);
  //         setLoading(false);
  //       });
  //   }
  //   console.log("routeState", routeState);
  // },[routeState,setProblemData,setLoading])

  const onSubmit = (data) => {
    const formData = {
      ...data,
      date: new Date(),
      address: window.location.href,
      id: null,
      success: data.success.trim().toLowerCase() === "true",
      tags: routeState.Tags || [],
    };
    console.log("formData", formData);
    console.log("routeState", routeState, routeState.Tags);
    chrome.runtime.sendMessage(
      { type: "addProblem", contentScriptData: formData },
      function (response) {
        console.log("addProblem response", response);
      }
    );
    navigate("/Probstat", { state: data });
  };

  useEffect(() => {
    chrome.storage.local.set({ currentRoute: pathname }, () => {
      console.log(`Route saved to storage: ${pathname}`);
    });
  }, [pathname]);

  console.log(
    "previousRoute",
    previousRoute,
    "equality",
    previousRoute === "/Timer"
  );
  if (previousRoute === "/Timer") {
    // Render the form if coming from the Timer route
    return (
      <div id="cd-mySidenav" className="cd-sidenav problink">
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
      </div>
    );
  } else {
    console.log("problemData", problemData);
    console.log("routeState", routeState);
    const LeetCodeID =
      routeState?.problemData?.LeetCodeID ||
      routeState?.problemData?.leetCodeID;
    const Description =
      routeState?.problemData?.Description ||
      routeState?.problemData?.ProblemDescription;
    const Tags = routeState?.problemData?.Tags || routeState?.problemData?.tags;
    // Render default content if coming from any other route
    return (
      <div id="cd-mySidenav" className="cd-sidenav problink">
        {loading && (!LeetCodeID || problemData == null) ? (
          <p>Loading...</p>
        ) : (
          <>
            <p>Problem ID: {LeetCodeID || "N/A"}</p>
            <p>Title: {Description || "N/A"}</p>
            <p>
              Tags:{" "}
              {Tags && Tags.length > 0 ? Tags.join(", ") : "No tags available"}
            </p>
            <button
              onClick={() =>
                navigate("/Timer", { state: { LeetCodeID, Description, Tags } })
              }
            >
              New Attempt
            </button>
            <p>Problem data received </p>
          </>
        )}
      </div>
    );
  }
};

export default ProbTime;
