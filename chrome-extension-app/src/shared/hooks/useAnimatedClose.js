import { useState, useEffect } from 'react';
import { SIDEBAR_CLOSE_DURATION_MS } from '../constants/animations';

/**
 * Custom hook to handle animated closing of sidebars
 * Returns the current visibility state and closing state for animations
 *
 * @param {boolean} isOpen - Whether the sidebar should be open
 * @param {number} animationDuration - Duration of the closing animation in ms (default: from constants)
 * @returns {Object} { shouldRender, isClosing }
 */
export const useAnimatedClose = (isOpen, animationDuration = SIDEBAR_CLOSE_DURATION_MS) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    let timer = null;

    if (isOpen) {
      // Opening: render immediately and clear any pending close animation
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      // Closing: Only animate if we're currently rendering (transitioning from open to closed)
      // Don't animate if starting closed (shouldRender is already false)
      setIsClosing(true);
      timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, animationDuration);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isOpen, animationDuration, shouldRender]);

  return { shouldRender, isClosing };
};
