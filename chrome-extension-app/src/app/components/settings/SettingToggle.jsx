import React from "react";
import { Text } from "@mantine/core";

export function SettingToggle({ title, description, category, setting, value, onChange }) {
  const handleChange = (e) => {
    onChange(category, setting, e.target.checked);
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'flex-start', 
      padding: '20px 0',
      borderBottom: '1px solid var(--cm-border)',
      marginBottom: '4px'
    }}>
      <div style={{ flex: 1, marginRight: '20px' }}>
        <Text fw={600} size="md" style={{ color: 'var(--cm-text)', marginBottom: '6px', fontSize: '0.95rem' }}>
          {title}
        </Text>
        <Text size="sm" style={{ color: 'var(--cm-text-secondary)', opacity: 0.7, lineHeight: 1.4 }}>
          {description}
        </Text>
      </div>
      <label 
        style={{ 
          position: 'relative', 
          width: '48px', 
          height: '24px', 
          cursor: 'pointer' 
        }}
        aria-label={`Toggle ${title}`}
      >
        <input
          type="checkbox"
          checked={value}
          onChange={handleChange}
          style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%' }}
        />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '48px',
          height: '24px',
          backgroundColor: value ? 'var(--cm-accent)' : 'var(--cm-border)',
          borderRadius: '12px',
          transition: 'background-color 0.3s ease'
        }}>
          <div style={{
            position: 'absolute',
            top: '2px',
            left: value ? '26px' : '2px',
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            borderRadius: '50%',
            transition: 'left 0.3s ease'
          }} />
        </div>
      </label>
    </div>
  );
}