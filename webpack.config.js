/* eslint-disable @typescript-eslint/no-var-requires */
const slsw = require('serverless-webpack');

module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.[tj]s$/,
        use: { loader: 'babel-loader' },
        include: __dirname,
        exclude: /node_modules/,
      },
    ],
  },
  devtool: 'source-map',
  optimization: {
    minimize: false,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
};
