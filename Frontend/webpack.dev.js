const configFactory = require("./webpack.config");

module.exports = (env, argv) => {
  const baseConfig = configFactory(env, { mode: "development" });

  return {
    ...baseConfig,
    mode: "development",
    devtool: "inline-source-map",
  };
};
