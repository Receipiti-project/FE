const appJson = require('./app.json');
const allowHttpApi = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').startsWith('http://');

module.exports = () => ({
  ...appJson.expo,
  plugins: [
    ...(appJson.expo.plugins ?? []),
    'expo-secure-store',
  ],
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
    infoPlist: {
      ...(appJson.expo.ios.infoPlist ?? {}),
      ...(allowHttpApi
        ? {
            NSAppTransportSecurity: {
              NSAllowsArbitraryLoads: true,
            },
          }
        : {}),
    },
    config: {
      ...(appJson.expo.ios.config ?? {}),
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS ?? '',
    },
  },
});
