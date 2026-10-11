// The call-log module (Calls tab) is off in store builds: Google Play only allows call-log permissions for
// default phone/SMS apps. Leaving it out of the native build keeps its code and permissions out of the app.
// For a private build with ENABLE_CALL_LOGS on (src/config/features.js), delete this entry and un-block the
// call-log permissions in app.json.
module.exports = {
  dependencies: {
    'react-native-call-log': { platforms: { android: null } },
  },
};
