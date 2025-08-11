const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const webpack = require("webpack");

module.exports = (env, argv) => {
  const isDev = argv.mode === "development";
  
  // Ensure NODE_ENV persists during watch mode rebuilds
  const nodeEnv = isDev ? "development" : (argv.mode || "production");
  
  console.log("🔧 Webpack Config:", { 
    mode: argv.mode, 
    isDev, 
    nodeEnv,
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
