import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawDataPortalDir = path.join(__dirname, '..', 'public', 'data', 'dataportal_raw');

const keepKeywords = [
  'населен', 'родивш', 'умерш', 'смерт', 'брак', 'развод', 'домохозяйств', 
  'миграц', 'прибывш', 'выбывш', 'продолжительность жизни', 'демограф', 'рождаем',
  'молодеж', 'возраст', 'семь', 'семей'
];

const dropKeywords = [
  'школ', 'больниц', 'коек', 'учащ', 'питан', 'лагер', 'пансионат', 'интернат', 
  'вич', 'заболеван', 'диагноз', 'туберкулез', 'алкоголизм', 'наркомани', 'поликлиник', 
  'объединени', 'учреждени', 'сол', 'кормлени', 'грудном', 'пациент', 'новообразовани',
  'преступл', 'квартир', 'культур', 'услуг', 'трудо', 'занят', 'безработ', 'рабоч', 'работ', 
  'пенси', 'инвалид', 'мсп', 'предпринимател', 'прибыль', 'торгов', 'экспорт', 'импорт', 
  'урожайн', 'животн', 'энерго', 'налог', 'турист', 'экскурси', 'агроэкотуризм', 'реклам', 
  'ввп', 'доход', 'пожар', 'отход', 'растени', 'млекопитающ', 'фонд', 'зарплат', 'библиотек', 
  'музе', 'театр', 'кино', 'цирк', 'спорт', 'клуб', 'печат', 'издан', 'чрезвычайн', 'травматизм',
  'сирот', 'попечени', 'опекунск', 'усыновлен', 'приемн', 'пособи', 'помощ', 'лишен', 'центр',
  'врач', 'медицин', 'оздоровительн', 'физической', 'исследовани', 'потреблени', 'субъект'
];

if (fs.existsSync(rawDataPortalDir)) {
  let kept = 0;
  let deleted = 0;
  const dpFiles = fs.readdirSync(rawDataPortalDir);
  for (const file of dpFiles) {
    if (file.endsWith('.json')) {
      const filePath = path.join(rawDataPortalDir, file);
      try {
        const dp = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const title = (dp.name || file.replace('.json', '')).toLowerCase();
        
        let isDemography = keepKeywords.some(k => title.includes(k)) || title.includes('детей') || title.includes('ребен');
        const isExcluded = dropKeywords.some(k => title.includes(k));
        
        // Exclude specific words that matched "детей" but are not demo
        if (title.includes('детей') && !keepKeywords.some(k => title.includes(k))) {
            // we will drop general "детей" if it doesn't have other demo words
            // except a few that we want
            if (!title.includes('оставшихся без') && !title.includes('миграция') && !title.includes('численность детей')) {
               isDemography = false; 
            }
        }
        
        if (isDemography && !isExcluded) {
          kept++;
          console.log('[KEPT]', dp.name);
        } else {
          deleted++;
          console.log('[DELETED]', dp.name);
          fs.unlinkSync(filePath); // delete the file
        }
        
      } catch (e) {
         console.error(`Error processing ${file}: ${e.message}`);
      }
    }
  }
  
  console.log(`\nCleanup finished: Kept ${kept}, Deleted ${deleted} files.`);
} else {
  console.log('No raw DataPortal dir found.');
}
