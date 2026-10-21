import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const data = JSON.parse(await fs.readFile('backend/database/content/dd7-product-detail.json', 'utf8'));
const originals = path.join(root, 'reports/dd7-product/longwell-originals');
const imagePath = '/images/products/longwell-dd7-5-ec';
const target = path.join(root, 'public', imagePath);
const apiTarget = path.join(root, 'backend/public', imagePath);
await fs.mkdir(target, { recursive: true });
await fs.mkdir(apiTarget, { recursive: true });
const manifest = [];
for (const [source, filename] of [
  ['front.jpg', 'longwell-dd7-5-ec-front.webp'],
  ['side.jpg', 'longwell-dd7-5-ec-motor-side.webp'],
  ['rear.jpg', 'longwell-dd7-5-ec-rear.webp'],
  ['dimensions-original.jpg', 'longwell-dd7-5-ec-dimensions.webp'],
  ['performance-original.jpg', 'longwell-dd7-5-ec-manufacturer-curve.webp'],
]) {
  const buffer = await sharp(path.join(originals, source)).rotate().webp({ quality: 90, effort: 6 }).toBuffer();
  await fs.writeFile(path.join(target, filename), buffer);
  await fs.writeFile(path.join(apiTarget, filename), buffer);
  const { width, height } = await sharp(buffer).metadata();
  manifest.push({ source, file: `${imagePath}/${filename}`, width, height, bytes: buffer.length });
}
// Chart exported by the PDF preparation script from the exact published data points.
const chart = path.join(root, 'reports/dd7-product/performance.svg');
const chartBuffer = await sharp(chart, { density: 180 }).resize({ width: 1500 }).webp({ quality: 95 }).toBuffer();
for (const dir of [target, apiTarget]) await fs.writeFile(path.join(dir, 'longwell-dd7-5-ec-performance.webp'), chartBuffer);

const image = (file, alt) => `<img src="${imagePath}/${file}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:0 auto;" />`;
const rows = data.performance.map(row => `<tr>${row.map((n, index) => `<td>${index === 4 ? n.toFixed(1) : n.toLocaleString('en-GB')}</td>`).join('')}</tr>`).join('\n');
const html = `
<div class="product-section">
  <div class="product-split">
    <div>
      <div class="product-eyebrow">LONGWELL · LWDD7-5-EC</div>
      <h2>A compact blower with EC speed control</h2>
      <p>The DD7-5 combines a centrifugal fan with a 200 W electronically commutated motor. Its direct-drive arrangement, rectangular outlet flange and mounting base provide a defined starting point for integrating the fan into a ventilation assembly.</p>
      <p>The published duty points cover 852–1,400 m³/h. Select a point that meets both your airflow and pressure requirement, then check the drawing against the space and connection available.</p>
      <ul><li><strong>Power supply:</strong> 220 V, 50 Hz</li><li><strong>Control input:</strong> 0–10 V or PWM signal</li><li><strong>Exact model:</strong> LWDD7-5-EC</li></ul>
    </div>
    <div class="product-media">
      ${image('longwell-dd7-5-ec-front.webp', 'LONGWELL LWDD7-5-EC centrifugal blower with rectangular outlet flange and mounting base')}
      <div class="product-caption">Manufacturer product photograph: LONGWELL.</div>
    </div>
  </div>
</div>
<div class="product-spec-slot"></div>
<div class="product-section">
  <div class="product-split">
    <div class="product-media">
      ${image('longwell-dd7-5-ec-motor-side.webp', 'Motor side of the LWDD7-5-EC blower showing the EC motor, supporting frame and electrical cable')}
      <div class="product-caption">Motor-side view. External controls and accessories are not confirmed as included.</div>
    </div>
    <div>
      <div class="product-eyebrow">Motor &amp; control</div>
      <h2>Match the control to your system</h2>
      <p>LONGWELL specifies an EC motor with a 0–10 V or PWM control signal. These are control inputs; they should not be confused with the fan’s mains supply.</p>
      <p>The catalogue lists Class F insulation, NMB ball bearings and an IP55 protection rating. Rotation is clockwise when viewed from the rotor.</p>
      <p>Before connecting a controller, obtain the wiring information for this exact model and confirm signal compatibility. The published product page does not identify the terminal connections or a supplied speed controller.</p>
    </div>
  </div>
</div>
<div class="product-section">
  <div class="product-eyebrow">Dimensions &amp; connections</div>
  <h2>Check the fit before ordering</h2>
  <p>The manufacturer’s drawing shows a 302 mm overall height, a 285 mm side-view length and a 222 × 220 mm outlet flange. The outlet fixing pattern is 203 × 200 mm with eight Ø7 mm holes. All drawing dimensions are in millimetres.</p>
  <a href="${imagePath}/longwell-dd7-5-ec-dimensions.webp">${image('longwell-dd7-5-ec-dimensions.webp', 'Manufacturer dimension drawing of LWDD7-5-EC with side and front views, overall sizes and outlet fixing holes')}</a>
  <div class="product-caption">Original LONGWELL dimension drawing. Click to enlarge. The (283) mm width is shown as a reference dimension; flange dimensions are not the clear air opening.</div>
</div>
<div class="product-section">
  <div class="product-eyebrow">Airflow &amp; pressure</div>
  <h2>Choose the operating point, not just the maximum airflow</h2>
  <p>Maximum published airflow is 1,400 m³/h at zero static pressure. As the pressure requirement increases, the published airflow falls. For example, the table gives 1,134 m³/h at 160 Pa static pressure.</p>
  ${image('longwell-dd7-5-ec-performance.webp', 'Airflow against static and total pressure, plotted from the nine published LONGWELL LWDD7-5-EC operating points')}
  <div class="product-caption">Redrawn from the manufacturer’s nine data points. Lines connect published points; they are not additional measurements or a constant-speed curve.</div>
  <div class="product-table-wrap product-performance-table">
    <table><thead><tr>${data.performance_columns.map(column => `<th>${column}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
  </div>
  <div class="product-note"><p><strong>Reading the data:</strong> static and total pressure are different values. At 1,400 m³/h, static pressure is 0 Pa while total pressure is 65 Pa. The catalogue reference speed is 1,440 ± 10 rpm; speeds in the test table vary from 1,200 to 1,450 rpm. Noise readings are supplied without a measurement distance or test method.</p></div>
</div>
<div class="product-section">
  <div class="product-split">
    <div>
      <div class="product-eyebrow">Selection &amp; installation</div>
      <h2>Plan the connection and available space</h2>
      <ul>
        <li><strong>Required duty:</strong> provide your target airflow and system pressure together.</li>
        <li><strong>Electrical supply:</strong> confirm compatibility with the stated 220 V / 50 Hz rating and the chosen control signal.</li>
        <li><strong>Mechanical fit:</strong> compare the drawing with your outlet, mounting position, inlet clearance and service access.</li>
        <li><strong>Application:</strong> confirm suitability for the air being moved and the operating temperature before specifying the fan.</li>
        <li><strong>Installation:</strong> use the model-specific instructions to determine wiring, support, guarding and any required accessories.</li>
      </ul>
      <p>The published page does not provide rated current, net weight, temperature limits or terminal assignments. Contact us with the exact model code and your requirements so these details can be checked before purchase.</p>
    </div>
    <div class="product-media">
      ${image('longwell-dd7-5-ec-rear.webp', 'Rear view of LONGWELL LWDD7-5-EC centrifugal fan casing and mounting feet')}
      <div class="product-caption">Rear view of the same manufacturer-listed model.</div>
    </div>
  </div>
</div>
<div class="product-section">
  <div class="product-eyebrow">Product questions</div>
  <h2>Frequently asked questions</h2>
  <h3>Will it deliver 1,400 m³/h through any duct system?</h3>
  <p>No. That figure is the published point at zero static pressure. Ductwork, fittings and other components contribute to system resistance. Select the fan using the required airflow and pressure together.</p>
  <h3>Is DD7-5 the same as every fan sold as DD7 or DD7/7?</h3>
  <p>No. Use the complete model code <strong>LWDD7-5-EC</strong> when comparing specifications or asking for a replacement. Similar series names do not establish interchangeability.</p>
  <h3>Is a speed controller included?</h3>
  <p>The manufacturer specifies 0–10 V / PWM control capability but does not list the package contents. Confirm the controller, connectors and any other accessories required with your order.</p>
  <h3>What should I confirm before purchasing?</h3>
  <p>Confirm the duty point, electrical compatibility and mechanical fit, along with current availability, delivery arrangements, supplied accessories and applicable warranty terms. The technical data below does not establish those commercial details.</p>
</div>
<div class="product-section">
  <div class="product-eyebrow">Documents &amp; support</div>
  <h2>Keep the technical details to hand</h2>
  <p>Download the three-page product data summary for the specification table, dimension drawing and all nine performance points. For a fit or application enquiry, quote <strong>LWDD7-5-EC</strong>.</p>
  <div class="product-links">
    <a href="/documents/longwell-lwdd7-5-ec-datasheet.pdf">Download product data (PDF)</a>
    <a href="/contact">Ask about this product</a>
  </div>
  <div class="product-caption">Technical data and original photographs: <a href="${data.source_url}">LONGWELL manufacturer product page</a>. Checked 20 October 2026. The PDF is a Midia M Metal reference summary of the published data, not an installation manual.</div>
</div>
`.trim();
await fs.writeFile('backend/database/content/dd7-product-description.html', html);
await fs.writeFile('reports/dd7-product/web-assets.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ images: manifest, htmlCharacters: html.length }, null, 2));
