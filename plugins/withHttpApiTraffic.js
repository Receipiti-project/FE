const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Receipiti API가 HTTP로 제공되는 동안 Android 릴리스 빌드에서도
 * API 요청을 허용합니다. HTTPS 전환 후에는 app.config.js에서 제거합니다.
 */
module.exports = function withHttpApiTraffic(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const application = nextConfig.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error("AndroidManifest.xml의 application 항목을 찾지 못했습니다.");
    }

    application.$["android:usesCleartextTraffic"] = "true";
    return nextConfig;
  });
};
