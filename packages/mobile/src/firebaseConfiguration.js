export function firebaseConfiguration(platform, values) {
  if (platform === "ios") {
    if (!values.iosApiKey || !values.iosAppId || !/:ios:/.test(values.iosAppId))
      throw new Error(
        "Falta configurar Firebase para iPhone. La configuración Android no se puede reutilizar.",
      );
    return {
      projectId: values.projectId,
      apiKey: values.iosApiKey,
      appId: values.iosAppId,
    };
  }
  return {
    projectId: values.projectId,
    apiKey: values.apiKey,
    appId: values.appId,
  };
}
