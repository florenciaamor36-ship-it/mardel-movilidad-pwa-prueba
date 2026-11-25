const BASE = "./data/gtfs/";
const $ = (id) => document.getElementById(id);
let data = null;
let installPrompt = null;

function csv(text) {
  const rows = []; let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { value += '"'; i++; } else if (c === '"') quoted = false; else value += c; }
    else if (c === '"') quoted = true;
    else if (c === ",") { row.push(value); value = ""; }
    else if (c === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += c;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.filter(r => r.length >= headers.length).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
const sec = (value) => { const m = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(value || ""); return m ? +m[1]*3600 + +m[2]*60 + +m[3] : null; };
function nowSeconds() { const parts = new Intl.DateTimeFormat("en-GB", { timeZone:"America/Argentina/Buenos_Aires", hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23" }).formatToParts(new Date()); const g=k=>+(parts.find(p=>p.type===k)?.value||0); return g("hour")*3600+g("minute")*60+g("second"); }
function fmtDistance(m) { return m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1).replace('.', ',')} km`; }
function hav(a,b) { const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad,h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2; return 6371000*2*Math.asin(Math.sqrt(h)); }
function esc(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function activeRoute() { return data.routes.find(r=>r.route_id===$("line").value); }
function lineTrips() { const r=activeRoute(); return data.trips.filter(t=>t.route_id===r?.route_id); }
function buildStopList() {
  const tripIds=new Set(lineTrips().map(t=>t.trip_id));
  const ids=new Set(data.stopTimes.filter(s=>tripIds.has(s.trip_id)).map(s=>s.stop_id));
  return [...ids].map(id=>data.stopById.get(id)).filter(Boolean);
}
function renderStops(origin=null) {
  const list=buildStopList();
  if(origin) list.sort((a,b)=>hav(origin,a)-hav(origin,b)); else list.sort((a,b)=>a.stop_name.localeCompare(b.stop_name,'es'));
  const limited=list.slice(0, origin?10:12);
  $("stops").innerHTML=limited.map(stop=>{
    const distance=origin?hav(origin,stop):null;
    const mins=nextTimes(stop.stop_id);
    const coords=`${Number(stop.stop_lat).toFixed(5)}, ${Number(stop.stop_lon).toFixed(5)}`;
    const times=mins.length?mins.map(m=>`<span class="time">≈ ${m} min</span>`).join(''):`<span class="none">Sin paso programado próximo disponible en este feed.</span>`;
    const map=`https://www.openstreetmap.org/?mlat=${encodeURIComponent(stop.stop_lat)}&mlon=${encodeURIComponent(stop.stop_lon)}#map=18/${encodeURIComponent(stop.stop_lat)}/${encodeURIComponent(stop.stop_lon)}`;
    return `<article class="stop"><div class="stop-head"><div><div class="stop-title">${esc(stop.stop_name||'Parada')}</div><div class="coords">${coords}</div></div>${distance===null?'':`<span class="distance">${fmtDistance(distance)}</span>`}</div><div class="times">${times}</div><a class="maplink" href="${map}" target="_blank" rel="noreferrer">Ver punto en OpenStreetMap ↗</a></article>`;
  }).join('') || '<div class="empty">No hay paradas cargadas para esta línea en el feed.</div>';
  if(!origin && list.length) $("status").textContent=`Mostrando ${limited.length} paradas de ${list.length}. Activá la ubicación para ordenar por cercanía.`;
  else if(origin) $("status").textContent=`Paradas cercanas ordenadas por distancia. La ubicación se procesa localmente.`;
}
function nextTimes(stopId) {
  const current=nowSeconds(), tripIds=new Set(lineTrips().map(t=>t.trip_id));
  const stopTimes=data.stopTimesByStop.get(stopId)||[]; const output=[];
  for(const st of stopTimes){
    if(!tripIds.has(st.trip_id)) continue;
    const routeTrip=data.tripById.get(st.trip_id); if(!routeTrip) continue;
    const tripTimes=data.stopTimesByTrip.get(st.trip_id)||[];
    if(!tripTimes.length) continue;
    const first=tripTimes[0]; const offset=(sec(st.arrival_time)??0)-(sec(first.departure_time)??0);
    const windows=data.freqByTrip.get(st.trip_id)||[];
    for(const w of windows){
      const start=sec(w.start_time),end=sec(w.end_time),headway=+w.headway_secs;
      if(start===null||end===null||!Number.isFinite(headway)||headway<=0) continue;
      const base=start+offset; let n=Math.max(0,Math.ceil((current-base)/headway));
      for(let k=0;k<3;k++,n++){
        const leave=start+n*headway, at=leave+offset;
        if(leave>=end||at<current||at>current+2*3600) break;
        const m=Math.max(1,Math.ceil((at-current)/60)); output.push(m);
      }
    }
  }
  return [...new Set(output.sort((a,b)=>a-b))].slice(0,3);
}
function updateLineStatus(){
  const route=activeRoute(); if(!route)return;
  const trips=data.trips.filter(t=>t.route_id===route.route_id);
  const service=data.feedInfo[0];
  const start=service?.feed_start_date||"",end=service?.feed_end_date||"";
  const date=s=>s.length===8?`${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}`:s;
  $("lineStatus").textContent=trips.length?`${trips.length} recorridos/variantes en el GTFS · validez declarada ${date(start)}–${date(end)}.`:"El feed identifica la línea, pero no incluye viajes para estimar el paso.";
  $("stops").innerHTML="";
  $("status").textContent=trips.length?"Elegí «Usar mi ubicación» para ver las paradas más cercanas.":"No hay horarios programados para esta línea en el feed disponible.";
}
async function init(){
  try{
    const names=["routes","trips","stop_times","frequencies","stops","feed_info"];
    const loaded=await Promise.all(names.map(async n=>{const r=await fetch(`${BASE}${n}.txt`);if(!r.ok)throw new Error(`No se pudo leer ${n}.txt`);return csv(await r.text());}));
    data={routes:loaded[0],trips:loaded[1],stopTimes:loaded[2],freq:loaded[3],stops:loaded[4],feedInfo:loaded[5]};
    data.stopById=new Map(data.stops.map(s=>[s.stop_id,s])); data.tripById=new Map(data.trips.map(t=>[t.trip_id,t]));
    data.stopTimesByStop=new Map(); data.stopTimesByTrip=new Map(); data.freqByTrip=new Map();
    for(const st of data.stopTimes){let a=data.stopTimesByStop.get(st.stop_id)||[];a.push(st);data.stopTimesByStop.set(st.stop_id,a);let b=data.stopTimesByTrip.get(st.trip_id)||[];b.push(st);data.stopTimesByTrip.set(st.trip_id,b);}
    for(const arr of data.stopTimesByTrip.values())arr.sort((a,b)=>+a.stop_sequence- +b.stop_sequence);
    for(const f of data.freq){let a=data.freqByTrip.get(f.trip_id)||[];a.push(f);data.freqByTrip.set(f.trip_id,a);}
    const select=$("line"); select.innerHTML=data.routes.slice().sort((a,b)=>a.route_short_name.localeCompare(b.route_short_name,'es',{numeric:true})).map(r=>`<option value="${esc(r.route_id)}">Línea ${esc(r.route_short_name)}</option>`).join('');
    select.disabled=false; $("locate").disabled=false; select.addEventListener('change',updateLineStatus); updateLineStatus();
    $("status").textContent=`Feed GTFS cargado · ${data.trips.length} viajes, ${data.stops.length} puntos de parada.`;
  }catch(e){$("status").textContent=`No pude cargar los horarios: ${e.message}. Revisá la conexión e intentá recargar.`;}
}
$("locate").addEventListener('click',()=>{
  if(!navigator.geolocation){$("status").textContent="Este navegador no permite geolocalización.";return;}
  $("status").textContent="Buscando tu ubicación…";
  navigator.geolocation.getCurrentPosition(pos=>renderStops({lat:pos.coords.latitude,lon:pos.coords.longitude}),err=>{$("status").textContent=err.code===1?"No diste permiso de ubicación. Podés habilitarlo en el navegador y probar de nuevo.":"No pude obtener la ubicación. Revisá el permiso y el GPS del teléfono.";},{enableHighAccuracy:true,timeout:12000,maximumAge:120000});
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$("install").classList.remove('hidden');});
$("install").addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install").classList.add('hidden');});
window.addEventListener('appinstalled',()=>$("install").classList.add('hidden'));
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
init();
