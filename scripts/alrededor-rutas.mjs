// Distancias de «Alrededor» con OSRM (servidor público, perfil coche, datos de OpenStreetMap ODbL) y, para lo que está
// cerca, a pie (routing.openstreetmap.de, perfil foot). Receta de ../amaicha-ribadesella-web/scripts/alrededor-rutas.mjs.
// Origen: el edificio en el Catastro (E00306700QJ22G); el pin de su Google Maps cae ~190 m al oeste, en el bosque.
// Destinos: elementos de OSM buscados con Overpass el 2026-11-25 (ids abajo; User-Agent genérico).
//   node scripts/alrededor-rutas.mjs   → ref/raw/rutas.json   (lo lee construir.mjs; ninguna cifra se escribe a ojo)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { osrm, dormir, hav, UA } from './alrededor-util.mjs';

async function aPie(a, b) {
  const u = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) }); if (r.ok) { const j = await r.json(); if (j.code === 'Ok') return { km: +(j.routes[0].distance / 1000).toFixed(1), minutos: Math.round(j.routes[0].duration / 60), snap_destino_m: Math.round(j.waypoints[1].distance) }; } } catch (e) {} await dormir(2000); }
  return null;
}

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASA = { lat: 43.5773554, lon: -6.2490802, fuente: 'Catastro, edificio E00306700QJ22G (el pin de su enlace de Google Maps, 43.577007, -6.2514292, cae en el bosque ~190 m al oeste); la casa no está en OSM' };
const LUGARES = [
  { id: 'vidio', nombre: 'Faro y acantilados de Cabo Vidio', grupo: 'costa', osm: 'node/100170985 (Faro de Vidio, man_made=lighthouse)', lat: 43.593259, lon: -6.242996, pie: true },
  { id: 'vallina', nombre: 'Playa de La Vallina', grupo: 'costa', osm: 'way/554747277 (Playa de Vallina o del Gallo)', lat: 43.5775777, lon: -6.2598269, pie: true },
  { id: 'silencio', nombre: 'Playa del Silencio', grupo: 'costa', osm: 'way/229915252 (Playa Gavieiro, la del Silencio)', lat: 43.5666791, lon: -6.2961357 },
  { id: 'ovinana', nombre: 'Oviñana', grupo: 'pueblos', osm: 'node/100170735 (place=hamlet)', lat: 43.576717, lon: -6.23608, pie: true },
  { id: 'cudillero', nombre: 'Cudillero', grupo: 'pueblos', osm: 'node/69248638 (place=village)', lat: 43.563325, lon: -6.145806 },
  { id: 'luarca', nombre: 'Luarca', grupo: 'pueblos', osm: 'node/101422863 (place=town)', lat: 43.5439, lon: -6.53574 },
  { id: 'ovd', nombre: 'Aeropuerto de Asturias', grupo: 'llegar', osm: 'way/35951935 (aeroway=aerodrome)', lat: 43.561598, lon: -6.033073 },
];
const resumen = (j) => {
  const r = j.routes[0];
  const carreteras = [];
  for (const leg of r.legs) for (const s of leg.steps) { const ref = (s.ref || '').split(';')[0].trim(); if (ref && s.distance > 200 && carreteras[carreteras.length - 1] !== ref) carreteras.push(ref); }
  return { km: +(r.distance / 1000).toFixed(1), minutos: Math.max(1, Math.round(r.duration / 60)), carreteras, snap_destino_m: Math.round(j.waypoints[1].distance) };
};
const salida = {
  fuente: 'OSRM (router.project-osrm.org, perfil coche, datos de OpenStreetMap ODbL)',
  fecha: new Date().toISOString().slice(0, 10),
  nota: 'Coche: OSRM público. A pie (faro, La Vallina y Oviñana): routing.openstreetmap.de/routed-foot. Tiempos con velocidades teóricas, sin tráfico ni paradas: orientativos. «snap_destino_m» = distancia del punto del lugar al camino o carretera más cercano.',
  casa: CASA,
  llegar: LUGARES.map((l) => l.id),
  destinos: {},
};
for (const l of LUGARES) {
  const ida = resumen(await osrm(CASA, l));
  await dormir(900);
  const pie = l.pie ? await aPie(CASA, l) : null;
  salida.destinos[l.id] = { nombre: l.nombre, grupo: l.grupo, osm: l.osm, lat: l.lat, lon: l.lon, recta_km: +(hav(CASA, l) / 1000).toFixed(1), desde_casa: ida, ...(pie ? { a_pie: pie } : {}) };
  console.log(l.id.padEnd(10), String(ida.km).padStart(6), 'km', String(ida.minutos).padStart(4), 'min | recta', salida.destinos[l.id].recta_km, 'km | snap', ida.snap_destino_m, 'm |', ida.carreteras.join('>'), pie ? `| a pie ${pie.km} km ${pie.minutos} min` : '');
}
fs.mkdirSync(path.join(RAIZ, 'ref/raw'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'ref/raw/rutas.json'), JSON.stringify(salida, null, 1));
console.log('ref/raw/rutas.json');
