const configFactory = require("./webpack.config");

module.exports = (env, argv) => {
  const baseConfig = configFactory(env, { mode: "development" });
  
  // Only build content script for testing
  return {
    ...baseConfig,
    entry: {
      content: "./src/content/content.jsx",
    },
    mode: "development",
    optimization: {
      minimize: false,
    },
    devtool: false,
  };
};