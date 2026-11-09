// En el navegador, Alert.alert de react-native-web no muestra nada y los
// botones de confirmación no harían efecto. Se sustituye por los diálogos del
// navegador para poder revisar los flujos desde la PC.
import { Alert } from "react-native";

Alert.alert = (title, message, buttons) => {
  const text = [title, message].filter(Boolean).join("\n\n");
  if (!buttons || buttons.length < 2) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const cancel = buttons.find((b) => b.style === "cancel") ?? buttons[0];
  const accept = buttons.find((b) => b !== cancel);
  if (window.confirm(text)) accept?.onPress?.();
  else cancel?.onPress?.();
};
export {};
