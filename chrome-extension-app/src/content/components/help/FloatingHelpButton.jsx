import React, { useState, useRef, useEffect } from "react";
import { IconHelp } from "@tabler/icons-react";
import "./FloatingHelpButton.css";
import { HELP_MENU_ITEMS, executeHelpAction } from "./helpButtonActions";

export const FloatingHelpButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const menuItemsRef = useRef([]);
  const focusedIndexRef = useRef(0);

  // Close menu when clicking outside - fixed memory leak
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          buttonRef.current?.focus();
          break;
        case "ArrowDown":
          event.preventDefault();
          focusedIndexRef.current = (focusedIndexRef.current + 1) % HELP_MENU_ITEMS.length;
          menuItemsRef.current[focusedIndexRef.current]?.focus();
          break;
        case "ArrowUp":
          event.preventDefault();
          focusedIndexRef.current = (focusedIndexRef.current - 1 + HELP_MENU_ITEMS.length) % HELP_MENU_ITEMS.length;
          menuItemsRef.current[focusedIndexRef.current]?.focus();
          break;
        case "Home":
          event.preventDefault();
          focusedIndexRef.current = 0;
          menuItemsRef.current[0]?.focus();
          break;
        case "End":
          event.preventDefault();
          focusedIndexRef.current = HELP_MENU_ITEMS.length - 1;
          menuItemsRef.current[HELP_MENU_ITEMS.length - 1]?.focus();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus management when menu opens
  useEffect(() => {
    if (isOpen) {
      focusedIndexRef.current = 0;
      menuItemsRef.current[0]?.focus();
    }
  }, [isOpen]);

  return (
    <div className="cm-floating-help" ref={menuRef}>
      {/* Help Menu Popup */}
      {isOpen && (
        <div className="cm-help-menu" role="menu" aria-label="Help & Support">
          <div className="cm-help-menu-header">Help & Support</div>
          {HELP_MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.action}
                ref={(el) => (menuItemsRef.current[index] = el)}
                className="cm-help-menu-item"
                onClick={() => executeHelpAction(item.action, () => setIsOpen(false))}
                type="button"
                role="menuitem"
                tabIndex={isOpen ? 0 : -1}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Help Button */}
      <button
        ref={buttonRef}
        className="cm-help-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Help & Support"
        type="button"
        aria-label="Help & Support"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <IconHelp size={18} />
      </button>
    </div>
  );
};
