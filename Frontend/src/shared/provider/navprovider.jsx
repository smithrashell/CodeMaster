import React, { createContext, useContext, useState } from "react";

const NavContext = createContext();

export const NavProvider = ({ children }) => {
  const [isAppOpen, setIsAppOpen] = useState(false);
  return (
    <NavContext.Provider value={{ isAppOpen, setIsAppOpen }}>
      {children}
    </NavContext.Provider>
  );
};

// Hook for convenience
export const useNav = () => useContext(NavContext);
