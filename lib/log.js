const { LOG_LEVEL } = require('./config')();

const pino = require('pino');

module.exports = (opts = {}) => {
  return pino({
    level: LOG_LEVEL,
    ...opts,
  });
};
