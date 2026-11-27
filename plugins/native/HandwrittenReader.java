package expo.modules.textextractor;

import android.graphics.Bitmap;
import android.os.SystemClock;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class HandwrittenReader {
    private HandwrittenReader() {}

    /** Se llama fuera del hilo UI. Una sola imagen y un solo renglón a la vez. */
    public static List<Map<String, Object>> read(Bitmap original) throws Exception {
        long started = SystemClock.elapsedRealtime();
        Bitmap enhanced = HandwrittenImage.enhance(original, false);
        TextRecognizer reader = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        try {
            List<int[]> bands = HandwrittenImage.rows(enhanced);
            if (bands.size() > 8)
                throw new IllegalArgumentException("Fotografía hasta 8 renglones de cerca para mejorar la letra.");
            List<Map<String, Object>> lines = new ArrayList<>();
            for (int[] band : bands) {
                if (SystemClock.elapsedRealtime() - started > 12000)
                    throw new IllegalStateException("La lectura tardó demasiado. Fotografía menos renglones.");
                Bitmap strip = Bitmap.createBitmap(enhanced, 0, band[0], enhanced.getWidth(), band[1] - band[0]);
                float scale = Math.min(2f, 1600f / strip.getWidth());
                Bitmap enlarged = Bitmap.createScaledBitmap(strip, Math.max(1, Math.round(strip.getWidth() * scale)), Math.max(1, Math.round(strip.getHeight() * scale)), true);
                try {
                    // Se espera a que ML Kit libere el bitmap antes de reciclarlo.
                    // La UI tiene plazo propio; un resultado tardío se descarta.
                    Text result = Tasks.await(reader.process(InputImage.fromBitmap(enlarged, 0)));
                    String text = result.getText().replaceAll("\\s+", " ").trim();
                    if (!text.isEmpty()) {
                        Map<String, Object> line = new HashMap<>();
                        line.put("text", text); line.put("x", 0); line.put("y", band[0]);
                        line.put("width", original.getWidth()); line.put("height", band[1] - band[0]);
                        lines.add(line);
                    }
                } finally {
                    if (enlarged != strip) enlarged.recycle();
                    if (strip != enhanced) strip.recycle();
                }
            }
            return lines;
        } finally { reader.close(); enhanced.recycle(); }
    }
}
