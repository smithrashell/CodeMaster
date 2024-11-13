// document.getElementById('generate').addEventListener('click', async () => {
//   const userInput = document.getElementById('userInput').value;
//   chrome.runtime.sendMessage({ action: "generateResponse", message: userInput }, response => {
//     if (response.error) {
//       console.error('Error:', response.error);
//     } else {
//       console.log('Response:', response.data);
//     }
//   });
// });
// popup.js
document.getElementById("openApp").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
});
