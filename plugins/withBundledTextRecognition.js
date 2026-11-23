const { withProjectBuildGradle } = require('expo/config-plugins');

module.exports = config => withProjectBuildGradle(config, config => {
  const marker = '// Aluformix bundled text recognition';
  if (!config.modResults.contents.includes(marker)) {
    config.modResults.contents += `\n${marker}
allprojects {
    configurations.configureEach {
        resolutionStrategy.dependencySubstitution {
            substitute module('com.google.android.gms:play-services-mlkit-text-recognition') using module('com.google.mlkit:text-recognition:16.0.1')
        }
    }
}
`;
  }
  return config;
});
