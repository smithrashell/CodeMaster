export const NavigationService = {
  navigate(route, time) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs.length) {
          reject("No active tab found");
          return;
        }

        const tab = tabs[0];
        chrome.tabs.sendMessage(
          tab.id,
          { navigate: true, route, time },
          (response) => {
            if (
              chrome.runtime.lastError ||
              !response ||
              response.result !== "success"
            ) {
              reject("Navigation failed");
            } else {
              resolve("Success");
            }
          }
        );
      });
    });
  },
};
