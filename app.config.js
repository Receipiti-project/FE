const appJson = require('./app.json');

module.exports = () => ({
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    config: {
      ...(appJson.expo.android.config ?? {}),
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID ?? '',
      },
    },
  },
  ios: {
    ...appJson.expo.ios,
    config: {
      ...(appJson.expo.ios.config ?? {}),
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS ?? '',
    },
  },
});
