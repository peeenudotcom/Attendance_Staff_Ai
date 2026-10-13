// Android developer verification: Google proves we own com.tarahut.attendance by finding this file, with the
// token from Play Console (Android developer verification → package → Sign and upload an APK), in the assets of
// an APK signed with our key. Copies assets/android/adi-registration.properties into the Android app's assets.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const FILE = 'adi-registration.properties';

module.exports = (config) => withDangerousMod(config, ['android', (cfg) => {
  const src = path.join(cfg.modRequest.projectRoot, 'assets', 'android', FILE);
  if (fs.existsSync(src)) {
    const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, path.join(dir, FILE));
  }
  return cfg;
}]);
