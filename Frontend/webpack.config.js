const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const APP_DIR = path.resolve(__dirname, "./src");

module.exports = {
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
  devtool: "cheap-module-source-map",
  plugins: [
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
    new CopyPlugin({
      patterns: [{ from: "public" }, { from: "src" }],
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
        test: /\.css$/,
        use: ["style-loader", "css-loader"], // Process all CSS files
      },
    ],
  },
  resolve: {
    extensions: [".jsx", ".js"],
  },
};
