const path = require('path');
const TerserPlugin = require("terser-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const lightningcss = require('lightningcss');
const browserslist = require('browserslist');

module.exports = {
  entry: './src/index.ts',
  mode: "production",
  module: {
    rules: [
      {
        test: /\.ts?$/,
        exclude: [/node_modules/, /\.d\.ts$/],
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.browser.json'
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: [ MiniCssExtractPlugin.loader, 'css-loader' ]
        // use: [ 'css-loader' ]
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    extensionAlias: {
      '.js': ['.js', '.ts'],
    }
  },
  experiments: {
    outputModule: true,
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist/browser'),
    clean: true,
    library: {
      type: 'module'
    }
  },
  devtool: "source-map",
  performance: {
    hints: false
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
          keep_classnames: true,
          keep_fnames: true,
        },
        extractComments: false,
      }),
      new CssMinimizerPlugin({
        minify: CssMinimizerPlugin.lightningCssMinify,
        minimizerOptions: {
          targets: lightningcss.browserslistToTargets(browserslist(require('./package.json').browserslist))
        },
      }),
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "index.css"
    })
  ]
};
