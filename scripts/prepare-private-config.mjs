// Run locally with the extracted private example dataset. Never upload output to GitHub.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Provide private examples.json and a PRIVATE output directory.');
const data=JSON.parse(fs.readFileSync(input,'utf8'));
if(data.length!==20||data.some(s=>s.words.length!==15))throw Error('Expected 20 lessons and 300 examples.');
const key=randomBytes(32).toString('base64url');
const settings={ELLA_ACCESS_KEY_SHA256:createHash('sha256').update(key).digest('hex'),ELLA_SESSION_SECRET:randomBytes(32).toString('base64url'),ELLA_EXAMPLES_GZIP:gzipSync(Buffer.from(JSON.stringify(data))).toString('base64'),ELLA_APP_ORIGIN:'https://ella-voca.vercel.app'};
if(Buffer.byteLength(JSON.stringify(settings))>60*1024)throw Error('Private environment settings too large.');
fs.mkdirSync(output,{recursive:true,mode:0o700});
fs.writeFileSync(path.join(output,'vercel-private-settings.json'),JSON.stringify(settings,null,2),{mode:0o600,flag:'wx'});
fs.writeFileSync(path.join(output,'ella-device-setup-key.txt'),key,{mode:0o600,flag:'wx'});
console.log('Private settings created. Contents were not printed. Keep both files private.');
