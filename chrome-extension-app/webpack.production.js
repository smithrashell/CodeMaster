const configFactory = require("./webpack.config");
const CopyPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");

module.exports = (env, argv) => {
  const baseConfig = configFactory(env, { mode: "production" });

  // Force production mode
  process.env.NODE_ENV = "production";

  // Exclude test files from production bundle
  baseConfig.plugins.push(
    new webpack.IgnorePlugin({
      resourceRegExp: /Testing\.js$/,  // Ignore files ending with "Testing.js"
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /Test\.js$/,  // Ignore files ending with "Test.js"
      contextRegExp: /utils/,  // Only in utils directory
    })
  );

  // Add bundle analyzer for performance monitoring (--analyze flag)
  const shouldAnalyze = process.argv.includes("--analyze");
  if (shouldAnalyze) {
    try {
      const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
      baseConfig.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: "server",
          openAnalyzer: true,
          reportFilename: "bundle-report.html",
        })
      );
    } catch (error) {
      console.warn("webpack-bundle-analyzer not installed. Run 'npm install --save-dev webpack-bundle-analyzer' to enable.");
    }
  }

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
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: false,
              pure_funcs: [
                'console.log',
                'console.debug',
                'console.info',
                'console.trace',
              ],
            },
            format: {
              comments: false,
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
