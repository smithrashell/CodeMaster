/**
 * WelcomeBackModal - Phase 2: Smart Welcome Back Flow
 *
 * Shows contextual message based on usage gap duration.
 * Gives users options for recalibration approach.
 *
 * Strategy types:
 * - gentle_recal: 30-90 days away (simple message, auto-applies adaptive session)
 * - moderate_recal: 90-365 days (offers 2 choices)
 * - major_recal: 365+ days (offers 3 choices with strong diagnostic recommendation)
 *
 * Refactored to reduce complexity by extracting modal types into separate components.
 */

import React from "react";
import { GentleRecalModal } from "./GentleRecalModal";
import { RecalibrationOptionsModal } from "./RecalibrationOptionsModal";

export function WelcomeBackModal({ opened, onClose, strategy, onConfirm }) {
  // Don't render for null or normal strategy
  if (!strategy || strategy.type === 'normal') {
    return null;
  }

  // Gentle recalibration: Simple welcome with auto-applied adjustments
  if (strategy.type === 'gentle_recal') {
    return (
      <GentleRecalModal
        opened={opened}
        onClose={onClose}
        strategy={strategy}
        onConfirm={onConfirm}
      />
    );
  }

  // Moderate or Major recalibration: Show options for user to choose
  return (
    <RecalibrationOptionsModal
      opened={opened}
      onClose={onClose}
      strategy={strategy}
      onConfirm={onConfirm}
    />
  );
}
