import React, { createContext, useContext, useState, useMemo, useCallback } from "react";

const NavContext = createContext();

export const NavProvider = ({ children }) => {
  console.log("🏗️ NavProvider RENDER", new Date().toISOString());
  const [isAppOpen, setIsAppOpen] = useState(false);
  
  // Properly memoize the setter function to prevent re-renders
  const memoizedSetIsAppOpen = useCallback((value) => {
    setIsAppOpen(prevValue => {
      console.log("🔧 NavProvider: setState called", { oldValue: prevValue, newValue: value });
      return typeof value === 'function' ? value(prevValue) : value;
    });
  }, []); // Empty deps array - function is stable
  
  // Stabilize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    isAppOpen,
    setIsAppOpen: memoizedSetIsAppOpen
  }), [isAppOpen, memoizedSetIsAppOpen]);
  
  // Log provider lifecycle
  React.useEffect(() => {
    console.log("🏗️ NavProvider MOUNTED");
    return () => {
      console.log("🗑️ NavProvider UNMOUNTED");
    };
  }, []);
  
  return (
    <NavContext.Provider value={contextValue}>
      {children}
    </NavContext.Provider>
  );
};

// Hook for convenience
export const useNav = () => {
  const context = useContext(NavContext);
  
  if (!context) {
    throw new Error('useNav must be used within a NavProvider');
  }
  
  return context;
};
