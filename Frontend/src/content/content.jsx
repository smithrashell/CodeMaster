import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../hot-reload.js";



// In content.jsx
// content.jsx

// Establish long-lived connection
const port = chrome.runtime.connect({ name: "content-script" });

console.log("🔌 Content script connected to background!");

// OPTIONAL: Listen for future messages if needed
port.onMessage.addListener((message) => {
  if (message.action === "reloadContent") {
    console.log("♻️ Content script reload requested...");
    location.reload(); // Not strictly needed since reinjection auto runs script
  }
});


console.log("🔗 Content script connected!");



// Select the body element
const body = document.querySelector("body");

// Create the app container div if it doesn't exist
let appContainer = document.getElementById("root");
if (!appContainer) {
  appContainer = document.createElement("div");
  appContainer.id = "root";
  appContainer.className = "app-container";
  body.prepend(appContainer);
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
