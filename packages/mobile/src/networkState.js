// La prueba de alcance puede fallar en redes que sí permiten Firebase.
// Solo una desconexión explícita impide intentar la operación.
export function canAttemptNetwork(state) {
  return state?.isConnected !== false && state?.type !== "NONE";
}
