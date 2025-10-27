// metro.config.js (project root)
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Treat .csv as an asset so require('../assets/...csv') works
if (!config.resolver.assetExts.includes('csv')) {
  config.resolver.assetExts.push('csv');
}

module.exports = config;
