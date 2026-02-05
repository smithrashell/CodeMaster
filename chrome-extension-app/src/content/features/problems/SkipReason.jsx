import { useState } from "react";
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

function SkipReason() {
  const { isAppOpen, setIsAppOpen } = useNav();
  const { shouldRender, isClosing } = useAnimatedClose(isAppOpen);
  const { state: routeState } = useLocation();
  const navigate = useNavigate();

  const [selectedReason, setSelectedReason] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const problemData = routeState?.problemData;
  const problemTitle = problemData?.title || 'this problem';

  const handleClose = () => {
    setIsAppOpen(false);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSubmit = async () => {
    if (!selectedReason || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "skipProblem",
        leetcodeId: problemData?.leetcode_id,
        problemData: problemData,
        skipReason: selectedReason,
        otherText: selectedReason === 'other' ? otherText : null,
      });

      logger.info("Skip problem response:", response);

      // Navigate back to generator - the prerequisite (if found) is now in the session
      if (response?.prerequisite && response?.replaced) {
        logger.info("Prerequisite added to session:", response.prerequisite.title);
      }
      // Always go back to generator to show updated problem list
      navigate("/Probgen");
    } catch (error) {
      logger.error("Error skipping problem:", error);
      // Still navigate away on error
      navigate("/Probgen");
    } finally {
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
        <div className="skip-reason-container">
          <p className="skip-reason-prompt">
            Why are you skipping <strong>{problemTitle}</strong>?
          </p>

          <div className="skip-reason-options">
            {SKIP_REASONS.map((reason) => (
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
              rows={2}
            />
          )}

          <div className="skip-reason-actions">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="skip-reason-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              className="skip-reason-submit-btn"
            >
              {isSubmitting ? 'Skipping...' : 'Skip Problem'}
            </Button>
          </div>

          {selectedReason === 'dont_understand' && (
            <p className="skip-reason-hint">
              We will try to find an easier related problem to help you understand the concepts.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SkipReason;
