import { useState, useRef } from 'react';

export const useFloatingHintState = () => {
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [opened, setOpened] = useState(false);
  const [expandedHints, setExpandedHints] = useState(new Set());
  const [hintsUsed, setHintsUsed] = useState(0);
  const buttonRef = useRef(null);

  return {
    hints,
    setHints,
    loading,
    setLoading,
    error,
    setError,
    opened,
    setOpened,
    expandedHints,
    setExpandedHints,
    hintsUsed,
    setHintsUsed,
    buttonRef
  };
};