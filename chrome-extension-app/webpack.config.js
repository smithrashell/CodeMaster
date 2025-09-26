const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
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
      background: "./public/background.js",
      content: "./src/content/content.jsx", 
      app: "./src/app/app.jsx",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
    },
    devtool: false, // Disable source maps to save memory
    watchOptions: {
      poll: 1000,
      ignored: /node_modules/,
    },
    plugins: [
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(nodeEnv),
        "process.env.USE_MOCK_SERVICE": JSON.stringify(process.env.USE_MOCK_SERVICE),
        "process.env.ENABLE_TESTING": JSON.stringify(isDev), // Only enable testing in dev builds
      }),
      new HtmlWebpackPlugin({
        template: "./src/app/app.html",
        filename: "app.html",
        chunks: ["app"],
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
