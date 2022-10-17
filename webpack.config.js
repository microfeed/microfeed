const path = require('path');
const BundleTracker = require('webpack-bundle-tracker');
const ESLintPlugin = require('eslint-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const prod = process.env.NODE_ENV === 'production';
const devPort = 9001;
const buildDir = 'build/';
let publicPath = `http://localhost:${devPort}/`;
if (prod) {
  publicPath = `/${buildDir}`;
}

const entry = {
  base_css: './common/base.css',
  index_js: './ClientHomeApp/index.js',
};

module.exports = {

  context: path.resolve(__dirname, './client-src'),

  entry,

  output: {
    path: path.resolve(__dirname, `./public/${buildDir}`),
    filename: '[name]-[fullhash].js',
    publicPath,
  },

  plugins: [
    new ESLintPlugin({
      extensions: ['jsx', 'js'],
      exclude: [
        'node_modules',
      ],
    }),

    new BundleTracker({filename: './functions/webpack-stats.json'}),

    // Delete stale assets before each build
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        '*.js',
        '*.css',
        '*.png',
        '*.txt',
      ],
      verbose: true,
      dry: false,
    }),

    new MiniCssExtractPlugin({
      filename: '[name]-[fullhash].css',
    }),
  ],

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'swc-loader',
            options: {
              sync: true,
            },
          },
        ],
      },
      {
        test: /\.less$/,
        use: [{
          loader: 'style-loader',
        }, {
          loader: 'css-loader',
        }, {
          loader: 'less-loader',
        }],
      },
      {
        test: /base.*\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { url: false } },
          'postcss-loader',
        ],
      },
      {
        test: /\.css$/,
        exclude: /base.*\.css$/,
        use: [
          {
            loader: 'style-loader',
          },
          { loader: 'css-loader', options: { url: false } },
          // 'postcss-loader',
        ],
      },
      // {
      //   test: /\.png$/,
      //   use: 'url-loader?name=[name]-[hash].[ext]&limit=8192&mimetype=image/png',
      // },
      // {
      //   test: /\.svg$/,
      //   use: ['@svgr/webpack'],
      // },
    ],
  },

  devServer: {
    static: [
      {
        directory: path.join(__dirname, './public/'),
      },
      {
        directory: path.join(__dirname, './client-src/'),
      },
    ],
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    compress: true,
    port: devPort,
  },
  resolve: {
    extensions: ['*', '.js', '.jsx'],
  },
  mode: prod ? 'production' : 'development',
};
