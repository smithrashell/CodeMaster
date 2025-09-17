import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { usePreviousRoute } from "../../../shared/provider/PreviousRouteProvider.js";
import AccurateTimer from "../../../shared/utils/AccurateTimer.js";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler";
import { IconHash, IconTarget, IconClock, IconBolt, IconMessageCircle } from "@tabler/icons-react";
import SimpleSelect from "../../../shared/components/ui/SimpleSelect";

// Using shared SimpleSelect component

const SimpleInput = React.forwardRef(({ value, onChange, disabled, ...props }, ref) => (
  <input
    ref={ref}
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
));

SimpleInput.displayName = 'SimpleInput';

const SimpleTextArea = React.forwardRef(({ value, onChange, placeholder, ...props }, ref) => (
  <textarea
    ref={ref}
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
));

SimpleTextArea.displayName = 'SimpleTextArea';

/**
 * Get form configuration with default values
 */
const getFormConfig = (routeState) => ({
  defaultValues: {
    leetCodeID: routeState?.LeetCodeID || "",
    title: routeState?.Description || "",
    timeSpent: routeState?.Time ? `${Math.round(routeState.Time)}` : "",
    success: "",
    difficulty: "",
    comments: "",
  },
});

/**
 * Get submit button styles
 */
const getSubmitButtonStyles = () => ({
  base: {
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
  },
  hover: {
    backgroundColor: 'var(--cm-active-blue-hover, #1d4ed8)',
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
  },
  normal: {
    backgroundColor: 'var(--cm-active-blue)',
    transform: 'translateY(0)',
    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
  }
});

/**
 * Handle form submission logic with proper database completion wait
 */
const handleFormSubmission = async (data, routeState, navigate, setSubmitting) => {
  try {
    setSubmitting(true);
    
    // Convert time from minutes to seconds for consistent database storage
    const timeInMinutes = Number(data.timeSpent) || 0;
    const timeInSeconds = AccurateTimer.minutesToSeconds(timeInMinutes);

    const formData = {
      ...data,
      leetcode_id: data.leetCodeID, // Map form field to expected backend field
      timeSpent: timeInSeconds, // Store as seconds
      perceived_difficulty: Number(data.difficulty), // User's perceived difficulty as a number
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

    // Use established Chrome messaging pattern and wait for completion
    await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "addProblem",
      contentScriptData: formData,
    });

    console.log("✅ Problem submission completed");

    // Add a small delay to ensure database commit completes
    // This allows the problem to be properly saved before navigation refresh
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Notify navigation component to refresh problem status
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "problemSubmitted" });
    }

    // Navigate to stats page after successful submission
    navigate("/Probstat", { state: { ...data, submissionComplete: true } });
    
  } catch (error) {
    console.error("❌ Error submitting problem:", error);
    setSubmitting(false);
  }
};

const formStyles = { 
  pointerEvents: 'auto',
  padding: '2px',
  margin: '0',
  maxWidth: '100%',
  width: '100%',
  boxSizing: 'border-box',
  overflow: 'hidden'
};

/**
 * Submit Button component with loading state
 */
const SubmitButton = ({ isSubmitting }) => {
  const buttonStyles = getSubmitButtonStyles();
  
  return (
    <button 
      type="submit"
      disabled={isSubmitting}
      style={{
        ...buttonStyles.base,
        backgroundColor: isSubmitting ? 'var(--cm-link-color)' : buttonStyles.base.backgroundColor,
        cursor: isSubmitting ? 'not-allowed' : 'pointer'
      }}
      onMouseEnter={(e) => {
        if (!isSubmitting) {
          Object.assign(e.target.style, buttonStyles.hover);
        }
      }}
      onMouseLeave={(e) => {
        if (!isSubmitting) {
          Object.assign(e.target.style, buttonStyles.normal);
        }
      }}
    >
      {isSubmitting ? 'Submitting...' : 'Submit Problem'}
    </button>
  );
};

/**
 * Form Fields component
 */
const FormFields = ({ control, errors }) => (
  <>
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
  </>
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log("🔍 ProbSubmission component rendered", {
    routeState,
    previousRoute,
    routeStateKeys: routeState ? Object.keys(routeState) : 'null',
    routeStateValues: routeState ? Object.keys(routeState).reduce((acc, key) => ({
      ...acc,
      [key]: routeState[key]
    }), {}) : 'null',
    leetCodeID: routeState?.LeetCodeID,
    description: routeState?.Description,
    time: routeState?.Time,
    // Check for snake_case versions
    leetcode_id: routeState?.leetcode_id,
    title: routeState?.title,
    // Check for other possible field names
    id: routeState?.id,
    problemId: routeState?.problemId,
    problem_id: routeState?.problem_id
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm(getFormConfig(routeState));

  // Debug: Watch all form values
  const watchedValues = watch();
  console.log("🔍 Form values:", watchedValues);
  console.log("🔍 Form errors:", errors);


  const onSubmit = async (data) => {
    await handleFormSubmission(data, routeState, navigate, setIsSubmitting);
  };

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)} 
      className="form"
      style={formStyles}
    >
      <FormFields control={control} errors={errors} />
      <SubmitButton isSubmitting={isSubmitting} />
    </form>
  );
};

export default ProbSubmission;
