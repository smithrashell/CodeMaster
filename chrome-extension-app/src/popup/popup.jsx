// import React from "react";
// import { createRoot } from "react-dom/client";

// function Popup() {
//   return (
//     <div>
//       <h1>Hello, World!</h1>
//       <p>This is a simple popup</p>
//     </div>
//   );
// }
// const domNode = document.getElementById("popup");

// createRoot(domNode).render(<Popup />);

import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";

function Popup() {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "checkInstallationOnboardingStatus"
      });
      
      if (response && response.onboardingComplete) {
        setIsReady(true);
      } else {
        // Poll every 500ms until onboarding is complete
        setTimeout(checkOnboardingStatus, 500);
      }
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      // Fallback: assume ready after 5 seconds
      setTimeout(() => setIsReady(true), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const openApp = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
  };

  if (isLoading) {
    return (
      <div style={{ 
        width: '300px', 
        height: '100px', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{ 
          width: '20px', 
          height: '20px', 
          border: '2px solid #f3f3f3',
          borderTop: '2px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          Setting up CodeMaster...
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    );
  }

  if (!isReady) {
    return (
      <div style={{ 
        width: '300px', 
        height: '100px', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{ 
          width: '20px', 
          height: '20px', 
          border: '2px solid #f3f3f3',
          borderTop: '2px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          Preparing your dashboard...
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    );
  }

  return (
    <div style={{ 
      width: '300px', 
      height: '100px', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center' 
    }}>
      <button 
        onClick={openApp}
        style={{
          padding: '10px 20px',
          backgroundColor: '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        Open Dashboard
      </button>
    </div>
  );
}

const root = createRoot(document.getElementById("popup-root"));
root.render(<Popup />);
