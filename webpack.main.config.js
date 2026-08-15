const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/main/main.ts',
  target: 'electron-main',
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'main.js',
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  externals: {
    ssh2: 'commonjs ssh2',
    'sql.js': 'commonjs sql.js',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
