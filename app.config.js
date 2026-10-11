// Extends app.json. Android push notifications need Firebase's google-services.json. It is kept out of the
// repository: on EAS it comes from the file environment variable GOOGLE_SERVICES_JSON (eas env:create, type
// file); locally a ./google-services.json is used if present. Without it the app builds and works, but
// Android phones get no push messages (on-device reminders still work).
const fs = require('fs');

module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
    || (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
