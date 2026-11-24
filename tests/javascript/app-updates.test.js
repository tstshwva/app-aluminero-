import test from 'node:test';
import { canAttemptNetwork } from '../../packages/mobile/src/networkState.js';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
async function setup(type='CELLULAR', reachable=true) {
 const alerts=[]; let downloads=0,reloads=0,listener;
 globalThis.__updateTest={canAttemptNetwork, alerts, effect:fn=>{listener=fn();}, Alert:{alert:(...args)=>alerts.push(args)}, AppState:{addEventListener:()=>({remove(){}})}, Updates:{isEnabled:true,checkForUpdateAsync:async()=>({isAvailable:true}),fetchUpdateAsync:async()=>{downloads++;},reloadAsync:async()=>{reloads++;}}, Network:{NetworkStateType:{WIFI:'WIFI'},getNetworkStateAsync:async()=>({type,isConnected:true,isInternetReachable:reachable}),addNetworkStateListener:()=>({remove(){}})}};
 let src=await readFile('packages/mobile/src/useAppUpdates.js','utf8');
 src=src.replace(/import[^;]+;/g,'');
 src='const {canAttemptNetwork,effect:useEffect,Alert,AppState,Updates,Network}=globalThis.__updateTest;\n'+src;
 const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\n//'+Math.random()).toString('base64'));
 mod.useAppUpdates(); await new Promise(r=>setImmediate(r));
 return {alerts,downloads:()=>downloads,reloads:()=>reloads,cleanup:()=>listener()};
}
test('Actualización con datos solicita permiso, descarga y permite aplicar ahora',async()=>{
 const s=await setup();
 assert.match(s.alerts[0][1],/datos móviles/);
 assert.equal(s.downloads(),0);
 await s.alerts[0][2].find(b=>b.text==='Descargar').onPress();
 assert.equal(s.downloads(),1);
 await s.alerts[1][2].find(b=>b.text==='Aplicar ahora').onPress();
 assert.equal(s.reloads(),1);s.cleanup();
});
test('Posponer actualización no descarga usando datos móviles',async()=>{
 const s=await setup();s.alerts[0][2].find(b=>b.text==='Después').onPress();assert.equal(s.downloads(),0);s.cleanup();
});

test('La actualización se ofrece aunque la comprobación de alcance falle con Wi-Fi conectado',async()=>{
 const s=await setup('WIFI',false);
 assert.equal(s.alerts[0][0],'Actualización disponible');
 assert.equal(s.downloads(),0);
 s.cleanup();
});