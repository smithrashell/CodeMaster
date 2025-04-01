const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

module.exports = (env, argv) => {
  const isDev = argv.mode === "development";

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
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    resolve: {
      extensions: [".jsx", ".js"],
    },
  };
};
