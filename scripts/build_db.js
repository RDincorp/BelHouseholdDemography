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

        const years = dp.years || ['2021', '2022', '2023', '2024', '2025'];
        const headerDims = dp.headerDims || ['Категория'];

        // Period dimension
        const convertedDims = [
          {
            code: 'PERIOD',
            name: { lang_ru: 'Период' },
            items: years.map(y => ({ id: y, name: { lang_ru: y } }))
          }
        ];

        // Label map for dim items to IDs
        const dimItemMaps = [];

        headerDims.forEach((dimName, dimIdx) => {
          const uniqueItems = new Set();
          (dp.rows || []).forEach(r => {
            if (r.labels && r.labels[dimIdx]) {
              uniqueItems.add(r.labels[dimIdx].trim());
            }
          });

          const itemsArr = Array.from(uniqueItems);
          const itemToIdMap = new Map();
          itemsArr.forEach((label, i) => {
            itemToIdMap.set(label, `v_${i}`);
          });

          dimItemMaps.push(itemToIdMap);

          convertedDims.push({
            code: `dim_${dimIdx}`,
            name: { lang_ru: dimName },
            items: itemsArr.map((label, i) => ({
              id: `v_${i}`,
              name: { lang_ru: label }
            }))
          });
        });

        // Build dataset observations
        const convertedDataset = {};
        
        (dp.rows || []).forEach(r => {
          if (!r.values || r.values.length < years.length) return;
          
          // Row dimension label IDs
          const rowLabelIds = [];
          headerDims.forEach((_, dimIdx) => {
            const label = (r.labels && r.labels[dimIdx]) ? r.labels[dimIdx].trim() : '';
            const idMap = dimItemMaps[dimIdx];
            if (idMap && idMap.has(label)) {
              rowLabelIds.push(idMap.get(label));
            } else {
              rowLabelIds.push('v_0');
            }
          });

          // Year values are at the end of r.values
          const yearValues = r.values.slice(-years.length);
          
          yearValues.forEach((numStr, yIdx) => {
            const year = years[yIdx];
            if (!numStr) return;
            const cleanNum = parseFloat(String(numStr).replace(/\s/g, '').replace(',', '.'));
            if (!isNaN(cleanNum)) {
              const key = [year, ...rowLabelIds].join(':');
              convertedDataset[key] = cleanNum;
            }
          });
        });

        const dpDataset = {
          id: `dp_${code}`,
          title: title,
          category: 'Статистика населения',
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
