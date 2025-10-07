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
  const previousLocationRef = useRef(null); // Start with null to properly track first navigation
  const isFirstRender = useRef(true);

  useEffect(() => {
    console.log("📍 PreviousRouteProvider: Location changed", {
      from: previousLocationRef.current,
      to: location.pathname,
      isFirstRender: isFirstRender.current,
      updatingPreviousRouteTo: previousLocationRef.current
    });

    if (isFirstRender.current) {
      // On first render, just set the current location without updating previousRoute
      console.log("📍 PreviousRouteProvider: First render, setting initial location", location.pathname);
      previousLocationRef.current = location.pathname;
      isFirstRender.current = false;
    } else {
      // On subsequent changes, update previousRoute with the value from ref
      console.log("📍 PreviousRouteProvider: Subsequent navigation, updating previousRoute", {
        from: previousLocationRef.current,
        to: location.pathname
      });
      setPreviousRoute(previousLocationRef.current);
      // Update ref to the current location
      previousLocationRef.current = location.pathname;
    }

    console.log("📍 PreviousRouteProvider: State updated", {
      previousRouteState: previousLocationRef.current,
      currentLocation: location.pathname
    });
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
