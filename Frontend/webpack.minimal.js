const configFactory = require("./webpack.config");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const baseConfig = configFactory(env, { mode: "production" });
  
  // Add static assets copying
  baseConfig.plugins.push(
    new CopyPlugin({
      patterns: [
        { from: "public" },
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
      background: "./public/background.js",
      app: "./src/app/app.jsx",
    },
    mode: "production",
    optimization: {
      minimize: false, // Disable minification to save memory
      splitChunks: false, // Disable chunk splitting  
    },
    devtool: false,
    performance: {
      hints: false, // Disable bundle size warnings for Chrome extension
    },
  };
};