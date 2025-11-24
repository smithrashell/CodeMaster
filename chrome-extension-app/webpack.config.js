const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");
require("dotenv").config();

module.exports = (env, argv) => {
  // Force development mode if using webpack.dev.js
  const isUsingDevConfig = process.env.npm_lifecycle_script && process.env.npm_lifecycle_script.includes('webpack.dev.js');
  const isDev = argv.mode === "development" || isUsingDevConfig;
  
  // Ensure NODE_ENV persists during watch mode rebuilds
  const nodeEnv = isDev ? "development" : (argv.mode || "production");
  
  console.log("🔧 Webpack Config:", { 
    mode: argv.mode, 
    isUsingDevConfig,
    isDev, 
    nodeEnv,
    scriptName: process.env.npm_lifecycle_script,
    timestamp: new Date().toISOString() 
  });

  return {
    entry: {
      background: isDev ? "./src/background/background.development.js" : "./src/background/background.production.js",
      content: "./src/content/content.jsx",
      app: "./src/app/app.jsx",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      publicPath: "",  // Fix for service worker compatibility
      clean: true,  // Clean dist/ before each build
    },
    target: "web", // Changed from "webworker" - background script will be handled separately
    devtool: isDev ? 'cheap-source-map' : false, // Use cheap-source-map instead of eval for Chrome extension CSP compliance

    // Disable filesystem cache in dev to prevent stale builds during watch mode
    // The cache was causing webpack to miss file changes and serve stale bundles
    // Memory cache is sufficient for dev rebuilds
    cache: false,

    watchOptions: {
      poll: 1000,
      aggregateTimeout: 300,  // Wait 300ms after change before rebuilding
      ignored: /node_modules/,
    },
    plugins: [
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(nodeEnv),
        "process.env.USE_MOCK_SERVICE": JSON.stringify(process.env.USE_MOCK_SERVICE),
        "process.env.ENABLE_TESTING": JSON.stringify(isDev ? "true" : "false"), // Only enable testing in dev builds
        "BUILD_TIMESTAMP": JSON.stringify(new Date().toISOString()),
      }),
      new HtmlWebpackPlugin({
        template: "./src/app/app.html",
        filename: "app.html",
        chunks: ["app"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "public/manifest.json",
            to: "manifest.json",
          },
          {
            from: "public/*.png",
            to: "[name][ext]",
          },
          {
            from: "public/images",
            to: "images",
            noErrorOnMissing: true,
          },
          {
            from: "public/app.css",
            to: "app.css",
            noErrorOnMissing: true,
          },
          {
            from: "src/content/css",
            to: "content/css",
            noErrorOnMissing: true,
          },
          {
            from: "src/shared/components/css/timer.css",
            to: "content/css/timer.css",
            noErrorOnMissing: true,
          },
          {
            from: "src/shared/components/css/timerBanner.css",
            to: "content/css/timerBanner.css",
            noErrorOnMissing: true,
          },
          {
            from: "src/shared/constants/LeetCode_Tags_Combined.json",
            to: "LeetCode_Tags_Combined.json",
            noErrorOnMissing: true,
          },
          {
            from: "src/shared/constants/strategy_data.json",
            to: "strategy_data.json",
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                "@babel/preset-env",
                ["@babel/preset-react", { runtime: "automatic" }],
              ],
            },
          },
        },
        {
          test: /\.module\.css$/,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: {
                modules: {
                  localIdentName: "[name]__[local]__[hash:base64:5]",
                },
              },
            },
          ],
        },
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    resolve: {
      extensions: [".jsx", ".js"],
    },
    optimization: {
      minimize: !isDev, // Only minify in production (dev minification only saves 20KB but breaks watch mode)
      minimizer: !isDev ? [
        new (require('terser-webpack-plugin'))({
          terserOptions: {
            compress: {
              drop_console: false,  // Keep console logs
              pure_funcs: ['console.debug', 'console.trace'],
            },
            mangle: {
              // Don't mangle globalThis properties
              reserved: ['testCoreBusinessLogic', 'setupTestEnvironment', 'cleanupTestData', 'enableTesting'],
            },
          },
        }),
      ] : [],
      sideEffects: false,
      usedExports: true,
      splitChunks: {
        chunks(chunk) {
          // Don't split background or content chunks - they need single files for Chrome extension
          return chunk.name !== 'background' && chunk.name !== 'content';
        },
        minSize: 10000,
        maxSize: 250000,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks(chunk) {
              return chunk.name !== 'background' && chunk.name !== 'content';
            },
            maxSize: 400000,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks(chunk) {
              return chunk.name !== 'background' && chunk.name !== 'content';
            },
            maxSize: 200000,
          },
        },
      },
      concatenateModules: false, // Disable to save memory
    },
    stats: {
      children: false,
      modules: false,
    },
  };
};
