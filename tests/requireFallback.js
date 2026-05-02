'use strict';
const path = require('path');
const { createRequire } = require('module');

const serverRequire = createRequire(path.resolve(__dirname, '../server/package.json'));

module.exports = function requireFallback(name) {
  try {
    return require(name);
  } catch (err) {
    return serverRequire(name);
  }
};
