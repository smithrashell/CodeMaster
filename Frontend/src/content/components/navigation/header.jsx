// HeaderWithClose.jsx
import { Title } from "@mantine/core";
import { useNav } from "../../../shared/provider/navprovider";
export default function Header({ title, onClose }) {
  const { isAppOpen, setIsAppOpen } = useNav();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsAppOpen(!isAppOpen);
    }
  };

  const styles = {
    header: {
      width: "90%",
      justifyContent: "space-between",
      display: "flex",
      alignItems: "center",
      margin: "2px 0px 4px 35px",
      backgroundColor: "var(--cm-bg)",
      borderBottom: "1px solid var(--cm-dropdown-bg)",
      position: "relative",
      zIndex: 10,
      marginBottom: "4px",
    },
    titleContainer: {
      flex: 1,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      // paddingLeft: '50px', // Reduced space for CM icon
      // paddingRight: '50px', // Balanced padding for X button
      height: "36px", // Match button height for consistent alignment
    },
    title: {
      fontSize: "18px",
      fontWeight: "600",
      color: "var(--cm-text)",
      margin: 0,
      textAlign: "center",
      lineHeight: "1.2",
      display: "flex",
      alignItems: "center",
      height: "36px", // Match the close button height for perfect alignment
    },
    closeButton: {
      height: "44px" /* Increased for WCAG AA touch target */,
      width: "44px" /* Increased for WCAG AA touch target */,
      backgroundColor: "transparent",
      color: "var(--cm-text)",
      opacity: "0.7",
      borderRadius: "6px",
      border: "none",
      transition: "all 0.2s ease",
      flexShrink: 0,
      marginRight: "8px", // Ensure it's not cut off at the edge
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    },
    closeIcon: {
      fontSize: "20px",
      fontWeight: "normal",
      lineHeight: "1",
      color: "inherit",
    },
  };
  return (
    <header style={styles.header} role="banner">
      <a href="#main-content" className="cd-extension skip-to-content">
        Skip to main content
      </a>
      <div style={styles.titleContainer}>
        <Title order={1} style={styles.title} id="main-heading">
          {title}
        </Title>
      </div>
      <button
        onClick={handleClose}
        style={styles.closeButton}
        aria-label={`Close ${title} panel`}
        title={`Close ${title} panel`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            handleClose();
          }
        }}
      >
        <div style={styles.closeIcon} aria-hidden="true">
          ×
        </div>
      </button>
    </header>
  );
}
