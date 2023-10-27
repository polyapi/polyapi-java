const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const tsBaseCfg = require('./tsconfig.base.json');
const tsCfg = require('./tsconfig.json');

module.exports = {
  optimization: {
    minimize: true,
  },
  entry: './src/main.ts',
  module: {
    rules: [
      {
        test: /.ts?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                ...tsBaseCfg,
                ...tsCfg.compilerOptions,
                baseUrl: "./",
                declaration: false,
                declarationMap: false
              },
            }
          }
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [new TsconfigPathsPlugin()],
  },
  output: {
    path: path.join(__dirname, 'dist/src'),
    filename: 'main.js',
  }
};
