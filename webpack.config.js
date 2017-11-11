"use strict"
const path = require("path")
module.exports = {
  devServer: {
    contentBase: ".",
    port: 3000,
  },
  target: "web",
  devtool: "source-map",
  entry: "./src/explorer.js",
  node: {
    fs: "empty",
  },
  output: {
    path: path.resolve("./docs/"),
    filename: "bundle.js",
  },
  resolve: {
    alias: {},
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
          },
        ],
      },
    ],
  },
}
