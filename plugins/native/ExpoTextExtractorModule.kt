package expo.modules.textextractor

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

class ExpoTextExtractorModule : Module() {
  private val improving = AtomicBoolean(false)
  override fun definition() = ModuleDefinition {
    Name("ExpoTextExtractor")
    Constants("isSupported" to true)
    // Conserva el contrato anterior para instalaciones que usan solo bloques.
    AsyncFunction("extractTextFromImage") { uri: String, promise: Promise -> recognize(uri, promise, false) }
    AsyncFunction("extractTextLinesFromImage") { uri: String, promise: Promise -> recognize(uri, promise, true) }
    AsyncFunction("extractHandwrittenLinesFromImage") { uri: String, promise: Promise ->
      if (!improving.compareAndSet(false, true)) {
        promise.reject(CodedException("OCR_BUSY", "La lectura anterior sigue terminando. Espera un momento.", null))
      } else Thread {
        try {
          val context = appContext.reactContext ?: throw IllegalStateException("Cámara no disponible")
          val local = if (uri.startsWith("file://") || uri.startsWith("content://")) Uri.parse(uri) else Uri.fromFile(File(uri))
          val image = HandwrittenImage.load(context, local)
          try { promise.resolve(HandwrittenReader.read(image)) } finally { image.recycle() }
        } catch (error: Exception) {
          promise.reject(CodedException("OCR_ERROR", error.message ?: "No se pudo mejorar la lectura.", error))
        } catch (error: OutOfMemoryError) {
          promise.reject(CodedException("OCR_MEMORY", "Cierra otras aplicaciones y fotografía menos renglones. Tu lista se conserva.", error))
        } finally { improving.set(false) }
      }.start()
    }
  }

  private fun recognize(uriString: String, promise: Promise, positioned: Boolean) {
    try {
      val context = appContext.reactContext ?: throw IllegalStateException("Camera context unavailable")
      val uri = if (uriString.startsWith("content://") || uriString.startsWith("file://")) Uri.parse(uriString) else Uri.fromFile(File(uriString))
      val input = InputImage.fromFilePath(context, uri)
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        recognizer.process(input)
          .addOnSuccessListener { result ->
            if (positioned) {
              promise.resolve(result.textBlocks.flatMap { block -> block.lines.map { line ->
                val bounds = line.boundingBox
                mapOf("text" to line.text, "x" to bounds?.left, "y" to bounds?.top,
                  "width" to bounds?.width(), "height" to bounds?.height())
              } })
            } else promise.resolve(result.textBlocks.map { it.text })
          }
          .addOnFailureListener { error -> promise.reject(CodedException("OCR_ERROR", "No se pudo leer la hoja.", error)) }
          .addOnCompleteListener { recognizer.close() }
      } catch (error: Exception) { recognizer.close(); throw error }
    } catch (error: Exception) {
      promise.reject(CodedException("OCR_ERROR", error.message ?: "No se pudo abrir la foto.", error))
    }
  }
}
