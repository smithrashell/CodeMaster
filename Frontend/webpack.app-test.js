const configFactory = require("./webpack.config");

module.exports = (env, argv) => {
  const baseConfig = configFactory(env, { mode: "development" });
  
  // Only build app for testing
  return {
    ...baseConfig,
    entry: {
      app: "./src/app/app.jsx",
    },
    mode: "development",
    optimization: {
      minimize: false,
    },
    devtool: false,
  };
};