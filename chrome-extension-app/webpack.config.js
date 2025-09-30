const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
// const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin"); // Removed - not used in production routes
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
    },
    target: "webworker", // Correct target for service workers
    devtool: false, // Disable source maps to save memory
    watchOptions: {
      poll: 1000,
      ignored: /node_modules/,
    },
    plugins: [
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(nodeEnv),
        "process.env.USE_MOCK_SERVICE": JSON.stringify(process.env.USE_MOCK_SERVICE),
        "process.env.ENABLE_TESTING": JSON.stringify(isDev ? "true" : "false"), // Only enable testing in dev builds
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
      // MonacoWebpackPlugin removed - flashcards feature not used in production
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
      sideEffects: false,
      usedExports: true,
      splitChunks: {
        chunks: 'all',
        minSize: 10000,
        maxSize: 250000,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            maxSize: 400000,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
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
