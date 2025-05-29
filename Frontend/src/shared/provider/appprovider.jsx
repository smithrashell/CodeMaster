
import "../../content/css/main.css";
import React, { useState, useContext, createContext, useEffect } from "react";
import {
  MemoryRouter,
} from "react-router-dom";

import { PreviousRouteProvider } from "./PreviousRouteProvider";
import "@mantine/core/styles.css";
import { NavProvider } from "./navprovider";

import ThemeProviderWrapper from "./themeprovider";
// AppProviders.jsx
export const AppProviders = ({ children }) => (
    <MemoryRouter history={history}>
      <ThemeProviderWrapper>
        <PreviousRouteProvider>
          <NavProvider>
            {children}
          </NavProvider>
        </PreviousRouteProvider>
      </ThemeProviderWrapper>
    </MemoryRouter>
  );
  