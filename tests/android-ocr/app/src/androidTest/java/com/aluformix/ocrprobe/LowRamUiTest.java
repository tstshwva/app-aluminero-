package com.aluformix.ocrprobe;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.util.Log;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

// UI completa React Native con datos de demostración, sin cuentas de producción.
@RunWith(AndroidJUnit4.class)
public class LowRamUiTest {
  private UiDevice device;
  private UiObject2 requireDescription(String description) {
    UiObject2 item=device.wait(Until.findObject(By.desc(description)),15000);
    assertNotNull("Control visible: "+description,item);
    return item;
  }
  private void metric(String name,long start) {
    Log.i("ALUFORMIX_PERF",name+"_ms="+(SystemClock.elapsedRealtime()-start));
  }
  @Test public void catalogSearchPagesAndTabsOnLimitedMemoryAndroid() throws Exception {
    Context context=InstrumentationRegistry.getInstrumentation().getContext();
    device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
    Intent launch=context.getPackageManager().getLaunchIntentForPackage("com.aluformix.cliente");
    assertNotNull("APK de demostración instalado",launch);
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);
    long start=SystemClock.elapsedRealtime();
    context.startActivity(launch);
    UiObject2 enter=null;
    while(enter==null && SystemClock.elapsedRealtime()-start<60000) {
      enter=device.findObject(By.desc("Entrar a la demostración"));
      if(enter==null) enter=device.findObject(By.text("Entrar a la demostración"));
      if(enter==null) SystemClock.sleep(100);
    }
    assertNotNull("Inicio de demostración",enter);metric("inicio_frio_demo",start);
    enter.click();
    requireDescription("Catálogo");
    start=SystemClock.elapsedRealtime();requireDescription("Catálogo").click();
    UiObject2 search=requireDescription("Buscar producto");metric("abrir_catalogo",start);
    start=SystemClock.elapsedRealtime();search.setText("07333");
    requireDescription("Ver 07333");metric("buscar_codigo",start);
    start=SystemClock.elapsedRealtime();requireDescription("Ver 07333").click();
    assertTrue("Ficha del producto",device.wait(Until.hasObject(By.textContains("Código 07333")),15000));
    metric("abrir_ficha",start);
    requireDescription("Atrás").click();
    search=requireDescription("Buscar producto");search.setText("");
    UiObject2 next=null;
    for(int i=0;i<12 && next==null;i++) {
      next=device.findObject(By.desc("Página siguiente"));
      if(next==null) next=device.findObject(By.text("Página siguiente"));
      if(next==null) device.swipe(device.getDisplayWidth()/2,device.getDisplayHeight()*3/4,device.getDisplayWidth()/2,device.getDisplayHeight()/3,16);
    }
    assertNotNull("Siguiente página accesible",next);
    start=SystemClock.elapsedRealtime();next.click();
    assertTrue("Página dos",device.wait(Until.hasObject(By.textContains("Página 2 de")),10000));
    metric("cambiar_pagina",start);
    for(String tab:new String[]{"Inicio","Catálogo","Inicio","Catálogo"}) {
      start=SystemClock.elapsedRealtime();requireDescription(tab).click();
      requireDescription("Catálogo");metric("pestana_"+tab,start);
    }
    assertEquals("Sin cierre de la app","com.aluformix.cliente",device.getCurrentPackageName());
    Log.i("ALUFORMIX_PERF",device.executeShellCommand("dumpsys meminfo com.aluformix.cliente"));
  }
}
