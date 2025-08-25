const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
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
      popup: "./src/popup/popup.jsx",
      background: "./public/background.js",
      content: "./src/content/content.jsx",
      app: "./src/app/app.jsx",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
    },
    devtool: isDev ? "inline-source-map" : "source-map",
    watchOptions: {
      poll: 1000,
      ignored: /node_modules/,
    },
    plugins: [
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(nodeEnv),
        "process.env.USE_MOCK_SERVICE": JSON.stringify(process.env.USE_MOCK_SERVICE),
      }),
      new HtmlWebpackPlugin({
        template: "./src/app/app.html",
        filename: "app.html",
        chunks: ["app"],
      }),
      new HtmlWebpackPlugin({
        template: "./src/popup/popup.html",
        filename: "popup.html",
        chunks: ["popup"],
      }),
      new MonacoWebpackPlugin({
        languages: ["javascript", "json"],
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
  };
};
