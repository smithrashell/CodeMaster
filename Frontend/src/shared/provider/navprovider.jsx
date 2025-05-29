import React, { createContext, useContext, useState } from "react";

const NavContext = createContext();

export const NavProvider = ({ children }) => {
  const [toggle, setToggle] = useState(false);
  return (
    <NavContext.Provider value={{ toggle, setToggle }}>
      {children}
    </NavContext.Provider>
  );
};

// Hook for convenience
export const useNav = () => useContext(NavContext);
