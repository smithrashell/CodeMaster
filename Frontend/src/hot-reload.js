if (process.env.NODE_ENV === "development") {
  try {
    const ws = new WebSocket("ws://localhost:9090");
    ws.onopen = () => console.log("🟢 Hot-reload WebSocket connected");

    ws.onmessage = (msg) => {
      if (msg.data === "reload") {
        console.log("🔄 Reloading extension...");

        // Ask background to handle reload & reinject
        chrome.runtime.sendMessage({ action: "forceReload" });
      }
    };
  } catch (error) {
    console.warn("WebSocket connection failed:", error);
  }
}
