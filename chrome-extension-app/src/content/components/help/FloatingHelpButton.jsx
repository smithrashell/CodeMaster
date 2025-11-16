import React, { useState, useRef, useEffect } from "react";
import { IconHelp, IconBug, IconQuestionMark, IconBook } from "@tabler/icons-react";
import "./FloatingHelpButton.css";

export const FloatingHelpButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const menuItemsRef = useRef([]);
  const focusedIndexRef = useRef(0);

  const menuItems = [
    { icon: IconBug, label: "Report a Bug", action: "reportBug" },
    { icon: IconQuestionMark, label: "View FAQ & Help", action: "viewFAQ" },
    { icon: IconBook, label: "Documentation", action: "viewDocs" },
  ];

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
          focusedIndexRef.current = (focusedIndexRef.current + 1) % menuItems.length;
          menuItemsRef.current[focusedIndexRef.current]?.focus();
          break;
        case "ArrowUp":
          event.preventDefault();
          focusedIndexRef.current = (focusedIndexRef.current - 1 + menuItems.length) % menuItems.length;
          menuItemsRef.current[focusedIndexRef.current]?.focus();
          break;
        case "Home":
          event.preventDefault();
          focusedIndexRef.current = 0;
          menuItemsRef.current[0]?.focus();
          break;
        case "End":
          event.preventDefault();
          focusedIndexRef.current = menuItems.length - 1;
          menuItemsRef.current[menuItems.length - 1]?.focus();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, menuItems.length]);

  // Focus management when menu opens
  useEffect(() => {
    if (isOpen) {
      focusedIndexRef.current = 0;
      menuItemsRef.current[0]?.focus();
    }
  }, [isOpen]);

  const handleReportBug = () => {
    const repoUrl = "https://github.com/smithrashell/CodeMaster";
    const issueUrl = `${repoUrl}/issues/new?template=bug_report.md`;
    const newWindow = window.open(issueUrl, "_blank", "noopener,noreferrer");
    if (newWindow) newWindow.opener = null;
    setIsOpen(false);
  };

  const handleViewFAQ = () => {
    const dashboardUrl = chrome.runtime.getURL("app.html#/help");
    const newWindow = window.open(dashboardUrl, "_blank", "noopener,noreferrer");
    if (newWindow) newWindow.opener = null;
    setIsOpen(false);
  };

  const handleViewDocs = () => {
    const docsUrl = "https://github.com/smithrashell/CodeMaster/blob/main/README.md";
    const newWindow = window.open(docsUrl, "_blank", "noopener,noreferrer");
    if (newWindow) newWindow.opener = null;
    setIsOpen(false);
  };

  const handleMenuItemClick = (action) => {
    const actions = {
      reportBug: handleReportBug,
      viewFAQ: handleViewFAQ,
      viewDocs: handleViewDocs,
    };
    actions[action]();
  };

  return (
    <div className="cm-floating-help" ref={menuRef}>
      {/* Help Menu Popup */}
      {isOpen && (
        <div className="cm-help-menu" role="menu" aria-label="Help & Support">
          <div className="cm-help-menu-header">Help & Support</div>
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.action}
                ref={(el) => (menuItemsRef.current[index] = el)}
                className="cm-help-menu-item"
                onClick={() => handleMenuItemClick(item.action)}
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
