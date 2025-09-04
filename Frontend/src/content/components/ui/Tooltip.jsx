import React, { useState, useRef, useEffect, useCallback } from 'react';
import Portal from './Portal.jsx';

/**
 * Tooltip component - replaces Mantine Tooltip
 * Shows tooltip on hover with smart positioning
 */
const Tooltip = ({ 
  children, 
  label,
  position = 'top',
  disabled = false,
  ...props 
}) => {
  const [visible, setVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const targetRef = useRef(null);
  const tooltipRef = useRef(null);
  
  const calculatePosition = useCallback(() => {
    if (!targetRef.current || !tooltipRef.current) return;
    
    const targetRect = targetRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    let x, y;
    
    switch (position) {
      case 'top':
        x = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        y = targetRect.top - tooltipRect.height - 8;
        break;
      case 'bottom':
        x = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        y = targetRect.bottom + 8;
        break;
      case 'left':
        x = targetRect.left - tooltipRect.width - 8;
        y = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        break;
      case 'right':
        x = targetRect.right + 8;
        y = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        break;
      default:
        x = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        y = targetRect.top - tooltipRect.height - 8;
    }
    
    // Ensure tooltip stays within viewport
    x = Math.max(8, Math.min(x, window.innerWidth - tooltipRect.width - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - tooltipRect.height - 8));
    
    setTooltipPosition({ x, y });
  }, [position]);
  
  const handleMouseEnter = () => {
    if (!disabled) {
      setVisible(true);
    }
  };
  
  const handleMouseLeave = () => {
    setVisible(false);
  };
  
  useEffect(() => {
    if (visible) {
      // Small delay to ensure DOM has updated
      requestAnimationFrame(calculatePosition);
    }
  }, [visible, calculatePosition]);
  
  const tooltipStyle = {
    position: 'fixed',
    left: `${tooltipPosition.x}px`,
    top: `${tooltipPosition.y}px`,
    backgroundColor: '#1a1b1e',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
    zIndex: 1000,
    pointerEvents: 'none',
    maxWidth: '200px',
    wordWrap: 'break-word',
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1)' : 'scale(0.8)',
    transition: 'opacity 0.1s ease, transform 0.1s ease'
  };
  
  return (
    <>
      <div
        ref={targetRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-block' }}
        {...props}
      >
        {children}
      </div>
      
      {visible && label && (
        <Portal>
          <div ref={tooltipRef} style={tooltipStyle}>
            {label}
          </div>
        </Portal>
      )}
    </>
  );
};

export default Tooltip;