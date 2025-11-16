import React, { useState, useRef, useEffect } from "react";
import { IconHelp, IconBug, IconQuestionMark, IconBook } from "@tabler/icons-react";
import "./FloatingHelpButton.css";

export const FloatingHelpButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleReportBug = () => {
    const repoUrl = "https://github.com/smithrashell/CodeMaster";
    const issueUrl = `${repoUrl}/issues/new?template=bug_report.md`;
    window.open(issueUrl, "_blank");
    setIsOpen(false);
  };

  const handleViewFAQ = () => {
    const dashboardUrl = chrome.runtime.getURL("app.html#/help");
    window.open(dashboardUrl, "_blank");
    setIsOpen(false);
  };

  const handleViewDocs = () => {
    const docsUrl = "https://github.com/smithrashell/CodeMaster/blob/main/README.md";
    window.open(docsUrl, "_blank");
    setIsOpen(false);
  };

  return (
    <div className="cm-floating-help" ref={menuRef}>
      {/* Help Menu Popup */}
      {isOpen && (
        <div className="cm-help-menu">
          <div className="cm-help-menu-header">Help & Support</div>
          <button
            className="cm-help-menu-item"
            onClick={handleReportBug}
            type="button"
          >
            <IconBug size={16} />
            <span>Report a Bug</span>
          </button>
          <button
            className="cm-help-menu-item"
            onClick={handleViewFAQ}
            type="button"
          >
            <IconQuestionMark size={16} />
            <span>View FAQ & Help</span>
          </button>
          <button
            className="cm-help-menu-item"
            onClick={handleViewDocs}
            type="button"
          >
            <IconBook size={16} />
            <span>Documentation</span>
          </button>
        </div>
      )}

      {/* Help Button */}
      <button
        className="cm-help-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Help & Support"
        type="button"
        aria-label="Help & Support"
      >
        <IconHelp size={18} />
      </button>
    </div>
  );
};
