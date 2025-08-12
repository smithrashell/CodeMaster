const configFactory = require("./webpack.config");

module.exports = (env, argv) => {
  // Ensure development mode is always set for dev config
  const devArgv = { ...argv, mode: "development" };
  const baseConfig = configFactory(env, devArgv);

  return {
    ...baseConfig,
    mode: "development",
    devtool: "inline-source-map",
  };
};
