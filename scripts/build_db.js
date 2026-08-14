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

// Russian translation dictionary for dimension titles
const DIMENSION_TITLE_TRANSLATIONS = {
  'Territory of the Republic of Belarus': 'Территория',
  'Territory of the Republic of Belarus (village councils)': 'Территория (сельсоветы)',
  'Republic of Belarus': 'Территория',
  'Type of settlement': 'Тип населенного пункта',
  'Units of measurement': 'Единица измерения',
  'Age composition': 'Возрастной состав',
  'Gender': 'Пол',
  'Floor': 'Пол',
  'Type of area': 'Тип местности',
  'Type of terrain': 'Тип местности',
  'Residential areas': 'Зоны проживания',
  'Types of families with children under 18 years of age': 'Типы семей с детьми до 18 лет',
  'Main causes of death': 'Основные причины смерти',
  'Types of death': 'Типы смертности',
  'Countries of the world/groups of countries': 'Страны / группы стран',
  'Level of education': 'Уровень образования',
  'Migration flows': 'Миграционные потоки',
  'Direction of migration': 'Направление миграции',
  'Main disease classes': 'Классы болезней',
  'Reason for leaving': 'Причина выбытия'
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
        
        // Build Codelist lookup map for Russian names
        const codelists = dp.dsd?.data?.codelists || [];
        const clMap = {};
        codelists.forEach(cl => {
          clMap[cl.id] = {};
          (cl.codes || []).forEach(c => {
            clMap[cl.id][c.id] = c.names?.ru || c.name;
          });
        });

        const dsdDims = dp.dsd?.data?.dataStructures?.[0]?.dataStructureComponents?.dimensionList?.dimensions || [];

        // Build dimensions array
        const convertedDims = obsDims.map(d => {
          // Find codelist for this dimension
          const dsdDim = dsdDims.find(dd => dd.id === d.id);
          let clId = null;
          if (dsdDim?.localRepresentation?.enumeration) {
            const match = dsdDim.localRepresentation.enumeration.match(/CL_[a-zA-Z0-9_]+/);
            if (match) clId = match[0];
          }

          const dimRuName = DIMENSION_TITLE_TRANSLATIONS[d.name] || d.name || d.id;

          return {
            code: d.id,
            name: { lang_ru: dimRuName },
            items: (d.values || []).map(v => {
              let valRuName = v.name;
              if (clId && clMap[clId] && clMap[clId][v.id]) {
                valRuName = clMap[clId][v.id];
              }
              return {
                id: v.id,
                name: { lang_ru: valRuName || v.id }
              };
            })
          };
        });

        // Default period dimension if missing
        let hasPeriod = convertedDims.some(d => d.code === 'PERIOD' || d.code === 'TIME_PERIOD');
        if (!hasPeriod) {
          convertedDims.unshift({
            code: 'PERIOD',
            name: { lang_ru: 'Период' },
            items: [
              { id: '2024', name: { lang_ru: '2024' } },
              { id: '2025', name: { lang_ru: '2025' } }
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
          
          // If we added a dummy PERIOD dim first, prepend '2024'
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
