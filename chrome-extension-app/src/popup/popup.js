// popup.js
document.getElementById("openApp").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
});
