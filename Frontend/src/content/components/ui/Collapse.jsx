import React, { useRef, useEffect, useState } from 'react';

/**
 * Collapse component - replaces Mantine Collapse
 * Animates height changes when content is shown/hidden
 */
const Collapse = ({ 
  children, 
  in: isOpen,
  style = {},
  ...props 
}) => {
  const [height, setHeight] = useState(isOpen ? 'auto' : 0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const contentRef = useRef(null);
  
  useEffect(() => {
    if (!contentRef.current) return;
    
    const contentHeight = contentRef.current.scrollHeight;
    
    if (isOpen) {
      setIsTransitioning(true);
      setHeight(contentHeight);
      
      // Set to auto after animation completes
      const timer = setTimeout(() => {
        setHeight('auto');
        setIsTransitioning(false);
      }, 200);
      
      return () => clearTimeout(timer);
    } else {
      // First set explicit height, then animate to 0
      setHeight(contentHeight);
      setIsTransitioning(true);
      
      // Force reflow then animate to 0
      requestAnimationFrame(() => {
        setHeight(0);
      });
      
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);
  
  const collapseStyle = {
    overflow: 'hidden',
    height: height,
    transition: isTransitioning ? 'height 0.2s ease-in-out' : 'none',
    ...style
  };
  
  return (
    <div {...props} style={collapseStyle}>
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  );
};

export default Collapse;