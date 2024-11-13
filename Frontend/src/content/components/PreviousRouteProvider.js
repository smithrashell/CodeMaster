import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Create a context to hold the previous route
const PreviousRouteContext = createContext();

export const PreviousRouteProvider = ({ children }) => {
  const location = useLocation();
  const [previousRoute, setPreviousRoute] = useState(null);
  const previousLocationRef = useRef(location.pathname); // Use a ref to track previous location

  useEffect(() => {
    // On location change, update previousRoute with the value from ref
    setPreviousRoute(previousLocationRef.current);
    // Update ref to the current location
    previousLocationRef.current = location.pathname;
  }, [location.pathname]);

  return (
    <PreviousRouteContext.Provider value={previousRoute}>
      {children}
    </PreviousRouteContext.Provider>
  );
};

// Custom hook to use the PreviousRouteContext
export const usePreviousRoute = () => useContext(PreviousRouteContext);

