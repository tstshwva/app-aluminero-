package expo.modules.textextractor;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.content.Context;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import java.io.InputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** Operaciones locales acotadas; no modifica el archivo original ni inventa texto. */
public final class HandwrittenImage {
    private HandwrittenImage() {}

    /** Decodifica con reducción previa: no carga una foto de 48 MP en memoria. */
    public static Bitmap load(Context context, Uri uri) throws IOException {
        if (!"file".equals(uri.getScheme()) && !"content".equals(uri.getScheme()))
            throw new IOException("Se necesita una foto local.");
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        try (InputStream stream = context.getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(stream, null, options);
        }
        if (options.outWidth <= 0 || options.outHeight <= 0)
            throw new IOException("No se pudo abrir la foto.");
        options.inSampleSize = 1;
        while (Math.max(options.outWidth, options.outHeight) / options.inSampleSize > 1600)
            options.inSampleSize *= 2;
        options.inJustDecodeBounds = false;
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap image;
        try (InputStream stream = context.getContentResolver().openInputStream(uri)) {
            image = BitmapFactory.decodeStream(stream, null, options);
        }
        if (image == null) throw new IOException("No se pudo abrir la foto.");
        int orientation = ExifInterface.ORIENTATION_NORMAL;
        try (InputStream stream = context.getContentResolver().openInputStream(uri)) {
            orientation = new ExifInterface(stream).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
        } catch (IOException ignored) { /* PNG sin EXIF: orientación original. */ }
        Matrix matrix = new Matrix();
        switch (orientation) {
            case 2: matrix.setScale(-1, 1); break;
            case 3: matrix.setRotate(180); break;
            case 4: matrix.setScale(1, -1); break;
            case 5: matrix.setRotate(90); matrix.postScale(-1, 1); break;
            case 6: matrix.setRotate(90); break;
            case 7: matrix.setRotate(270); matrix.postScale(-1, 1); break;
            case 8: matrix.setRotate(270); break;
        }
        if (matrix.isIdentity()) return image;
        Bitmap upright = Bitmap.createBitmap(image, 0, 0, image.getWidth(), image.getHeight(), matrix, true);
        if (upright != image) image.recycle();
        return upright;
    }

    public static Bitmap enhance(Bitmap source, boolean binary) {
        int w = source.getWidth(), h = source.getHeight();
        if (w <= 0 || h <= 0 || (long) w * h > 4000000L)
            throw new IllegalArgumentException("Fotografía demasiado grande para mejorar en el teléfono.");
        int[] pixels = new int[w * h];
        source.getPixels(pixels, 0, w, 0, 0, w, h);
        // El canal azul reduce la cuadrícula azul y conserva lápiz gris/negro.
        // La media local compensa sombras suaves, no sustituye el enfoque.
        int[] channel = new int[pixels.length];
        for (int i = 0; i < pixels.length; i++) channel[i] = Color.blue(pixels[i]);
        int radius = Math.max(12, Math.min(40, w / 25));
        int[] sums = new int[w * (h + 1)];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
                sums[(y + 1) * w + x] = sums[y * w + x] + channel[y * w + x];
        for (int y = 0; y < h; y++) {
            int top = Math.max(0, y - radius), bottom = Math.min(h - 1, y + radius);
            int total = 0;
            for (int x = 0; x <= Math.min(w - 1, radius); x++)
                total += sums[(bottom + 1) * w + x] - sums[top * w + x];
            for (int x = 0; x < w; x++) {
                if (x > 0) {
                    int remove = x - radius - 1, add = x + radius;
                    if (remove >= 0) total -= sums[(bottom + 1) * w + remove] - sums[top * w + remove];
                    if (add < w) total += sums[(bottom + 1) * w + add] - sums[top * w + add];
                }
                int count = (bottom - top + 1) * (Math.min(w - 1, x + radius) - Math.max(0, x - radius) + 1);
                int delta = channel[y * w + x] - total / count;
                int value = binary ? (delta < -12 ? 0 : 255) : Math.max(0, Math.min(255, 245 + delta * 4));
                pixels[y * w + x] = Color.rgb(value, value, value);
            }
        }
        Bitmap result = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        result.setPixels(pixels, 0, w, 0, 0, w, h);
        return result;
    }

    /** Bandas de tinta: útiles cuando el modelo mezcla palabras entre columnas. */
    public static List<int[]> rows(Bitmap image) {
        int w = image.getWidth(), h = image.getHeight();
        int[] line = new int[w];
        List<int[]> found = new ArrayList<>();
        int start = -1, last = -1, gap = Math.max(5, h / 140);
        for (int y = 0; y < h; y++) {
            image.getPixels(line, 0, w, 0, y, w, 1);
            int ink = 0;
            for (int x = w / 30; x < w - w / 30; x++) if (Color.blue(line[x]) < 100) ink++;
            if (ink > Math.max(8, w / 50)) {
                if (start < 0) start = y;
                last = y;
            } else if (start >= 0 && y - last > gap) {
                if (last - start >= 10) found.add(new int[] {Math.max(0, start - gap), Math.min(h, last + gap + 1)});
                start = -1;
            }
        }
        if (start >= 0 && last - start >= 10)
            found.add(new int[] {Math.max(0, start - gap), Math.min(h, last + gap + 1)});
        return found;
    }
}
