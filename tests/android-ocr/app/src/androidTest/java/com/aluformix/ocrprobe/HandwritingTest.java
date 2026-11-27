package com.aluformix.ocrprobe;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import expo.modules.textextractor.HandwrittenImage;
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
                        }
                    } finally { enhanced.recycle(); }
                }
                assertFalse("La muestra debe contener texto", read(reader, original).isEmpty());
            } finally { reader.close(); original.recycle(); }
        }
    }
}
