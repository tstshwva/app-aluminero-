package com.aluformix.ocrprobe;

import android.content.ComponentName;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** APK real, sin cuentas de prueba ni escrituras en Firebase. No prueba login válido. */
@RunWith(AndroidJUnit4.class)
public class ProductionSmokeTest {
    @Test public void freshDistributionOpensLoginAndRegistration() throws Exception {
        UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.setComponent(new ComponentName("com.aluformix.cliente", "com.aluformix.cliente.MainActivity"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(intent);
        assertTrue("El APK de distribución debe abrir Inicio de sesión", device.wait(Until.hasObject(By.text("Inicia sesión")), 60000));
        UiObject2 register = device.wait(Until.findObject(By.text("Crear cuenta de comprador")), 15000);
        assertNotNull("El acceso al registro debe estar disponible", register);
        register.click();
        assertTrue("El botón debe abrir el formulario, sin enviar datos", device.wait(Until.hasObject(By.text("Crea tu cuenta")), 15000));
        assertTrue(device.hasObject(By.text("Crear cuenta")));
        System.out.println("APK real: abrió login y registro; no se crearon cuentas ni pedidos.");
    }
}
