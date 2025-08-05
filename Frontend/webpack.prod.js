const configFactory = require("./webpack.config");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const baseConfig = configFactory(env, { mode: "production" });

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
      ],
    })
  );

  return {
    ...baseConfig,
    mode: "production",
  };
};
