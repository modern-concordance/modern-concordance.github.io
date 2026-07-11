export default {
  source: {
    entry: { index: './js/main.js' },
  },
  html: {
    template: './index.html',
  },
  output: {
    copy: [
      { from: 'book', to: 'book' },
      { from: 'data', to: 'data' },
    ],
    assetPrefix: 'auto',
    cleanDistPath: true,
  },
};