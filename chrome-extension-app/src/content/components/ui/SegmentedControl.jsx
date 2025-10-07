import React from 'react';
import styles from './SegmentedControl.module.css';

/**
 * Custom SegmentedControl component to replace Mantine SegmentedControl
 */
const SegmentedControl = ({ 
  value, 
  onChange, 
  data = [], 
  options = [], // Support both 'data' and 'options' props 
  size = "sm", 
  color, // Remove default, let theme handle it
  variant = "default", // "default" or "gradient"
  style = {},
  ...props 
}) => {
  // Use options if provided, otherwise use data
  const items = options.length > 0 ? options : data;
  const getButtonClasses = (item, isActive) => {
    const classes = [styles.button];
    
    if (isActive) {
      classes.push(styles.active);
      if (variant === 'gradient') {
        classes.push(styles.gradient);
      }
    }
    
    if (item.disabled) {
      classes.push(styles.disabled);
    }
    
    classes.push(styles[size]);
    
    return classes.join(' ');
  };

  const containerClasses = [styles.container];
  if (variant === 'gradient') {
    containerClasses.push(styles.gradient);
  }

  return (
    <div className={containerClasses.join(' ')} style={style} {...props}>
      {items.map((item, index) => {
        const isActive = value === item.value;
        
        return (
          <button
            key={item.value || index}
            className={getButtonClasses(item, isActive)}
            onClick={() => {
              if (!item.disabled && onChange) {
                onChange(item.value);
              }
            }}
            disabled={item.disabled}
            title={item.description}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;