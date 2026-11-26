// Solo lecturas: vencer el plazo no significa que una escritura haya fallado.
// Firestore no ofrece AbortSignal para getDoc/getDocs; el SDK puede finalizar
// después, pero la UI no aplica ese resultado ni queda bloqueada esperándolo.
export async function readWithDeadline(read, milliseconds = 12000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(
                new Error(
                  "El servidor tardó demasiado. Reintenta o consulta la copia descargada.",
                ),
                { code: "deadline-exceeded" },
              ),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
