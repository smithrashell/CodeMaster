import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// In content.jsx
// content.jsx

// Select the body element
const body = document.querySelector("body");

// Create the app container div if it doesn't exist
let appContainer = document.getElementById("root");
if (!appContainer) {
  appContainer = document.createElement("div");
  appContainer.id = "root";
  appContainer.className = "app-container cd-extension";
  body.prepend(appContainer);
  console.info("container appended")
} else {
  // Add cd-extension class to existing container
  appContainer.classList.add("cd-extension");
}

// create root once
let root = null;
const initializeRoot = () => {
  if (!root) {
    const container = document.getElementById("root");
    root = createRoot(container);
  }
};

// Function to render the React app
const renderApp = () => {
  initializeRoot();
  root.render(<App />);
};

renderApp();
