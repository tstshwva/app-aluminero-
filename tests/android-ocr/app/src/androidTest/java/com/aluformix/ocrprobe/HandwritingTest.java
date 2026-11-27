package com.aluformix.ocrprobe;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import expo.modules.textextractor.HandwrittenImage;
import expo.modules.textextractor.HandwrittenReader;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.InputStream;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class HandwritingTest {
    private String read(TextRecognizer reader, Bitmap bitmap) throws Exception {
        return Tasks.await(reader.process(InputImage.fromBitmap(bitmap, 0)), 30, TimeUnit.SECONDS).getText();
    }
    @Test public void compareRealHandwriting() throws Exception {
        try (InputStream file = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("lista-manuscrita.png")) {
            Bitmap original = BitmapFactory.decodeStream(file);
            TextRecognizer reader = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            try {
                System.out.println("MANUSCRITO ORIGINAL: " + read(reader, original));
                Bitmap enlarged = Bitmap.createScaledBitmap(original, original.getWidth() * 2, original.getHeight() * 2, true);
                System.out.println("MANUSCRITO ORIGINAL AMPLIADO: " + read(reader, enlarged));
                enlarged.recycle();
                for (boolean binary : new boolean[] {false, true}) {
                    Bitmap enhanced = HandwrittenImage.enhance(original, binary);
                    try {
                        System.out.println("MANUSCRITO MEJORA " + binary + ": " + read(reader, enhanced));
                        int row = 0;
                        for (int[] bounds : HandwrittenImage.rows(enhanced)) {
                            if (++row > 12) break;
                            Bitmap strip = Bitmap.createBitmap(enhanced, 0, bounds[0], enhanced.getWidth(), bounds[1] - bounds[0]);
                            Bitmap large = Bitmap.createScaledBitmap(strip, strip.getWidth() * 2, strip.getHeight() * 2, true);
                            System.out.println("MANUSCRITO FILA " + binary + " " + row + ": " + read(reader, large));
                            large.recycle(); if (strip != enhanced) strip.recycle();
                            if (!binary) {
                                Bitmap raw = Bitmap.createBitmap(original, 0, bounds[0], original.getWidth(), bounds[1] - bounds[0]);
                                Bitmap scaled = Bitmap.createScaledBitmap(raw, raw.getWidth() * 2, raw.getHeight() * 2, true);
                                Bitmap padded = Bitmap.createBitmap(scaled.getWidth() + 80, scaled.getHeight() + 80, Bitmap.Config.ARGB_8888);
                                Canvas canvas = new Canvas(padded); canvas.drawColor(Color.WHITE); canvas.drawBitmap(scaled, 40, 40, null);
                                System.out.println("MANUSCRITO FILA ORIGINAL " + row + ": " + read(reader, padded));
                                padded.recycle(); scaled.recycle(); if (raw != original) raw.recycle();
                            }
                        }
                    } finally { enhanced.recycle(); }
                }
                assertFalse("La muestra debe contener texto", read(reader, original).isEmpty());
                java.util.List<java.util.Map<String, Object>> result = HandwrittenReader.read(original);
                System.out.println("MANUSCRITO PRODUCCION: " + result);
                assertEquals("Recupera los cuatro renglones, no garantiza letras exactas", 4, result.size());
            } finally { reader.close(); original.recycle(); }
        }
    }
}
