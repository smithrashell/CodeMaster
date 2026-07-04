import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../css/probrec.css";
import Header from "../../components/navigation/header";
import { useNav } from "../../../shared/provider/navprovider";
import { useAnimatedClose } from "../../../shared/hooks/useAnimatedClose";
import Button from "../../components/ui/Button.jsx";
import ChromeAPIErrorHandler from "../../../shared/services/chrome/chromeAPIErrorHandler.js";
import logger from "../../../shared/utils/logging/logger.js";

const SKIP_REASONS = [
  {
    value: 'too_difficult',
    label: 'Too difficult',
    description: 'This problem is above my current skill level',
    emoji: '🔥'
  },
  {
    value: 'dont_understand',
    label: "Don't understand",
    description: 'The problem statement or concept is unclear',
    emoji: '❓'
  },
  {
    value: 'not_relevant',
    label: 'Not relevant',
    description: "This problem doesn't fit my learning goals",
    emoji: '🎯'
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Another reason',
    emoji: '💭'
  },
];

const REVIEW_SKIP_REASONS = [
  {
    value: 'not_relevant',
    label: 'Not interview-relevant',
    description: 'This problem is unlikely to appear in my target interviews',
    emoji: '🎯'
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Another reason',
    emoji: '💭'
  },
];

const REVIEW_TYPES = new Set(['learning_review', 'triggered_review', 'passive_mastered_review']);

const SkipReasonOption = ({ reason, isSelected, onSelect }) => (
  <button
    className={`skip-reason-option ${isSelected ? 'selected' : ''}`}
    onClick={() => onSelect(reason.value)}
    type="button"
  >
    <span className="skip-reason-emoji">{reason.emoji}</span>
    <div className="skip-reason-text">
      <span className="skip-reason-label">{reason.label}</span>
      <span className="skip-reason-description">{reason.description}</span>
    </div>
  </button>
);

const SkipReasonForm = ({ skipReasons, selectedReason, setSelectedReason, otherText, setOtherText, maxLength, error, onBack, onSubmit, isSubmitting, problemTitle }) => (
  <div className="skip-reason-container">
    <p className="skip-reason-prompt">
      Why are you skipping <strong>{problemTitle}</strong>?
    </p>
    <div className="skip-reason-options">
      {skipReasons.map((reason) => (
        <SkipReasonOption
          key={reason.value}
          reason={reason}
          isSelected={selectedReason === reason.value}
          onSelect={setSelectedReason}
        />
      ))}
    </div>
    {selectedReason === 'other' && (
      <textarea
        className="skip-reason-other-input"
        placeholder="Tell us more (optional)"
        value={otherText}
        onChange={(e) => setOtherText(e.target.value)}
        maxLength={maxLength}
        rows={2}
      />
    )}
    {error && <p className="skip-reason-error">{error}</p>}
    <div className="skip-reason-actions">
      <Button variant="ghost" onClick={onBack} className="skip-reason-cancel-btn">Cancel</Button>
      <Button variant="default" onClick={onSubmit} disabled={!selectedReason || isSubmitting} className="skip-reason-submit-btn">
        {isSubmitting ? 'Skipping...' : 'Skip Problem'}
      </Button>
    </div>
    {selectedReason === 'dont_understand' && (
      <p className="skip-reason-hint">We will try to find an easier related problem to help you understand the concepts.</p>
    )}
    {selectedReason === 'not_relevant' && (
      <p className="skip-reason-hint">This problem will be permanently excluded from future sessions.</p>
    )}
  </div>
);

function SkipReason() {
  const { isAppOpen, setIsAppOpen } = useNav();
  const { shouldRender, isClosing } = useAnimatedClose(isAppOpen);
  const { state: routeState } = useLocation();
  const navigate = useNavigate();

  const [selectedReason, setSelectedReason] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const problemData = routeState?.problemData;
  const problemTitle = problemData?.title || 'this problem';
  const [isReviewProblem, setIsReviewProblem] = useState(false);
  const skipReasons = isReviewProblem ? REVIEW_SKIP_REASONS : SKIP_REASONS;
  const MAX_OTHER_TEXT_LENGTH = 500;

  useEffect(() => {
    const problemId = problemData?.leetcode_id;
    if (!problemId) return;

    chrome.storage.local.get(['session_state'], (result) => {
      const session = result.session_state;
      const sessionProblem = session?.problems?.find(p => p.leetcode_id === problemId);
      setIsReviewProblem(REVIEW_TYPES.has(sessionProblem?.selectionReason?.type));
    });
  }, [problemData?.leetcode_id]);

  const handleClose = () => {
    setIsAppOpen(false);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSubmit = async () => {
    if (!selectedReason || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Sanitize otherText input
      const sanitizedOtherText = selectedReason === 'other'
        ? otherText?.trim().slice(0, MAX_OTHER_TEXT_LENGTH) || null
        : null;

      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "skipProblem",
        leetcodeId: problemData?.leetcode_id,
        problemData: problemData,
        skipReason: selectedReason,
        otherText: sanitizedOtherText,
      });

      logger.info("Skip problem response:", response);

      // Check for error in response
      if (response?.error) {
        setError(response.error);
        setIsSubmitting(false);
        return;
      }

      // Navigate back to generator - the prerequisite (if found) is now in the session
      if (response?.prerequisite && response?.replaced) {
        logger.info("Prerequisite added to session:", response.prerequisite.title);
      }
      // Go back to generator to show updated problem list
      navigate("/Probgen");
    } catch (err) {
      logger.error("Error skipping problem:", err);
      setError("Failed to skip problem. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      id="cm-mySidenav"
      className={`cm-sidenav${isClosing ? ' cm-closing' : ''}`}
    >
      <Header title="Skip Problem" onClose={handleClose} />
      <div className="cm-sidenav__content">
        <SkipReasonForm
          skipReasons={skipReasons}
          selectedReason={selectedReason}
          setSelectedReason={setSelectedReason}
          otherText={otherText}
          setOtherText={setOtherText}
          maxLength={MAX_OTHER_TEXT_LENGTH}
          error={error}
          onBack={handleBack}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          problemTitle={problemTitle}
        />
      </div>
    </div>
  );
}

export default SkipReason;
