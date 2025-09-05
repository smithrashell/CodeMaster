const configFactory = require("./webpack.config");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const baseConfig = configFactory(env, { mode: "production" });
  const shouldAnalyze = process.argv.includes("--analyze");

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

  // Add bundle analyzer for performance monitoring
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
      console.warn("⚠️  webpack-bundle-analyzer not installed. Run 'npm install --save-dev webpack-bundle-analyzer' to enable bundle analysis.");
    }
  }

  return {
    ...baseConfig,
    mode: "production",
    performance: {
      hints: "warning",
      maxAssetSize: 1000000, // 1MB warning for individual assets
      maxEntrypointSize: 1500000, // 1.5MB warning for entry points
    },
  };
};
