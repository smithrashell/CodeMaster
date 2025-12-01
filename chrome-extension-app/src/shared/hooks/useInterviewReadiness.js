import { useState, useEffect } from "react";
import { debug, component, fallback } from "../utils/logging/logger.js";

/**
 * Hook for checking interview mode readiness and capabilities
 * Used by both content script settings and app dashboard settings
 * 
 * @param {Object} settings - Current user settings object
 * @returns {Object} Interview readiness state and capabilities
 */
export function useInterviewReadiness(settings) {
  const [readiness, setReadiness] = useState({
    interviewLikeUnlocked: true, // Default to true for better UX
    fullInterviewUnlocked: true, // Default to true for better UX
    reasoning: "Loading interview capabilities..."
  });

  useEffect(() => {
    const checkReadiness = () => {
      component("useInterviewReadiness", "🎯 Checking interview readiness", { hasSettings: !!settings });
      
      try {
        if (typeof chrome !== "undefined" && chrome.runtime) {
          debug("🎯 useInterviewReadiness - Chrome runtime available, sending message");
          
          // Set timeout to prevent hanging
          const timeout = setTimeout(() => {
            fallback("🎯 useInterviewReadiness - Interview readiness check timed out, using fallback");
            setReadiness({
              interviewLikeUnlocked: true,
              fullInterviewUnlocked: true,
              reasoning: "Timeout - interview features available"
            });
          }, 3000);
          
          chrome.runtime.sendMessage(
            { type: "getInterviewReadiness" },
            (response) => {
              clearTimeout(timeout);
              debug("🎯 useInterviewReadiness - Interview readiness response", { response, error: chrome.runtime.lastError });
              if (response && !chrome.runtime.lastError) {
                setReadiness(response);
              } else {
                fallback("🎯 useInterviewReadiness - Using development fallback for interview readiness");
                setReadiness({
                  interviewLikeUnlocked: true, // Allow testing
                  fullInterviewUnlocked: true, // Allow testing
                  reasoning: "Development mode - all modes unlocked"
                });
              }
            }
          );
        } else {
          fallback("🎯 useInterviewReadiness - Chrome runtime not available, using fallback");
          setReadiness({
            interviewLikeUnlocked: true,
            fullInterviewUnlocked: true,
            reasoning: "Chrome runtime not available - fallback mode"
          });
        }
      } catch (error) {
        fallback("🎯 useInterviewReadiness - Error checking readiness", { error });
        setReadiness({
          interviewLikeUnlocked: true,
          fullInterviewUnlocked: true,
          reasoning: "Error occurred - fallback mode"
        });
      }
    };

    if (settings) {
      checkReadiness();
    }
  }, [settings]);

  return readiness;
}