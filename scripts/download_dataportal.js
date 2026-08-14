import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'dataportal_raw');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to fetch data
function fetchPost(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
        'Accept-Language': 'ru',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            console.error(`Status ${res.statusCode} from ${url}`);
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log("Starting DataPortal download...");
  const rubrics = [
    { id: 1063261, name: "Статистика населения" },
    { id: 1063262, name: "Статистика естественного движения населения" },
    { id: 1063263, name: "Статистика миграции населения" }
  ];

  for (const rubric of rubrics) {
    console.log(`\nFetching indicators for rubric: ${rubric.name}...`);
    const searchRes = await fetchPost('https://dataportal.belstat.gov.by/osids-public-api/indicator/indicatorSearch', { rubricId: rubric.id });
    
    if (!searchRes || !searchRes.items) {
      console.log(`No items found for ${rubric.name}`);
      continue;
    }

    console.log(`Found ${searchRes.items.length} indicators.`);
    
    for (const item of searchRes.items) {
      const code = item.code;
      const safeName = item.name.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').trim();
      console.log(`  Downloading: ${code} - ${safeName.substring(0, 50)}...`);
      
      const valuesRes = await fetchPost('https://dataportal.belstat.gov.by/osids-public-api/indicator/indicatorValuesSdmxJsonGet', { indicatorCode: code });
      const dsdRes = await fetchPost('https://dataportal.belstat.gov.by/osids-public-api/indicator/indicatorDsdSdmxJsonGet', { indicatorCode: code });
      
      if (valuesRes && dsdRes) {
         // Create a composite file with both
         const combined = {
             code: code,
             name: item.name,
             category: rubric.name,
             periodicities: item.periodicities,
             dsd: dsdRes,
             data: valuesRes
         };
         
         const filePath = path.join(DATA_DIR, `${code}.json`);
         fs.writeFileSync(filePath, JSON.stringify(combined));
      } else {
         console.log(`    -> Failed to download data/DSD for ${code}`);
      }
      
      // small delay to avoid overwhelming the server
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.log("\nDownload complete!");
}

run().catch(console.error);
