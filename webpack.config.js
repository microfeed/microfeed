const path = require('path');
const BundleTracker = require('webpack-bundle-tracker');
const ESLintPlugin = require('eslint-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');

const prod = process.env.NODE_ENV === 'production';
const devPort = 9000;
const buildDir = 'build/';
const plugins = [];
let publicPath = `http://localhost:${devPort}/`;
if (prod) {
  publicPath = `/${buildDir}`;
} else {
  plugins.push(new WebpackShellPluginNext({
    onBuildStart: {
      // XXX: when edge-src/ has syntax error, webpack dev server will crash; after we restart, previous
      // node processes may still be alive, which would take up the same PORT number and prevent dev server
      // to run again. We have to kill all node process
      scripts: ['pkill node'],
      blocking: true,
      parallel: false
    },
  }));
}

const entry = {
  //
  // CSS
  //
  admin_styles_css: './common/admin_styles.css',
  public_default_css: './common/public_default_styles.css',

  //
  // JS
  //

  // Public
  index_js: './ClientHomeApp/index.js',

  // Admin
  new_episode_js: './ClientAdminEpisodesApp/New/index.js',
  all_episodes_js: './ClientAdminEpisodesApp/index.js',
  edit_podcast_js: './ClientAdminPodcastApp/index.js',
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
    ...plugins,

    new ESLintPlugin({
      extensions: ['jsx', 'js'],
      exclude: [
        'node_modules',
      ],
      emitWarning: true,
      failOnError: false,
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
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { url: false } },
          'postcss-loader',
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
