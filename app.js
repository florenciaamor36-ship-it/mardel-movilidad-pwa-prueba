const BASE = "./data/gtfs/";
const $ = (id) => document.getElementById(id);
let data = null;
let installPrompt = null;
let visibleStopLimit = 12;
let currentOrigin = null;
let refreshTimeout = null;
let refreshInterval = null;

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
  const route=activeRoute();
  const tripIds=new Set(lineTrips().map(t=>t.trip_id));
  const ids=new Set(data.stopTimes.filter(s=>tripIds.has(s.trip_id)).map(s=>s.stop_id));
  const timetableStops=[...ids].map(id=>data.stopById.get(id)).filter(Boolean);
  if(timetableStops.length) return timetableStops;
  return (data.addresses?.static_stops?.[route?.route_short_name]||[]).map(s=>({stop_id:s.stop_id,stop_name:"Parada",stop_lat:s.lat,stop_lon:s.lng}));
}
function renderStops(origin=currentOrigin) {
  currentOrigin=origin;
  const list=buildStopList();
  const route=activeRoute();
  const lineName=route?.route_short_name||"";
  // The GTFS often lists the two sides/directions of the same intersection as separate stops.
  // Group only when the static source gives them the exact same street-corner label.
  const grouped=new Map();
  for(const stop of list){
    const address=data.addresses?.routes?.[lineName]?.[stop.stop_id]?.text;
    const key=address?`address:${address}`:`stop:${stop.stop_id}`;
    if(!grouped.has(key)) grouped.set(key,{address,stops:[]});
    grouped.get(key).stops.push(stop);
  }
  const places=[...grouped.values()].map(group=>{
    const representative=origin?group.stops.slice().sort((a,b)=>hav(origin,a)-hav(origin,b))[0]:group.stops[0];
    return {...group,representative,distance:origin?Math.min(...group.stops.map(s=>hav(origin,s))):null};
  });
  if(origin) places.sort((a,b)=>a.distance-b.distance);
  const limited=places.slice(0, origin?Math.max(10,visibleStopLimit):visibleStopLimit);
  $("stops").innerHTML=limited.map(place=>{
    const stop=place.representative;
    const stopIds=place.stops.map(s=>s.stop_id);
    const predictions=nextTimesByDirection(stopIds);
    const title=place.address||"Dirección no disponible en los datos";
    const times=predictions.length?predictions.map(item=>`<div class="direction-row"><strong class="direction-name">Hacia ${esc(item.destination)}</strong><div class="times">${item.minutes.map(m=>`<span class="time">${fmtWait(m)}</span>`).join('')}</div></div>`).join(''):`<span class="none">El feed no da una próxima estimación para esta parada.</span>`;
    const missingDirections=[...new Set(stopIds.flatMap(id=>data.stopTimesByStop.get(id)||[]).filter(st=>data.tripById.get(st.trip_id)?.route_id===route?.route_id&&!data.freqByTrip.has(st.trip_id)).map(st=>data.tripById.get(st.trip_id)?.trip_headsign).filter(Boolean))];
    const notEstimated=missingDirections.length?`<div class="direction-note">Sin frecuencia publicada para: ${missingDirections.map(esc).join(', ')}.</div>`:'';
    const lat=Number(stop.stop_lat),lon=Number(stop.stop_lon);
    const mapApp=`geo:${lat},${lon}?q=${lat},${lon}`;
    const mapWeb=`https://maps.google.com/?q=${lat},${lon}`;
    const detail=`Parada · Línea ${esc(lineName)}${place.address?' · cruce aproximado':''}${place.stops.length>1?` · ${place.stops.length} puntos de esta esquina agrupados; tiempos separados por destino`:''}`;
    return `<article class="stop"><div class="stop-head"><div><div class="stop-title">${esc(title)}</div><div class="address-meta">${detail}</div></div>${place.distance===null?'':`<span class="distance">${fmtDistance(place.distance)}</span>`}</div>${times}${notEstimated}<a class="maplink" href="${mapApp}">Abrir en la app de mapas ↗</a> · <a class="maplink" href="${mapWeb}" target="_blank" rel="noopener noreferrer">Google Maps web</a></article>`;
  }).join('') || '<div class="empty">No hay paradas cargadas para esta línea en el feed.</div>';
  const more=$("moreStops");
  more.hidden=limited.length>=places.length;
  more.textContent=`Ver más paradas (${places.length-limited.length} restantes)`;
  const updated=new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hour:'2-digit',minute:'2-digit'}).format(new Date());
  if(!origin && list.length) $("status").textContent=`Mostrando ${limited.length} de ${places.length} esquinas agrupadas. Estimación actualizada ${updated}; se recalcula cada minuto. La ubicación es opcional.`;
  else if(origin) $("status").textContent=`Mostrando ${limited.length} de ${places.length} esquinas cercanas. Estimación actualizada ${updated}; se recalcula cada minuto. La ubicación se procesa localmente.`;
}
function startMinuteRefresh(){
  clearTimeout(refreshTimeout); clearInterval(refreshInterval);
  const refresh=()=>{if(data&&document.visibilityState==='visible'&&activeRoute())renderStops(currentOrigin);};
  refreshTimeout=setTimeout(()=>{
    refresh();
    refreshInterval=setInterval(refresh,60000);
  },60000-(Date.now()%60000)+100);
}
function fmtWait(minutes){
  if(minutes<60) return `≈ ${minutes} min`;
  const h=Math.floor(minutes/60),m=minutes%60;
  return m?`≈ ${h} h ${m} min`:`≈ ${h} h`;
}

function hasRouteFrequency(routeId){return data.freq.some(f=>data.tripById.get(f.trip_id)?.route_id===routeId);}
function nextTimesByDirection(stopIds) {
  const current=nowSeconds(), route=activeRoute(); if(!route||!hasRouteFrequency(route.route_id)) return [];
  const tripIds=new Set(lineTrips().map(t=>t.trip_id));
  const candidates=stopIds.flatMap(id=>data.stopTimesByStop.get(id)||[]);
  const output=new Map();
  for(const st of candidates){
    if(!tripIds.has(st.trip_id)) continue;
    const trip=data.tripById.get(st.trip_id);
    const destination=(trip?.trip_headsign||'Destino no informado').trim();
    const windows=data.freqByTrip.get(st.trip_id)||[];
    if(!windows.length) continue;
    const tripTimes=data.stopTimesByTrip.get(st.trip_id)||[];
    if(!tripTimes.length) continue;
    const first=tripTimes[0]; const offset=(sec(st.arrival_time)??0)-(sec(first.departure_time)??0);
    const minutes=output.get(destination)||new Set();
    for(const w of windows){
      const start=sec(w.start_time),end=sec(w.end_time),headway=+w.headway_secs;
      if(start===null||end===null||!Number.isFinite(headway)||headway<=0) continue;
      const base=start+offset; let n=Math.max(0,Math.ceil((current-base)/headway));
      for(let k=0;k<4;k++,n++){
        const leave=start+n*headway, at=leave+offset;
        if(leave>=end||at<current||at>current+24*3600) break;
        minutes.add(Math.max(1,Math.ceil((at-current)/60)));
      }
    }
    output.set(destination,minutes);
  }
  return [...output.entries()].map(([destination,minutes])=>({destination,minutes:[...minutes].sort((a,b)=>a-b).slice(0,3)})).filter(x=>x.minutes.length);
}
function updateLineStatus(){
  const route=activeRoute(); if(!route)return;
  visibleStopLimit=12; currentOrigin=null;
  const trips=data.trips.filter(t=>t.route_id===route.route_id);
  const frequencyRows=data.freq.filter(f=>data.tripById.get(f.trip_id)?.route_id===route.route_id).length;
  const staticStops=data.addresses?.static_stops?.[route.route_short_name]||[];
  const service=data.feedInfo[0];
  const start=service?.feed_start_date||"",end=service?.feed_end_date||"";
  const date=s=>s.length===8?`${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}`:s;
  $("lineStatus").textContent=frequencyRows?`${frequencyRows} franjas de frecuencia estimada en el GTFS · validez declarada ${date(start)}–${date(end)}.`:staticStops.length?`El GTFS no trae horarios para esta línea; se muestran ${staticStops.length} paradas estáticas, sin estimación de paso.`:trips.length?`El feed no publica frecuencias para esta línea; no hay horarios de paso confiables para mostrar.`:"El feed no incluye recorridos ni paradas para esta línea.";
  if(trips.length||staticStops.length) renderStops(null); else { $("stops").innerHTML=""; $("status").textContent="El feed no tiene paradas para esta línea."; }
}

function locationError(err){
  if(err.code===1) $("status").textContent="Permiso de ubicación bloqueado. Abrí esta página en Chrome y habilitá Ubicación para este sitio (candado junto a la dirección → Permisos).";
  else if(err.code===2) $("status").textContent="El teléfono no pudo determinar la ubicación. Activá Ubicación/GPS en Android y probá cerca de una ventana o al aire libre. También podés elegir una parada de la lista.";
  else if(err.code===3) $("status").textContent="La ubicación tardó demasiado. Confirmá que Ubicación esté activada y volvé a tocar; mientras tanto podés elegir una parada de la lista.";
  else $("status").textContent=`No pude obtener la ubicación${err.message?`: ${err.message}`:""}. Abrí la página en Chrome, verificá el permiso de Ubicación y probá de nuevo. También podés elegir una parada de la lista.`;
}
async function init(){
  try{
    const names=["routes","trips","stop_times","frequencies","stops","feed_info"];
    const [loaded,addressResponse]=await Promise.all([
      Promise.all(names.map(async n=>{const r=await fetch(`${BASE}${n}.txt`);if(!r.ok)throw new Error(`No se pudo leer ${n}.txt`);return csv(await r.text());})),
      fetch("./data/addresses.json?v=20261126-6",{cache:"no-store"})
    ]);
    if(!addressResponse.ok) throw new Error("No se pudo cargar la base de direcciones");
    const addresses=await addressResponse.json();
    data={routes:loaded[0],trips:loaded[1],stopTimes:loaded[2],freq:loaded[3],stops:loaded[4],feedInfo:loaded[5],addresses};
    data.stopById=new Map(data.stops.map(s=>[s.stop_id,s])); data.tripById=new Map(data.trips.map(t=>[t.trip_id,t]));
    data.stopTimesByStop=new Map(); data.stopTimesByTrip=new Map(); data.freqByTrip=new Map();
    for(const st of data.stopTimes){let a=data.stopTimesByStop.get(st.stop_id)||[];a.push(st);data.stopTimesByStop.set(st.stop_id,a);let b=data.stopTimesByTrip.get(st.trip_id)||[];b.push(st);data.stopTimesByTrip.set(st.trip_id,b);}
    for(const arr of data.stopTimesByTrip.values())arr.sort((a,b)=>+a.stop_sequence- +b.stop_sequence);
    for(const f of data.freq){let a=data.freqByTrip.get(f.trip_id)||[];a.push(f);data.freqByTrip.set(f.trip_id,a);}
    const select=$("line"); select.innerHTML=data.routes.slice().sort((a,b)=>a.route_short_name.localeCompare(b.route_short_name,'es',{numeric:true})).map(r=>`<option value="${esc(r.route_id)}">Línea ${esc(r.route_short_name)}</option>`).join('');
    if(data.routes.some(r=>r.route_id==="r511")) select.value="r511";
    select.disabled=false; $("locate").disabled=false; select.addEventListener('change',updateLineStatus); updateLineStatus(); startMinuteRefresh();
  }catch(e){$("status").textContent=`No pude cargar los horarios: ${e.message}. Revisá la conexión e intentá recargar.`;}
}
$("locate").addEventListener('click',()=>{
  if(!navigator.geolocation){$("status").textContent="Este navegador no permite geolocalización.";return;}
  $("status").textContent="Buscando tu ubicación…";
  navigator.geolocation.getCurrentPosition(pos=>{visibleStopLimit=10;renderStops({lat:pos.coords.latitude,lon:pos.coords.longitude});},locationError,{enableHighAccuracy:false,timeout:25000,maximumAge:120000});
});
$("moreStops").addEventListener('click',()=>{visibleStopLimit+=12;renderStops(currentOrigin);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&data&&activeRoute())renderStops(currentOrigin);});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$("install").classList.remove('hidden');});
$("install").addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("install").classList.add('hidden');});
window.addEventListener('appinstalled',()=>$("install").classList.add('hidden'));
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
init();
