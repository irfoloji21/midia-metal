import fs from 'node:fs';

const file = 'backend/database/content/reference-shop-catalogue.json';
const catalogue = JSON.parse(fs.readFileSync(file, 'utf8'));
const backup = `backend/storage/app/private/catalogue-backups/details-before-${Date.now()}.json`;
fs.copyFileSync(file, backup);

// Retain only options supported by the source's descriptive information.
// Original options remain in the backup and the archived reference API response.
const verifiedVariants = new Set([1, 35, 36, 37, 38, 39]);
const dimensions = {
  35: '430 × 430 × 220 mm', 36: '400 × 400 × 300 mm',
  37: '2450 × 700 × 350 mm', 38: '2000 × 700 × 350 mm', 39: '2450 × 700 × 350 mm',
};
const specifications = {
  24: { Profile: 'Formed divider bar' },
  25: { Brand: 'FASTCUT', 'Disc type': 'Metal cutting disc', Diameter: '115 mm', Thickness: '1.0 mm', 'Bore diameter': '22.2 mm' },
  26: { Material: 'Stainless steel', Design: 'Open front with integrated canopy' },
  29: { 'Disc type': 'Metal cutting disc', Diameter: '115 mm', Thickness: '1.0 mm', 'Bore diameter': '22.2 mm' },
  1: { 'Filter type': 'Baffle grease filter', Application: 'Commercial kitchen extraction', Care: 'Dishwasher safe' },
  5: { Application: 'Commercial kitchen equipment' },
  54: {}, 55: {},
  7: { Material: 'Stainless steel', 'Filter type': 'Baffle filter' },
  11: { Model: 'D7', 'Fan type': 'Centrifugal', Outlet: 'Rectangular, flanged' },
  47: { Brand: 'Fläkt Woods', 'Fan type': 'Axial', Casing: 'Short cylindrical casing' },
  49: { Brand: 'Fläkt Woods', Range: 'MaxFan', Casing: 'Long cylindrical casing' },
  12: { Material: '430 stainless steel', Finish: 'Brushed', 'Nominal thickness': '0.8 mm' },
  45: { Material: '430 stainless steel', Finish: 'Brushed', 'Nominal thickness': '0.9 mm' },
  13: { Material: '304 stainless steel', Finish: 'Circle polished', 'Nominal thickness': '0.9 mm' },
  42: { Material: '430 stainless steel', Finish: 'Circle polished', 'Nominal thickness': '0.8 mm' },
  43: { Material: '430 stainless steel', Finish: 'Circle polished', 'Sheet dimensions': '2500 × 1250 mm', 'Nominal thickness': '0.9 mm' },
  44: { Material: '304 stainless steel', Finish: 'Brushed', 'Nominal thickness': '0.9 mm' },
  14: { Material: 'Stainless steel', Bowls: 'Two rectangular bowls', Upstand: 'Rear', 'Lower shelf': 'Included' },
  15: { Material: 'Stainless steel', Bowl: 'Round', Upstand: 'Rear', 'Lower shelf': 'Included' },
  16: { Material: 'Stainless steel', 'Cabinet doors': 'Sliding', 'Draining area': 'Included' },
  35: { Material: 'Stainless steel', 'Bowl shape': 'Square with rounded internal corners' },
  36: { Material: 'Stainless steel', 'Bowl shape': 'Square with rounded internal corners' },
  37: { Material: 'Stainless steel', 'Bowl position': 'Centre', 'Draining areas': 'Both ends', Upstand: 'Rear' },
  38: { Material: 'Stainless steel', 'Bowl position': 'Left', 'Drainer position': 'Right', Upstand: 'Rear' },
  39: { Material: 'Stainless steel', 'Bowl position': 'Right', 'Drainer position': 'Left', Upstand: 'Rear' },
  19: { Brand: 'Steelton', 'Wheel diameter': '4 in', 'Wheel material': 'Polyurethane', 'Set quantity': '4 castors', Brakes: '2 braked castors', 'Mobile load capacity': '400 lb per set', 'Static load capacity': '500 lb per set', Assembly: 'Required' },
};
const materialLabels = {
  'Stainless Steel 430 (ECO MIRROR)': '430 stainless steel — mirror finish',
  'Stainless Steel 304 (HD BRUSHED)': '304 stainless steel — brushed finish',
  'Non-Standard': 'Custom size',
};
const formatDimensions = value => String(value).replace(/\s*x\s*/g, ' × ');
let withdrawn = 0;
for (const product of catalogue.products) {
  const id = product.source_id;
  product.frontend_variant_layout = 'default';
  product.selection_table_config = null;
  product.specifications = specifications[id];
  if (!verifiedVariants.has(id)) {
    withdrawn += product.variants?.length || 0;
    product.variants = [];
    product.variant_options = null;
    product.variant_mode = 'legacy';
    product.frontend_variant_layout = 'default';
    product.selection_table_config = null;
  }
  for (const [section, columns] of Object.entries(product.variant_table_columns || {})) {
    for (const column of columns) {
      // Shipping/package dimensions are not product specifications.
      if (column.key.startsWith('shipping_') || (section !== 'combination' && column.key.startsWith('custom:'))) column.frontendVisible = false;
      if (id !== 1 && section === 'combination') column.frontendVisible = false;
    }
  }
  if (dimensions[id]) {
    for (const variant of product.variants) {
      variant.option = 'Dimensions';
      variant.value = dimensions[id];
    }
  }
  if (id === 1) {
    product.variant_options = ['Material', 'Nominal size (in)'];
    for (const variant of product.variants) {
      const attrs = variant.attributes;
      variant.custom_fields = {
        ...variant.custom_fields,
        dimensions_mm: formatDimensions(attrs['Actual (mm)'] ?? attrs['Dimensions (mm)'] ?? variant.custom_fields?.dimensions_mm),
      };
      variant.attributes = {
        Material: materialLabels[attrs.Material] || attrs.Material,
        'Nominal size (in)': formatDimensions(attrs['OT Inches'] ?? attrs['Nominal size (in)']),
      };
    }
    if (!product.variant_table_columns.combination.some(column => column.key === 'custom:dimensions_mm')) {
      product.variant_table_columns.combination.unshift({ key: 'custom:dimensions_mm', label: 'Dimensions (mm)', visible: true, frontendVisible: true });
    }
    const labels = { 'custom:airflow': 'Airflow (m³/s)', 'custom:pd_pa': 'Pressure drop (Pa)', 'custom:part_number': 'Part number' };
    for (const column of product.variant_table_columns.combination) column.label = labels[column.key] || column.label;
  }
}
catalogue.notes = catalogue.notes.map(note => {
  if (note.startsWith('Source variants, stock')) return 'Unverified options and contradictory dimensions are withheld from the public catalogue with user approval; original records remain in the private source archive. Product prices and stock/shipping values are preserved.';
  if (note.startsWith('Source sheet variant dimensions')) return 'Contradictory sheet variant dimensions are hidden; specifications use the grade, finish and nominal thickness stated in the source product titles.';
  return note;
});
fs.writeFileSync(file, JSON.stringify(catalogue, null, 2) + '\n');
console.log(JSON.stringify({ products: catalogue.products.length, withdrawn_variants: withdrawn, remaining_variants: catalogue.products.reduce((sum, p) => sum + p.variants.length, 0), backup }));
