import "../../content/css/main.css";
import React from "react";
import { MemoryRouter } from "react-router-dom";

import { PreviousRouteProvider } from "./PreviousRouteProvider";
import { NavProvider } from "./navprovider";
import { getExecutionContext } from "../db/accessControl.js";

// Conditionally import Mantine CSS only when not in content script context
const _executionContext = getExecutionContext();
// Note: Mantine CSS is conditionally loaded via webpack based on context
// Static import here would cause issues in content scripts

import ThemeProviderWrapper from "./themeprovider";
// AppProviders.jsx
export const AppProviders = ({ children }) => {
  console.log("🏗️ DEBUG: AppProviders RENDER", new Date().toISOString());
  
  React.useEffect(() => {
    console.log("🏗️ DEBUG: AppProviders MOUNTED");
    return () => {
      console.log("🗑️ DEBUG: AppProviders UNMOUNTED");
    };
  }, []);

  return (
    <MemoryRouter>
      <ThemeProviderWrapper>
        <PreviousRouteProvider>
          <NavProvider>{children}</NavProvider>
        </PreviousRouteProvider>
      </ThemeProviderWrapper>
    </MemoryRouter>
  );
};
