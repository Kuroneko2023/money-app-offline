const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// สอนให้ระบบรู้จักไฟล์ .wasm สำหรับรัน SQLite บนเว็บ
config.resolver.assetExts.push('wasm');

module.exports = config;