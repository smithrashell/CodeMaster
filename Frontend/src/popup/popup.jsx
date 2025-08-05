// import React from "react";
// import { createRoot } from "react-dom/client";

// function Popup() {
//   return (
//     <div>
//       <h1>Hello, World!</h1>
//       <p>This is a simple popup</p>
//     </div>
//   );
// }
// const domNode = document.getElementById("popup");

// createRoot(domNode).render(<Popup />);
import React from "react";
import { createRoot } from "react-dom/client";

function Popup() {
  const openApp = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
  };

  return (
    <div>
      <button onClick={openApp}>Open Flashcard App</button>
    </div>
  );
}

const root = createRoot(document.getElementById("popup-root"));
root.render(<Popup />);
