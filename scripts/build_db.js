import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..', '..');
const outputDir = path.join(__dirname, '..', 'public', 'data');
const rawDataPortalDir = path.join(outputDir, 'dataportal_raw');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const db = {
  datasets: []
};

// 1. Process Gender API Datasets
const genderFolders = [
  path.join(rootDir, 'Численность населения 9-19'),
  path.join(rootDir, 'Демография 9-19'),
  path.join(rootDir, 'Домохозяйства')
];

const datasetsByTitle = new Map();

for (const folder of genderFolders) {
  if (fs.existsSync(folder)) {
    const files = fs.readdirSync(folder);
    const categoryName = path.basename(folder);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(folder, file);
        try {
          const rawData = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(rawData);
          
          const title = data.name && data.name.lang_ru 
             ? data.name.lang_ru.trim() 
             : file.replace('.json', '').trim();

          const cleanDataset = {
            id: file.replace('.json', ''),
            title: title,
            category: categoryName,
            source: 'Gender API',
            originalData: data
          };
          
          datasetsByTitle.set(title.toLowerCase(), cleanDataset);
          console.log(`[Gender API] Loaded: ${file}`);
        } catch (e) {
          console.error(`Error parsing ${file}: ${e.message}`);
        }
      }
    }
  }
}

// 2. Process DataPortal Datasets
if (fs.existsSync(rawDataPortalDir)) {
  const dpFiles = fs.readdirSync(rawDataPortalDir);
  for (const file of dpFiles) {
    if (file.endsWith('.json')) {
      const filePath = path.join(rawDataPortalDir, file);
      try {
        const dp = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const title = (dp.name || file.replace('.json', '')).trim();
        const code = dp.code || file.replace('.json', '');

        // Convert DataPortal SDMX structure to App.jsx compatible structure
        const obsDims = dp.data?.structure?.dimensions?.observation || [];
        
        // Build dimensions array
        const convertedDims = obsDims.map(d => ({
          code: d.id,
          name: { lang_ru: d.name || d.id },
          items: (d.values || []).map(v => ({
            id: v.id,
            name: { lang_ru: v.name || v.id }
          }))
        }));

        // Default period dimension if missing
        let hasPeriod = convertedDims.some(d => d.code === 'PERIOD' || d.code === 'TIME_PERIOD');
        if (!hasPeriod) {
          convertedDims.unshift({
            code: 'PERIOD',
            name: { lang_ru: 'Период (Актуальные данные)' },
            items: [
              { id: '2024', name: { lang_ru: '2024' } },
              { id: '2025', name: { lang_ru: '2025' } },
              { id: '2026', name: { lang_ru: '2026' } }
            ]
          });
        }

        // Build dataset observations
        const convertedDataset = {};
        const obsObj = dp.data?.dataSets?.[0]?.observations || {};
        
        Object.entries(obsObj).forEach(([key, valArr]) => {
          if (!valArr || valArr.length === 0) return;
          const val = valArr[0];
          const indices = key.split(':');
          
          // Map indices to item IDs
          const keyCodes = [];
          
          // If we added a dummy PERIOD dim first, prepend '2024' (or latest year)
          if (!hasPeriod) {
            keyCodes.push('2024');
          }

          obsDims.forEach((dim, idx) => {
            const index = parseInt(indices[idx], 10);
            if (!isNaN(index) && dim.values && dim.values[index]) {
              keyCodes.push(dim.values[index].id);
            } else {
              keyCodes.push('T');
            }
          });

          convertedDataset[keyCodes.join(':')] = val;
        });

        const dpDataset = {
          id: `dp_${code}`,
          title: title,
          category: dp.category || 'DataPortal (2019-2026)',
          source: 'DataPortal API',
          originalData: {
            structure: {
              dimensions: convertedDims
            },
            dataset: convertedDataset
          }
        };

        const existingKey = title.toLowerCase();
        if (datasetsByTitle.has(existingKey)) {
          // Merge datasets if matching title exists
          const existing = datasetsByTitle.get(existingKey);
          Object.assign(existing.originalData.dataset, convertedDataset);
          existing.title += ' (Gender + DataPortal)';
          console.log(`[Merged] ${title}`);
        } else {
          datasetsByTitle.set(existingKey, dpDataset);
        }
      } catch (e) {
        console.error(`Error processing DataPortal file ${file}: ${e.message}`);
      }
    }
  }
}

// 3. Save to db.json
db.datasets = Array.from(datasetsByTitle.values());

const dbPath = path.join(outputDir, 'db.json');
fs.writeFileSync(dbPath, JSON.stringify(db));

console.log(`\n====================================`);
console.log(`Success! Wrote master DB to: ${dbPath}`);
console.log(`Total Unified Datasets: ${db.datasets.length}`);
console.log(`====================================\n`);
