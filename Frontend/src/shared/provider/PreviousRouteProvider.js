import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { useLocation } from "react-router-dom";

// Create a context to hold the previous route
const PreviousRouteContext = createContext();

export const PreviousRouteProvider = ({ children }) => {
  console.log("🚀 PreviousRouteProvider RENDER", new Date().toISOString());
  const location = useLocation();
  const [previousRoute, setPreviousRoute] = useState(null);
  const previousLocationRef = useRef(location.pathname); // Use a ref to track previous location

  useEffect(() => {
    console.log("📍 PreviousRouteProvider: Location changed", { 
      from: previousLocationRef.current, 
      to: location.pathname 
    });
    // On location change, update previousRoute with the value from ref
    setPreviousRoute(previousLocationRef.current);
    // Update ref to the current location
    previousLocationRef.current = location.pathname;
  }, [location.pathname]);
  
  // Log provider lifecycle
  React.useEffect(() => {
    console.log("🏗️ PreviousRouteProvider MOUNTED");
    return () => {
      console.log("🗑️ PreviousRouteProvider UNMOUNTED");
    };
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => previousRoute, [previousRoute]);

  return (
    <PreviousRouteContext.Provider value={contextValue}>
      {children}
    </PreviousRouteContext.Provider>
  );
};

// Custom hook to use the PreviousRouteContext
export const usePreviousRoute = () => useContext(PreviousRouteContext);
