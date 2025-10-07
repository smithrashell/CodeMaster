const configFactory = require("./webpack.config");
const CopyPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

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
              "**/background*.js",
              "**/background*.js.old",
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
      background: "./src/background/background.production.js",
      app: "./src/app/app.jsx",
    },
    mode: "production",
    // Enable filesystem caching for faster subsequent builds
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
      compression: 'gzip',
    },
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: true, // Use multiple CPU cores
          terserOptions: {
            compress: {
              drop_console: false,
              pure_funcs: [
                'console.log',
                'console.debug',
                'console.info',
                'console.trace',
              ],
              passes: 2, // Faster than default 3
            },
            format: {
              comments: false,
            },
            mangle: {
              safari10: false,
            },
          },
          extractComments: false,
        }),
      ],
      splitChunks: false,
      usedExports: true,
      sideEffects: false,
    },
    devtool: false,
    performance: {
      hints: "warning",
      maxAssetSize: 5000000,
      maxEntrypointSize: 5000000,
    },
  };
};
