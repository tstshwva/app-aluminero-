package com.aluformix.ocrprobe;

import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Typeface;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;

// Imágenes impresas sintéticas, no fotos del usuario ni escritura manuscrita.
// Ejecuta ML Kit real sobre píxeles Android; no prueba el puente Expo ni una lente.
@RunWith(AndroidJUnit4.class)
public class LocalOcrTest {
    private Bitmap sheet() {
        Bitmap image = Bitmap.createBitmap(1600, 720, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(image);
        canvas.drawColor(Color.WHITE);
        Paint ink = new Paint(Paint.ANTI_ALIAS_FLAG);
        ink.setColor(Color.BLACK);
        ink.setTypeface(Typeface.MONOSPACE);
        ink.setTextSize(60);
        String[] lines = {"2 pzas Adaptador mosquitero", "Cabezal de 1750", "Cabezal y zoclo", "Codigo 07333"};
        for (int i=0; i<lines.length; i++) canvas.drawText(lines[i], 80, 130+i*155, ink);
        return image;
    }
    private String recognize(Bitmap image, String name) throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        long start = System.nanoTime();
        try {
            Text read = Tasks.await(recognizer.process(InputImage.fromBitmap(image, 0)), 60, TimeUnit.SECONDS);
            File directory = context.getExternalFilesDir(null);
            assertNotNull(directory);
            try (FileOutputStream out = new FileOutputStream(new File(directory, name+".png"))) {
                image.compress(Bitmap.CompressFormat.PNG, 100, out);
            }
            String report = "ML Kit 16.0.1, imagen sintetica impresa\nms="+TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start)+"\n"+read.getText();
            try (FileOutputStream out = new FileOutputStream(new File(directory, name+".txt"))) {
                out.write(report.getBytes(StandardCharsets.UTF_8));
            }
            System.out.println(report);
            return read.getText().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        } finally { recognizer.close(); image.recycle(); }
    }
    private void expectList(String text) {
        assertTrue(text, text.contains("adaptador mosquitero"));
        assertTrue(text, text.contains("cabezal de 1750"));
        assertTrue(text, text.contains("cabezal y zoclo"));
        assertTrue(text, text.contains("07333"));
    }
    @Test public void printedListPreservesNamesAndCode() throws Exception {
        expectList(recognize(sheet(), "lista-recta"));
    }
    @Test public void tiltedListRemainsReadable() throws Exception {
        Bitmap source = sheet();
        Matrix rotation = new Matrix(); rotation.postRotate(7);
        Bitmap tilted = Bitmap.createBitmap(source, 0, 0, source.getWidth(), source.getHeight(), rotation, true);
        source.recycle();
        expectList(recognize(tilted, "lista-inclinada"));
    }
    @Test public void blankPageDoesNotInventMaterials() throws Exception {
        Bitmap image = Bitmap.createBitmap(1200, 700, Bitmap.Config.ARGB_8888);
        new Canvas(image).drawColor(Color.WHITE);
        assertEquals("", recognize(image, "hoja-vacia").trim());
    }
    @Test public void noInternetPermissionInProbe() throws Exception {
        Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String[] permissions = c.getPackageManager().getPackageInfo(c.getPackageName(), PackageManager.GET_PERMISSIONS).requestedPermissions;
        assertFalse(permissions != null && Arrays.asList(permissions).contains("android.permission.INTERNET"));
    }
}
