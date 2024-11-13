import React, { useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import {
  Input,
  FormLabel,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";
import "../css/main.css";

const ProbSurvey = (props) => {
  const location = useLocation();
  const attemptId = location.state ? location.state : null;
  console.log(console.log(attemptId));

  const navigate = useNavigate();
  const { time } = useContext(TimerContext);
  const {
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      attemptId: "",
      difficulty: "",
      comments: "",
    },
  });
  useEffect(() => {
    setValue("attemptId", attemptId);
  }, [attemptId]);
  const onSubmit = (data) => {
    console.log(data);
    // TODO: Send the data to your background script
    navigate("/Probstat", { state: data });
  };
  return (
    <div id="cd-mySidenav" className="cd-sidenav ">
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormLabel>attemptId</FormLabel>
        <Controller
          name="attemptId"
          disabled="true"
          control={control}
          render={({ field }) => <Input {...field} />}
        />

        <FormLabel>Difficulty Level</FormLabel>
        <Controller
          name="difficulty"
          control={control}
          rules={{ required: "Please select a difficulty level" }}
          render={({ field }) => (
            <Select {...field}>
              <MenuItem value="">Select a difficulty level</MenuItem>
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
            </Select>
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
            <Input {...field} placeholder="Add any additional comments here" />
          )}
        />

        <input type="submit" value="Submit Feedback" />
      </form>
    </div>
  );
};

export default ProbSurvey;
