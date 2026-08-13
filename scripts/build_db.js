import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folders = [
  'f:\\projects\\учим демографию\\Численность населения 9-19',
  'f:\\projects\\учим демографию\\Демография 9-19',
  'f:\\projects\\учим демографию\\Домохозяйства'
];

const outputDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const db = {
  datasets: []
};

// We will only process the .json files from the Gender API since they are cleaner and have all historical data.
for (const folder of folders) {
  if (fs.existsSync(folder)) {
    const files = fs.readdirSync(folder);
    const categoryName = path.basename(folder);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(folder, file);
        try {
          const rawData = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(rawData);
          
          const datasetId = data.name && data.name.lang_ru 
             ? data.name.lang_ru 
             : file.replace('.json', '');

          const cleanDataset = {
            id: file.replace('.json', ''),
            title: datasetId,
            category: categoryName,
            originalData: data
          };
          
          db.datasets.push(cleanDataset);
          console.log(`Processed: ${file} from ${categoryName}`);
        } catch (e) {
          console.error(`Error parsing ${file}: ${e.message}`);
        }
      }
    }
  }
}

// Write the master DB file
const dbPath = path.join(outputDir, 'db.json');
fs.writeFileSync(dbPath, JSON.stringify(db));
console.log(`\nSuccess! Wrote DB to ${dbPath}`);
console.log(`Total datasets: ${db.datasets.length}`);
