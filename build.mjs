import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const required = ['index.html', 'styles.css', 'app.js', 'data/vocabulary.json'];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
}
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/vocabulary.json'), 'utf8'));
if (data.setCount !== 20 || data.totalWords !== 300) throw new Error(`Unexpected data count: sets=${data.setCount}, words=${data.totalWords}`);
if (data.sets.some(s => s.wordCount !== 15)) throw new Error('Every lesson must contain 15 words.');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });
for (const file of ['index.html','styles.css','app.js']) fs.copyFileSync(path.join(root,file), path.join(dist,file));
fs.copyFileSync(path.join(root,'data/vocabulary.json'), path.join(dist,'data/vocabulary.json'));
console.log(`Build complete: ${data.setCount} lessons / ${data.totalWords} words -> dist/`);
