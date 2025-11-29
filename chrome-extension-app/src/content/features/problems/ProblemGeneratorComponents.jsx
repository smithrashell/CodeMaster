/**
 * Problem Generator UI Components
 * Extracted from ProblemGenerator.jsx
 */

import logger from "../../../shared/utils/logger.js";
import { getModeDisplay } from "./ProblemGeneratorHelpers.js";
import { ProblemsList } from "./ProblemGeneratorItems.jsx";

/**
 * Session Regeneration Banner Component
 */
export const SessionRegenerationBanner = ({ onRegenerateSession }) => {
  return (
    <div className="cm-session-regeneration-banner" style={{
      backgroundColor: 'rgba(251, 146, 60, 0.1)',
      border: '2px solid #f59e0b',
      borderRadius: '8px',
      padding: '10px 10px',
      margin: '0 0 16px 0',
      display: 'flex',
      flexDirection: "column",
      alignItems: 'center',
      gap: '16px',
      minWidth: '300px'
    }}>
      <div style={{
        flex: 1,
        minWidth: '200px',
        maxWidth: 'none'
      }}>
        <div style={{
          fontWeight: 'bold',
          color: '#f59e0b',
          fontSize: '14px',
          marginBottom: '6px',
          lineHeight: '1.2',
          whiteSpace: 'nowrap'
        }}>
          Session Inactive
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--cm-text-secondary, #888)',
          lineHeight: '1.5',
          marginBottom: '2px',
          wordWrap: 'break-word',
          overflowWrap: 'normal'
        }}>
          Your session has been inactive.
          Generate fresh problems?
        </div>
      </div>
      <button
        onClick={onRegenerateSession}
        style={{
          padding: '8px 14px',
          backgroundColor: '#f59e0b',
          border: 'none',
          borderRadius: '6px',
          color: 'white',
          fontSize: '12px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
        onMouseOver={(e) => { e.target.style.backgroundColor = '#d97706'; }}
        onFocus={(e) => { e.target.style.backgroundColor = '#d97706'; }}
        onMouseOut={(e) => { e.target.style.backgroundColor = '#f59e0b'; }}
        onBlur={(e) => { e.target.style.backgroundColor = '#f59e0b'; }}
      >
        Generate New Session
      </button>
    </div>
  );
};

/**
 * Interview Mode Banner Component
 */
export const InterviewModeBanner = ({ session_type, interviewConfig: _interviewConfig }) => {
  if (!session_type || session_type === 'standard') return null;

  const modeDisplay = getModeDisplay(session_type);

  return (
    <div className="cm-interview-mode-banner" style={{
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      border: `2px solid ${modeDisplay.color}`,
      borderRadius: '8px',
      padding: '12px 16px',
      margin: '0 0 16px 0',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <span style={{ fontSize: '20px' }}>{modeDisplay.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: 'bold',
          color: modeDisplay.color,
          fontSize: '14px',
          marginBottom: '2px'
        }}>
          {modeDisplay.title}
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--cm-text-secondary, #888)',
          lineHeight: '1.3'
        }}>
          {modeDisplay.description}
        </div>
      </div>
    </div>
  );
};

/**
 * Loading State Component
 */
export const LoadingState = ({ settingsLoading, isRegenerating, settingsLoaded, sessionLoading, settings }) => (
  <div style={{
    textAlign: 'center',
    padding: '20px',
    color: 'var(--cm-text-secondary)'
  }}>
    {settingsLoading ? 'Loading settings...' : isRegenerating ? 'Regenerating session...' : 'Loading session...'}
    {settingsLoaded && (sessionLoading || isRegenerating) && (
      <div style={{
        fontSize: '12px',
        marginTop: '8px',
        opacity: 0.7
      }}>
        {isRegenerating ? 'Creating fresh problems...' : `Using ${settings?.interviewMode === 'disabled' ? 'standard' : settings?.interviewMode || 'standard'} mode`}
      </div>
    )}
  </div>
);

/**
 * Empty State Component
 */
export const EmptyState = ({ _settingsLoaded, _sessionLoading }) => (
  <div role="status" aria-live="polite" style={{
    textAlign: 'center',
    padding: '20px',
    color: 'var(--cm-text-secondary)'
  }}>
    <p style={{ marginBottom: '16px' }}>No problems found. Please generate a new session.</p>

    <div style={{
      fontSize: '12px',
      backgroundColor: 'rgba(96, 125, 139, 0.05)',
      padding: '12px',
      borderRadius: '6px',
      border: '1px solid rgba(96, 125, 139, 0.1)'
    }}>
      <div style={{ marginBottom: '8px', fontWeight: '500' }}>
        Troubleshooting Tips:
      </div>
      <div style={{ lineHeight: '1.4', textAlign: 'left' }}>
        • If this persists, try refreshing the page<br/>
        • Check if interview mode settings match your needs<br/>
        • Extension restart may help if Chrome API issues occur
      </div>
    </div>
  </div>
);

/**
 * Interview Choice Banner Component
 */
export const InterviewChoiceBanner = ({ sessionLoading, handleInterviewChoice, handleRegularChoice }) => (
  <div style={{
    backgroundColor: 'rgba(96, 125, 139, 0.08)',
    width: '100%',
    margin: '16px 0',
    color: 'var(--cm-text)',
    border: '1px solid rgba(96, 125, 139, 0.15)'
  }}>
    <div style={{ textAlign: 'center', padding: '16px' }}>
      <p style={{
        margin: 0,
        fontSize: '14px',
        fontWeight: '500',
        color: 'var(--cm-text)',
        opacity: 0.9
      }}>
        In interview-like mode, would you like to start an interview session?
      </p>
    </div>

    {sessionLoading ? (
      <div style={{
        textAlign: 'center',
        padding: '16px',
        fontSize: '14px',
        color: 'var(--cm-text)',
        opacity: 0.7
      }}>
        Creating session...
      </div>
    ) : (
      <div style={{ display: 'flex', width: '100%' }}>
        <button
          onClick={handleInterviewChoice}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            border: 'none',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => { e.target.style.backgroundColor = 'rgba(59, 130, 246, 1)'; }}
          onFocus={(e) => { e.target.style.backgroundColor = 'rgba(59, 130, 246, 1)'; }}
          onMouseOut={(e) => { e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.9)'; }}
          onBlur={(e) => { e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.9)'; }}
        >
          Yes
        </button>

        <button
          onClick={handleRegularChoice}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: 'rgba(107, 114, 128, 0.8)',
            border: 'none',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => { e.target.style.backgroundColor = 'rgba(107, 114, 128, 0.9)'; }}
          onFocus={(e) => { e.target.style.backgroundColor = 'rgba(107, 114, 128, 0.9)'; }}
          onMouseOut={(e) => { e.target.style.backgroundColor = 'rgba(107, 114, 128, 0.8)'; }}
          onBlur={(e) => { e.target.style.backgroundColor = 'rgba(107, 114, 128, 0.8)'; }}
        >
          No
        </button>
      </div>
    )}
  </div>
);

/**
 * Main content renderer component
 */
export const ProblemGeneratorContent = ({
  sessionData,
  showRegenerationBanner,
  handleRegenerateSession,
  settingsLoading,
  settingsLoaded,
  sessionLoading,
  isRegenerating,
  problems,
  showInterviewBanner,
  settings,
  handleInterviewChoice,
  handleRegularChoice,
  onLinkClick
}) => (
  <>
    <InterviewModeBanner
      session_type={sessionData?.session_type}
      interviewConfig={sessionData?.interviewConfig}
    />

    {logger.info("Render check - showRegenerationBanner:", showRegenerationBanner, "sessionData:", sessionData?.id?.substring(0,8))}
    {showRegenerationBanner && (
      <SessionRegenerationBanner onRegenerateSession={handleRegenerateSession} />
    )}

    {logger.info("Render Decision Point:", {
      settingsLoading,
      settingsLoaded,
      sessionLoading,
      isRegenerating,
      problemsLength: problems.length,
      showInterviewBanner,
      settingsState: {
        interviewMode: settings?.interviewMode,
        interviewFrequency: settings?.interviewFrequency
      }
    })}

    {settingsLoading || (settingsLoaded && sessionLoading) || isRegenerating ? (
      <LoadingState
        settingsLoading={settingsLoading}
        isRegenerating={isRegenerating}
        settingsLoaded={settingsLoaded}
        sessionLoading={sessionLoading}
        settings={settings}
      />
    ) : problems.length > 0 ? (
      <ProblemsList
        problems={problems}
        sessionData={sessionData}
        onLinkClick={onLinkClick}
      />
    ) : showInterviewBanner ? (
      <InterviewChoiceBanner
        sessionLoading={sessionLoading}
        handleInterviewChoice={handleInterviewChoice}
        handleRegularChoice={handleRegularChoice}
      />
    ) : settingsLoaded && !sessionLoading ? (
      <EmptyState
        settingsLoaded={settingsLoaded}
        sessionLoading={sessionLoading}
      />
    ) : null}
  </>
);
