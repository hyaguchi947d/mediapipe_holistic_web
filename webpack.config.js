const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    capture: './src/capture.js',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'public'),
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        // node_modules内のwasmフォルダをdist/wasmへコピー
        {
          from: path.resolve(
            __dirname,
            "node_modules/@mediapipe/tasks-vision/wasm"
          ),
          to: "mediapipe/wasm",
        },
      ],
    }),
  ],
};