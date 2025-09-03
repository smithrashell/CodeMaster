import React from 'react';
import styles from './Layout.module.css';

/**
 * Stack - Vertical layout component (replaces Mantine Stack)
 */
export const Stack = ({ children, gap = 'md', ...props }) => {
  const gapClass = gap ? styles[`gap${gap.charAt(0).toUpperCase() + gap.slice(1)}`] : '';
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
  justify = 'start',
  wrap = false,
  ...props 
}) => {
  const gapClass = gap ? styles[`gap${gap.charAt(0).toUpperCase() + gap.slice(1)}`] : '';
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
  withBorder = true,
  shadow = 'sm',
  padding = true,
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