// BETWEEN product/version constants — app, content, storage and cache versions are independent.
const BETWEEN_VERSION = Object.freeze({
  app: '5.0.0',
  content: (window.BETWEEN_DATA && window.BETWEEN_DATA.version) || '3.3',
  storage: 5,
  cache: 'between-v5.0.0-phase3fix4',
  creator: 'THEE LPM',
});
