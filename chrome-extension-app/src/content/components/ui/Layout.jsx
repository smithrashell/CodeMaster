import React from 'react';
import styles from './Layout.module.css';

/**
 * Stack - Vertical layout component (replaces Mantine Stack)
 */
export const Stack = ({ children, gap = 'md', spacing, ...props }) => {
  // Use spacing if provided, otherwise fall back to gap  
  const finalGap = spacing || gap;
  const gapClass = finalGap ? styles[`gap${finalGap.charAt(0).toUpperCase() + finalGap.slice(1)}`] : '';
  const className = [styles.stack, gapClass, props.className].filter(Boolean).join(' ');
  
  return (
    <div {...props} className={className}>
      {children}
    </div>
  );
};

/**
 * Group - Horizontal layout component (replaces Mantine Group) 
 */
export const Group = ({ 
  children, 
  gap = 'md', 
  spacing, // Mantine spacing prop (equivalent to gap)
  justify = 'start',
  wrap = false,
  ...props 
}) => {
  // Use spacing if provided, otherwise fall back to gap
  const finalGap = spacing || gap;
  const gapClass = finalGap ? styles[`gap${finalGap.charAt(0).toUpperCase() + finalGap.slice(1)}`] : '';
  const justifyClass = justify !== 'start' ? styles[`justify${justify.charAt(0).toUpperCase() + justify.slice(1)}`] : '';
  const wrapClass = wrap ? styles.wrapItems : '';
  
  const className = [
    styles.group, 
    gapClass, 
    justifyClass, 
    wrapClass, 
    props.className
  ].filter(Boolean).join(' ');
  
  return (
    <div {...props} className={className}>
      {children}
    </div>
  );
};

/**
 * Card - Container component (replaces Mantine Card)
 */
export const Card = ({ 
  children, 
  shadow = 'sm',
  padding = true,
  withBorder, // Accept and ignore Mantine-specific prop
  radius, // Accept and ignore Mantine-specific prop
  p, // Accept and ignore Mantine shorthand padding prop
  bg, // Accept and ignore Mantine background prop
  ...props 
}) => {
  const shadowClass = shadow ? styles[`shadow${shadow.charAt(0).toUpperCase() + shadow.slice(1)}`] : '';
  const paddingClass = padding ? styles.withPadding : '';
  
  const className = [
    styles.card,
    shadowClass,
    paddingClass,
    props.className
  ].filter(Boolean).join(' ');
  
  return (
    <div {...props} className={className}>
      {children}
    </div>
  );
};

/**
 * Box - Generic container (replaces Mantine Box)
 */
export const Box = ({ children, ...props }) => {
  const className = [styles.box, props.className].filter(Boolean).join(' ');
  
  return (
    <div {...props} className={className}>
      {children}
    </div>
  );
};