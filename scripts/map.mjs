// The seven churches of Asia (Revelation 1:11; 2–3), drawn from Natural Earth (public domain).
//   node scripts/map.mjs <dir with ne_10m_land.geojson and ne_10m_minor_islands.geojson>
// Writes src/assets/seven-churches.svg. Styling lives in the page CSS (classes only), so the
// SVG carries no inline <style> and passes the site's content security policy.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { geoMercator, geoPath } from 'd3-geo';

const dir = process.argv[2];
if (!dir) throw new Error('Usage: node scripts/map.mjs <natural-earth-dir>');

const W = 900, H = 660;
const bbox = { w: 25.75, e: 29.75, s: 36.95, n: 39.55 };
// Fit to the corners (a MultiPoint avoids any question of polygon winding on the sphere).
const frame = { type: 'MultiPoint', coordinates: [[bbox.w, bbox.s], [bbox.e, bbox.n], [bbox.w, bbox.n], [bbox.e, bbox.s]] };
const projection = geoMercator().fitExtent([[0, 0], [W, H]], frame).clipExtent([[0, 0], [W, H]]);
const path = geoPath(projection).digits(1);

const inBox = (f) => {
  const [[x0, y0], [x1, y1]] = geoPath().bounds(f);
  return !(x1 < bbox.w - 1 || x0 > bbox.e + 1 || y1 < bbox.s - 1 || y0 > bbox.n + 1);
};
const land = [];
for (const file of ['ne_10m_land.geojson', 'ne_10m_minor_islands.geojson']) {
  const fc = JSON.parse(await readFile(join(dir, file), 'utf8'));
  for (const f of fc.features) {
    // Split multipolygons so far-away parts are dropped before projecting.
    const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const coords of polys) {
      const feat = { type: 'Feature', geometry: { type: 'Polygon', coordinates: coords } };
      if (inBox(feat)) land.push(feat);
    }
  }
}
const landPath = land.map((f) => path(f)).filter(Boolean).join('');

// Ancient sites (approximate positions of the ruins / modern towns).
const churches = [
  { name: 'Ephesus', lon: 27.3417, lat: 37.9411, ref: '2:1', dx: -14, dy: 6, anchor: 'end' },
  { name: 'Smyrna', lon: 27.1428, lat: 38.4189, ref: '2:8', dx: -14, dy: 6, anchor: 'end' },
  { name: 'Pergamos', lon: 27.184, lat: 39.132, ref: '2:12', dx: 0, dy: -18, anchor: 'middle' },
  { name: 'Thyatira', lon: 27.8386, lat: 38.92, ref: '2:18', dx: 14, dy: 6, anchor: 'start' },
  { name: 'Sardis', lon: 28.04, lat: 38.488, ref: '3:1', dx: 0, dy: -18, anchor: 'middle' },
  { name: 'Philadelphia', lon: 28.5214, lat: 38.35, ref: '3:7', dx: 14, dy: 6, anchor: 'start' },
  { name: 'Laodicea', lon: 29.1077, lat: 37.8358, ref: '3:14', dx: 0, dy: 28, anchor: 'middle' },
];
const patmos = { name: 'Patmos', lon: 26.547, lat: 37.316 };
const pt = (c) => projection([c.lon, c.lat]).map((v) => Math.round(v * 10) / 10);

const route = churches.map((c, i) => `${i ? 'L' : 'M'}${pt(c).join(' ')}`).join(' ');
const [px, py] = pt(patmos);
const star = (x, y, r) => {
  const p = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * 22.5 - 90) * (Math.PI / 180);
    const rr = i % 4 === 0 ? r : i % 2 === 0 ? r * 0.48 : r * 0.14;
    p.push(`${(x + rr * Math.cos(a)).toFixed(1)} ${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${p.join(' L')}Z`;
};

const [ax, ay] = projection([29.05, 39.12]);
const [sx, sy] = projection([26.05, 37.72]);

const svg = `<svg class="churches-map" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="map-title map-desc">
<title id="map-title">Map of the seven churches in Asia Minor</title>
<desc id="map-desc">The western coast of Asia Minor and the Aegean islands. Patmos lies off the coast to the south-west. The seven churches, in the order of the letters of Revelation 2 and 3: Ephesus on the coast, then north to Smyrna and Pergamos, inland to Thyatira, south-east to Sardis and Philadelphia, and Laodicea furthest east.</desc>
<rect class="sea" width="${W}" height="${H}"/>
<path class="land" d="${landPath}"/>
<text class="region" x="${ax.toFixed(0)}" y="${ay.toFixed(0)}" text-anchor="middle">ASIA</text>
<text class="sea-label" x="${sx.toFixed(0)}" y="${sy.toFixed(0)}" text-anchor="middle">Aegean Sea</text>
<path class="route" d="${route}"/>
<g class="patmos"><path class="star" d="${star(px, py, 12)}"/><text class="lbl" x="${px}" y="${py + 30}" text-anchor="middle">Patmos</text></g>
${churches
  .map((c, i) => {
    const [x, y] = pt(c);
    return `<g class="church"><circle class="dot" cx="${x}" cy="${y}" r="11"/><text class="num" x="${x}" y="${y + 4}" text-anchor="middle">${i + 1}</text><text class="lbl" x="${x + c.dx}" y="${y + c.dy}" text-anchor="${c.anchor}">${c.name}</text></g>`;
  })
  .join('\n')}
</svg>
`;

await writeFile(new URL('../src/assets/seven-churches.svg', import.meta.url), svg);
console.log(`seven-churches.svg: ${(svg.length / 1024).toFixed(1)} KB, ${land.length} land polygons`);
