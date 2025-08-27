import React from 'react';

/**
 * SimpleSelect - A reusable, styled select component for Chrome extension content scripts
 * 
 * Features:
 * - Uses native HTML <select> for maximum compatibility
 * - Styled with CSS variables for theme consistency  
 * - Supports React.forwardRef for form libraries
 * - Custom dropdown arrow styling
 * - Focus and error states
 * - Lightweight alternative to complex UI libraries
 * 
 * @param {Object} props
 * @param {string} props.value - Current selected value
 * @param {Function} props.onChange - Change handler function
 * @param {ReactNode} props.children - Option elements
 * @param {boolean} props.error - Whether to show error state styling
 * @param {...*} props.props - Additional props passed to select element
 * @param {Ref} ref - Forwarded ref for form libraries
 */
const SimpleSelect = React.forwardRef(({ value, onChange, children, error, ...props }, ref) => (
  <select
    ref={ref}
    value={value}
    onChange={onChange}
    className="cm-simple-select"
    style={{
      width: '100%',
      maxWidth: '100%',
      padding: '6px 8px',
      boxSizing: 'border-box',
      backgroundColor: 'var(--cm-card-bg)',
      color: 'var(--cm-text)',
      border: error ? '2px solid #ef4444' : '1px solid var(--cm-border)',
      borderRadius: '6px',
      fontSize: '13px',
      outline: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      appearance: 'none', // Remove default styling
      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
      backgroundPosition: 'right 8px center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: '16px',
      paddingRight: '32px'
    }}
    onFocus={(e) => {
      e.target.style.borderColor = error ? '#ef4444' : 'var(--cm-active-blue)';
      e.target.style.boxShadow = error 
        ? '0 0 0 3px rgba(239, 68, 68, 0.1)' 
        : '0 0 0 3px rgba(37, 99, 235, 0.1)';
    }}
    onBlur={(e) => {
      e.target.style.borderColor = error ? '#ef4444' : 'var(--cm-border)';
      e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
    }}
    {...props}
  >
    {children}
  </select>
));

SimpleSelect.displayName = 'SimpleSelect';

export default SimpleSelect;