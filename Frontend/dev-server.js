const WebSocket = require("ws");
const chokidar = require("chokidar");

const wss = new WebSocket.Server({ port: 9090 });

wss.on("connection", (ws) => {
  console.log("🔌 Extension connected to dev server");
});

chokidar.watch(["src/**/*", "public/**/*"]).on("change", (filePath) => {
  console.log(`📄 File changed: ${filePath}`);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      console.log("♻️ Broadcasting reload to all connected clients...");
      client.send("reload");
    }
  });
});
