import Foundation
import ExpoModulesCore
import Vision

public class ExpoTextExtractorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoTextExtractor")
    Constants(["isSupported": true])
    AsyncFunction("extractTextFromImage") { (url: URL, promise: Promise) in
      self.recognize(url, positioned: false, promise: promise)
    }.runOnQueue(.global(qos: .userInitiated))
    AsyncFunction("extractTextLinesFromImage") { (url: URL, promise: Promise) in
      self.recognize(url, positioned: true, promise: promise)
    }.runOnQueue(.global(qos: .userInitiated))
  }

  private func recognize(_ url: URL, positioned: Bool, promise: Promise) {
    guard url.isFileURL else {
      promise.reject("OCR_ERROR", "El lector necesita una foto guardada en el teléfono.")
      return
    }
    do {
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      // No corregir automáticamente códigos y medidas del catálogo.
      request.usesLanguageCorrection = false
      let supported = try request.supportedRecognitionLanguages()
      let preferred = ["es-ES", "en-US"].filter { supported.contains($0) }
      if !preferred.isEmpty { request.recognitionLanguages = preferred }
      try VNImageRequestHandler(url: url, options: [:]).perform([request])
      let observations = request.results ?? []
      if positioned {
        let lines: [[String: Any]] = observations.compactMap { observation in
          guard let text = observation.topCandidates(1).first?.string else { return nil }
          let bounds = observation.boundingBox
          // Vision parte de abajo a la izquierda; el agrupador usa arriba a la izquierda.
          return ["text": text, "x": bounds.minX * 1000,
                  "y": (1 - bounds.maxY) * 1000,
                  "width": bounds.width * 1000, "height": bounds.height * 1000]
        }
        promise.resolve(lines)
      } else {
        promise.resolve(observations.compactMap { $0.topCandidates(1).first?.string })
      }
    } catch {
      promise.reject("OCR_ERROR", "No se pudo leer la foto. Acerca la hoja o escribe los materiales.")
    }
  }
}
