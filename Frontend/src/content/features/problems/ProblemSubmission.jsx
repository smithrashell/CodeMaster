import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { usePreviousRoute } from "../../../shared/provider/PreviousRouteProvider.js";
import AccurateTimer from "../../../shared/utils/AccurateTimer.js";
import { IconHash, IconTarget, IconClock, IconBolt, IconMessageCircle } from "@tabler/icons-react";

// Enhanced styled select component for Chrome extension
const SimpleSelect = ({ value, onChange, children, error, ...props }) => (
  <select
    value={value}
    onChange={onChange}
    className="cm-simple-select"
    style={{
      width: '100%',
      maxWidth: '100%',
      padding: '6px 8px',
      boxSizing: 'border-box',
      backgroundColor: 'var(--cm-card-bg)',
      color: 'var(--cm-text)',
      border: error ? '2px solid #ef4444' : '1px solid var(--cm-border)',
      borderRadius: '6px',
      fontSize: '13px',
      outline: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      appearance: 'none', // Remove default styling
      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
      backgroundPosition: 'right 8px center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '16px',
      paddingRight: '32px'
    }}
    onFocus={(e) => {
      e.target.style.borderColor = error ? '#ef4444' : 'var(--cm-active-blue)';
      e.target.style.boxShadow = error 
        ? '0 0 0 3px rgba(239, 68, 68, 0.1)' 
        : '0 0 0 3px rgba(37, 99, 235, 0.1)';
    }}
    onBlur={(e) => {
      e.target.style.borderColor = error ? '#ef4444' : 'var(--cm-border)';
      e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
    }}
    {...props}
  >
    {children}
  </select>
);

const SimpleInput = ({ value, onChange, disabled, ...props }) => (
  <input
    type="text"
    value={value || ''}
    onChange={onChange}
    disabled={disabled}
    className="cm-simple-input"
    style={{
      width: '100%',
      maxWidth: '100%',
      padding: '6px 8px',
      boxSizing: 'border-box',
      backgroundColor: disabled ? 'var(--cm-navbar-aside-bg)' : 'var(--cm-card-bg)',
      color: disabled ? 'var(--cm-link-color)' : 'var(--cm-text)',
      border: '1px solid var(--cm-border)',
      borderRadius: '6px',
      fontSize: '13px',
      outline: 'none',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      cursor: disabled ? 'not-allowed' : 'text'
    }}
    onFocus={(e) => {
      e.target.style.borderColor = 'var(--cm-active-blue)';
      e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
    }}
    onBlur={(e) => {
      e.target.style.borderColor = 'var(--cm-border)';
      e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
    }}
    {...props}
  />
);

const SimpleTextArea = ({ value, onChange, placeholder, ...props }) => (
  <textarea
    value={value || ''}
    onChange={onChange}
    className="cm-simple-textarea"
    rows={3}
    placeholder={placeholder || "Enter your comments here"}
    style={{
      width: '100%',
      maxWidth: '100%',
      padding: '6px 8px',
      boxSizing: 'border-box',
      backgroundColor: 'var(--cm-card-bg)',
      color: 'var(--cm-text)',
      border: '1px solid var(--cm-border)',
      borderRadius: '6px',
      fontSize: '13px',
      fontFamily: 'inherit',
      resize: 'vertical',
      outline: 'none',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      minHeight: '80px'
    }}
    onFocus={(e) => {
      e.target.style.borderColor = 'var(--cm-active-blue)';
      e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
    }}
    onBlur={(e) => {
      e.target.style.borderColor = 'var(--cm-border)';
      e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
    }}
    {...props}
  />
);

const FormLabel = ({ children, required, icon: IconComponent }) => (
  <label
    className="cm-form-label"
    style={{
      color: 'var(--cm-text)',
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '4px',
      marginTop: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      letterSpacing: '0.025em'
    }}
  >
    {IconComponent && <IconComponent size={16} style={{ color: 'var(--cm-link-color)' }} />}
    {children}
    {required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
  </label>
);

const FormHelperText = ({ children, error }) => (
  <div
    className="cm-form-helper-text"
    style={{
      color: error ? '#ef4444' : 'var(--cm-link-color)',
      fontSize: '10px',
      marginTop: '1px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }}
  >
    {error && <span>⚠</span>}
    {children}
  </div>
);

const ProbSubmission = () => {
  const { state: routeState } = useLocation();
  const navigate = useNavigate();
  const previousRoute = usePreviousRoute();

  console.log("🔍 ProbSubmission component rendered", {
    routeState,
    previousRoute,
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
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

  // Debug: Watch all form values
  const watchedValues = watch();
  console.log("🔍 Form values:", watchedValues);
  console.log("🔍 Form errors:", errors);

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
      formData,
    });

    chrome.runtime.sendMessage({
      type: "addProblem",
      contentScriptData: formData,
    });
    navigate("/Probstat", { state: data });
  };

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)} 
      className="form"
      onClick={() => console.log("🔍 Form container clicked")}
      style={{ 
        pointerEvents: 'auto',
        padding: '2px',
        margin: '0',
        maxWidth: '100%',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      <FormLabel icon={IconHash}>Problem Number</FormLabel>
      <Controller
        name="leetCodeID"
        control={control}
        render={({ field }) => <SimpleInput {...field} disabled />}
      />
      <FormLabel icon={IconTarget}>Title</FormLabel>
      <Controller
        name="title"
        control={control}
        render={({ field }) => (
          <SimpleInput 
            {...field} 
            onChange={(e) => {
              console.log("🔍 Title input changed:", e.target.value);
              field.onChange(e);
            }}
          />
        )}
      />
      <FormLabel icon={IconClock}>Time <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--cm-link-color)' }}>minutes</span></FormLabel>
      <Controller
        name="timeSpent"
        control={control}
        render={({ field }) => <SimpleInput {...field} />}
      />
      <FormLabel icon={IconBolt} required>Solution Found Status</FormLabel>
      <Controller
        name="success"
        control={control}
        rules={{ required: "Please select an option" }}
        render={({ field: { onChange, value, ...rest } }) => (
          <SimpleSelect
            {...rest}
            value={value || ""}
            onChange={(event) => {
              console.log("Success dropdown changed:", event.target.value);
              onChange(event.target.value);
            }}
            error={Boolean(errors.success)}
          >
            <option value="" disabled>
              Select status
            </option>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </SimpleSelect>
        )}
      />
      {errors.success && (
        <FormHelperText error>{errors.success.message}</FormHelperText>
      )}
      <FormLabel icon={IconTarget} required>Difficulty Level</FormLabel>
      <Controller
        name="difficulty"
        control={control}
        rules={{ required: "Please select a difficulty level" }}
        render={({ field: { onChange, value, ...rest } }) => (
          <SimpleSelect
            {...rest}
            value={value || ""}
            onChange={(event) => {
              console.log("Difficulty dropdown changed:", event.target.value);
              onChange(event.target.value);
            }}
            error={Boolean(errors.difficulty)}
          >
            <option value="" disabled>
              Select difficulty
            </option>
            <option value={1}>Easy</option>
            <option value={2}>Medium</option>
            <option value={3}>Hard</option>
          </SimpleSelect>
        )}
      />
      {errors.difficulty && (
        <FormHelperText error>{errors.difficulty.message}</FormHelperText>
      )}
      <FormLabel icon={IconMessageCircle}>Reflection</FormLabel>
      <Controller
        name="comments"
        control={control}
        render={({ field }) => (
          <SimpleTextArea 
            {...field} 
            placeholder="Why was this challenging? What did you learn? What patterns did you notice?"
          />
        )}
      />
      <button 
        type="submit"
        style={{
          width: '100%',
          maxWidth: '100%',
          padding: '8px 16px',
          boxSizing: 'border-box',
          backgroundColor: 'var(--cm-active-blue)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          marginTop: '8px',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = 'var(--cm-active-blue-hover, #1d4ed8)';
          e.target.style.transform = 'translateY(-1px)';
          e.target.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'var(--cm-active-blue)';
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 2px 4px rgba(37, 99, 235, 0.2)';
        }}
      >
        Submit Problem
      </button>
    </form>
  );
};

export default ProbSubmission;
