import { requireOptionalNativeModule } from 'expo-modules-core';

const reader = requireOptionalNativeModule('ExpoTextExtractor');
export const localTextAvailable = !!reader?.isSupported;

export async function readLocalText(uri) {
  if (!localTextAvailable) throw new Error('Instala el APK actualizado para activar el escáner local.');
  const blocks = await reader.extractTextFromImage(uri.replace(/^file:\/\//, ''));
  return blocks.filter(block => typeof block === 'string').join('\n').trim();
}
