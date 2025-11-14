/**
 * Welcome Back Hook - Phase 2: Smart Welcome Back Flow
 *
 * Handles detection of returning users after usage gaps and shows
 * appropriate recalibration modal based on gap duration.
 */
import { useState, useEffect } from "react";
import ChromeAPIErrorHandler from "../../shared/services/ChromeAPIErrorHandler.js";

export const useWelcomeBack = () => {
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkWelcomeBack = async () => {
      try {
        // Get welcome back strategy from background script
        const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: 'getWelcomeBackStrategy'
        });

        if (response && response.type && response.type !== 'normal') {
          setStrategy(response);
          setShowWelcomeBack(true);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error checking welcome back status:", error);
        setLoading(false);
      }
    };

    checkWelcomeBack();
  }, []);

  const handleConfirm = async (selectedApproach) => {
    try {
      // Record the user's recalibration choice
      await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: 'recordRecalibrationChoice',
        approach: selectedApproach,
        daysSinceLastUse: strategy?.daysSinceLastUse || 0
      });

      setShowWelcomeBack(false);

      // TODO Phase 3/4: Navigate to diagnostic or adaptive session based on choice
      // For now, just close the modal
    } catch (error) {
      console.error("Error recording recalibration choice:", error);
      setShowWelcomeBack(false);
    }
  };

  const handleClose = () => {
    setShowWelcomeBack(false);
  };

  return {
    showWelcomeBack,
    strategy,
    loading,
    handleConfirm,
    handleClose,
  };
};
