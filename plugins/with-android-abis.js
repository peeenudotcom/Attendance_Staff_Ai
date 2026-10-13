// Builds Android native code only for real phones (64-bit and older 32-bit ARM), leaving out the x86 emulator
// builds that otherwise make up about half of the APK. Play app bundles are split per phone anyway; this mainly
// shrinks the APK shared directly with staff.
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'reactNativeArchitectures';
const ABIS = 'armeabi-v7a,arm64-v8a';

module.exports = (config) => withGradleProperties(config, (cfg) => {
  cfg.modResults = cfg.modResults.filter((item) => !(item.type === 'property' && item.key === KEY));
  cfg.modResults.push({ type: 'property', key: KEY, value: ABIS });
  return cfg;
});
