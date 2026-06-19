import React, { useState, useRef, useEffect } from 'react';

const selectStyles = {
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
  },
  trigger: {
    width: '100%',
    maxWidth: '100%',
    padding: '6px 8px',
    boxSizing: 'border-box',
    backgroundColor: 'var(--cm-card-bg)',
    color: 'var(--cm-text)',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
    backgroundPosition: 'right 8px center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '16px',
    paddingRight: '32px',
    textAlign: 'left',
    display: 'block',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: 'var(--cm-card-bg)',
    border: '1px solid var(--cm-border)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 10000,
    maxHeight: '200px',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  option: {
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    color: 'var(--cm-text)',
    backgroundColor: 'transparent',
    transition: 'background-color 0.15s ease',
    textAlign: 'left',
  },
  optionHovered: { backgroundColor: 'var(--cm-active-blue)', color: 'white' },
  optionSelected: { backgroundColor: 'rgba(37, 99, 235, 0.1)' },
  optionDisabled: { color: 'var(--cm-link-color)', cursor: 'not-allowed', opacity: 0.6 },
};

function getTriggerStyle(error, isOpen) {
  return {
    ...selectStyles.trigger,
    border: error ? '2px solid #ef4444' : '1px solid var(--cm-border)',
    borderColor: isOpen
      ? (error ? '#ef4444' : 'var(--cm-active-blue)')
      : (error ? '#ef4444' : 'var(--cm-border)'),
    boxShadow: isOpen
      ? (error ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : '0 0 0 3px rgba(37, 99, 235, 0.1)')
      : '0 1px 2px rgba(0, 0, 0, 0.05)',
  };
}

function getOptionStyle(isSelected, isFocused, isDisabled) {
  return {
    ...selectStyles.option,
    ...(isSelected && !isFocused ? selectStyles.optionSelected : {}),
    ...(isFocused && !isDisabled ? selectStyles.optionHovered : {}),
    ...(isDisabled ? selectStyles.optionDisabled : {}),
  };
}

function parseOptions(children) {
  return React.Children.toArray(children)
    .filter(child => child.type === 'option')
    .map(child => ({
      value: child.props.value,
      label: child.props.children,
      disabled: child.props.disabled
    }));
}

function handleKeyNav(e, { isOpen, setIsOpen, options, value, focusedIndex, setFocusedIndex, onSelect }) {
  if (!isOpen) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(options.findIndex(opt => String(opt.value) === String(value)));
    }
    return;
  }
  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      setIsOpen(false);
      break;
    case 'ArrowDown':
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1 >= options.length ? 0 : prev + 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 < 0 ? options.length - 1 : prev - 1));
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      if (focusedIndex >= 0 && !options[focusedIndex]?.disabled) {
        onSelect(options[focusedIndex].value);
      }
      break;
    default:
      break;
  }
}

const SelectOption = ({ option, index, value, focusedIndex, onSelect, onHover }) => {
  const isSelected = String(option.value) === String(value);
  const isFocused = index === focusedIndex;
  const isDisabled = option.disabled;
  return (
    <div
      key={option.value}
      role="option"
      tabIndex={isDisabled ? -1 : 0}
      aria-selected={isSelected}
      aria-disabled={isDisabled}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDisabled) onSelect(option.value); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!isDisabled) onSelect(option.value); } }}
      onMouseEnter={() => !isDisabled && onHover(index)}
      style={getOptionStyle(isSelected, isFocused, isDisabled)}
      className="cm-simple-select-option"
    >
      {option.label}
    </div>
  );
};

const SimpleSelect = React.forwardRef(({ value, onChange, children, error, ...props }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const options = parseOptions(children);
  const selectedOption = options.find(opt => String(opt.value) === String(value));
  const displayText = selectedOption?.label || options[0]?.label || 'Select...';

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue }, currentTarget: { value: optionValue }, preventDefault: () => {}, stopPropagation: () => {} });
    setIsOpen(false);
  };

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
    if (!isOpen) setFocusedIndex(options.findIndex(opt => String(opt.value) === String(value)));
  };

  return (
    <div ref={containerRef} style={selectStyles.container} className="cm-simple-select-container">
      <button
        ref={ref}
        type="button"
        onClick={toggleDropdown}
        onKeyDown={(e) => handleKeyNav(e, { isOpen, setIsOpen, options, value, focusedIndex, setFocusedIndex, onSelect: handleSelect })}
        style={getTriggerStyle(error, isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="cm-simple-select"
        {...props}
      >
        {displayText}
      </button>
      {isOpen && (
        <div ref={dropdownRef} style={selectStyles.dropdown} role="listbox" className="cm-simple-select-dropdown">
          {options.map((option, index) => (
            <SelectOption key={option.value} option={option} index={index} value={value} focusedIndex={focusedIndex} onSelect={handleSelect} onHover={setFocusedIndex} />
          ))}
        </div>
      )}
    </div>
  );
});

SimpleSelect.displayName = 'SimpleSelect';

export default SimpleSelect;
