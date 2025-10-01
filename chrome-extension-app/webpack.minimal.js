const configFactory = require("./webpack.config");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const baseConfig = configFactory(env, { mode: "production" });

  // Determine if development mode (same logic as webpack.config.js)
  const isUsingDevConfig = process.env.npm_lifecycle_script && process.env.npm_lifecycle_script.includes('webpack.dev');
  const isDev = argv.mode === "development" || isUsingDevConfig;

  // Add static assets copying
  baseConfig.plugins.push(
    new CopyPlugin({
      patterns: [
        {
          from: "public",
          globOptions: {
            ignore: ["**/background.js", "**/app.html"], // Exclude background.js and app.html - handled by webpack
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

  // Build only essential entry points
  return {
    ...baseConfig,
    entry: {
      content: "./src/content/content.jsx",
      background: "./public/background.js",  // Use main background script directly
      app: "./src/app/app.jsx",
    },
    mode: "production",
    optimization: {
      minimize: false, // Disable minification to save memory
      splitChunks: false, // Disable chunk splitting
      usedExports: false, // Disable tree shaking - keep all code
      sideEffects: false, // Disable side effects optimization
    },
    devtool: false,
    performance: {
      hints: false, // Disable bundle size warnings for Chrome extension
    },
  };
};