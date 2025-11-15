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
    let isMounted = true;

    const checkWelcomeBack = async () => {
      try {
        // Get welcome back strategy from background script
        const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: 'getWelcomeBackStrategy'
        });

        // Only update state if component is still mounted
        if (!isMounted) return;

        if (response && response.type && response.type !== 'normal') {
          setStrategy(response);
          setShowWelcomeBack(true);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error checking welcome back status:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkWelcomeBack();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfirm = async (selectedApproach) => {
    try {
      // Record the user's recalibration choice
      await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: 'recordRecalibrationChoice',
        approach: selectedApproach,
        daysSinceLastUse: strategy?.daysSinceLastUse || 0
      });

      // Phase 3: Handle diagnostic session creation
      if (selectedApproach === 'diagnostic') {
        const result = await ChromeAPIErrorHandler.sendMessageWithRetry({
          type: 'createDiagnosticSession',
          problemCount: 5,
          daysSinceLastUse: strategy?.daysSinceLastUse || 0
        });

        if (result.status === 'success') {
          console.log(`✅ Diagnostic session created with ${result.problemCount} problems`);

          // Show user instructions to go to LeetCode
          // TODO Phase 3.5: Show a notification/modal with instructions
          // For now, just log and close the modal
        }
      }

      setShowWelcomeBack(false);

      // TODO Phase 4: Navigate to adaptive session based on choice
    } catch (error) {
      console.error("Error recording recalibration choice:", error);
      setShowWelcomeBack(false);
    }
  };

  const handleClose = async () => {
    try {
      // Store dismissal with timestamp to prevent modal from re-showing
      await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: 'dismissWelcomeBack',
        timestamp: new Date().toISOString(),
        daysSinceLastUse: strategy?.daysSinceLastUse || 0
      });
      setShowWelcomeBack(false);
    } catch (error) {
      console.error("Error dismissing welcome back modal:", error);
      setShowWelcomeBack(false); // Still close on error
    }
  };

  return {
    showWelcomeBack,
    strategy,
    loading,
    handleConfirm,
    handleClose,
  };
};
