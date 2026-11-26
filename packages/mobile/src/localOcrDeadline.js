// Limita la espera de la interfaz. El SDK puede finalizar después; ese resultado
// ya no se aplica. No cancela una tarea nativa que ML Kit no permite abortar.
export async function localOcrDeadline(read, milliseconds = 15000) {
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
                  "La lectura tardó demasiado. Acerca la hoja, fotografía una parte o escribe los materiales. Tu lista anterior se conserva.",
                ),
                { code: "ocr/timeout" },
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
