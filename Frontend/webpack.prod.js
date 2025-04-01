const configFactory = require("./webpack.config");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const baseConfig = configFactory(env, { mode: "production" });

  baseConfig.plugins.push(
    new CopyPlugin({
      patterns: [{ from: "public" }],
    })
  );

  return {
    ...baseConfig,
    mode: "production",
  };
};
