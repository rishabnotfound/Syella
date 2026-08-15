const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/renderer/index.tsx',
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'renderer.js',
    globalObject: 'self',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.ttf$/, type: 'asset/resource' },
      { test: /\.(png|jpg|svg|ico)$/, type: 'asset/resource' },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/renderer/index.html' }),
    new CopyPlugin({ patterns: [{ from: 'assets', to: 'assets' }] }),
    new MonacoWebpackPlugin({
      languages: [
        'javascript', 'typescript', 'json', 'yaml', 'shell', 'python', 'go',
        'rust', 'markdown', 'html', 'css', 'scss', 'sql', 'xml', 'dockerfile',
        'ini', 'php', 'ruby', 'java', 'cpp', 'csharp',
      ],
      features: [
        'find', 'clipboard', 'coreCommands', 'contextmenu', 'bracketMatching',
        'wordHighlighter', 'folding', 'multicursor', 'suggest', 'links',
      ],
      filename: 'monaco/[name].worker.js',
    }),
  ],
  devtool: 'source-map',
};
