import "../../content/css/main.css";
import React from "react";
import { MemoryRouter } from "react-router-dom";

import { PreviousRouteProvider } from "./PreviousRouteProvider";
import "@mantine/core/styles.css";
import { NavProvider } from "./navprovider";

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
