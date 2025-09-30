const configFactory = require("./webpack.config");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const baseConfig = configFactory(env, { mode: "production" });

  // Force production mode
  process.env.NODE_ENV = "production";

  // Add static assets copying
  baseConfig.plugins.push(
    new CopyPlugin({
      patterns: [
        {
          from: "public",
          globOptions: {
            ignore: [
              "**/background*.js", // Ignore all background script files
              "**/background*.js.old", // Ignore backup files
              "**/app.html"
            ],
          }
        },
        {
          from: "src/content/css",
          to: "content/css",
          globOptions: {
            ignore: ["**/*.module.css"],
          },
        },
        {
          from: "src/shared/components/css/timer.css",
          to: "content/css/timer.css",
        },
        {
          from: "src/shared/components/css/timerBanner.css",
          to: "content/css/timerBanner.css",
        },
        { from: "src/app/app.css", to: "app.css" },
        {
          from: "src/shared/constants/LeetCode_Tags_Combined.json",
          to: "LeetCode_Tags_Combined.json",
        },
        {
          from: "src/shared/constants/strategy_data.json",
          to: "strategy_data.json",
        },
      ],
    })
  );

  // Production entry points - NO test utilities
  return {
    ...baseConfig,
    entry: {
      content: "./src/content/content.jsx",
      background: "./src/background/background.production.js", // Clean production background
      app: "./src/app/app.jsx",
    },
    mode: "production",
    optimization: {
      minimize: true, // Enable minification for production
      splitChunks: false, // Disable chunk splitting for Chrome extension
      usedExports: true, // Enable tree shaking
      sideEffects: false,
    },
    devtool: false, // No source maps in production
    performance: {
      hints: "warning", // Show performance warnings in production
      maxAssetSize: 5000000, // 5MB limit for individual assets
      maxEntrypointSize: 5000000,
    },
  };
};