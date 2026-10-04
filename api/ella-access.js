const {createHash,createHmac,timingSafeEqual} = require('node:crypto');
const {gunzipSync} = require('node:zlib');
const COOKIE='__Host-ella-example';
const LIFETIME=90*24*60*60;
const digest=v=>createHash('sha256').update(v).digest('hex');
function same(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);}
function sign(payload,secret){return createHmac('sha256',secret).update(payload).digest('base64url');}
function authorized(req,secret){
 try{
  const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!token||token.length>1024)return false;
  const [payload,signature,...rest]=token.split('.');if(rest.length||!same(signature,sign(payload,secret)))return false;
  const x=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  return x.subject==='ella'&&Number.isInteger(x.expires)&&x.expires>Math.floor(Date.now()/1000);
 }catch{return false;}
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');
 const reply=(status,body)=>res.status(status).json(body);
 const secret=process.env.ELLA_SESSION_SECRET;
 const keyHash=process.env.ELLA_ACCESS_KEY_SHA256;
 const dataset=process.env.ELLA_EXAMPLES_GZIP;
 const origin=process.env.ELLA_APP_ORIGIN||'https://ella-voca.vercel.app';
 if(!secret||secret.length<32||!keyHash||!/^[a-f0-9]{64}$/.test(keyHash)||!dataset)return reply(503,{error:'not_configured'});
 if(req.method==='POST'){
  // Reject cross-site requests, including preview domains unless explicitly configured.
  if(req.headers.origin!==origin)return reply(403,{error:'forbidden'});
  const type=String(req.headers['content-type']||'');if(!type.startsWith('application/json'))return reply(415,{error:'invalid_request'});
  let body=req.body;
  try{if(typeof body==='string')body=JSON.parse(body);}catch{return reply(400,{error:'invalid_request'});}
  if(body?.action==='logout'){
   res.setHeader('Set-Cookie',COOKIE+'=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');return reply(200,{ok:true});
  }
  const key=body?.key;
  // The setup key is high entropy, never a short PIN or client-side password.
  if(typeof key!=='string'||key.length<32||key.length>128||!same(digest(key),keyHash))return reply(401,{error:'unauthorized'});
  const payload=Buffer.from(JSON.stringify({subject:'ella',expires:Math.floor(Date.now()/1000)+LIFETIME})).toString('base64url');
  res.setHeader('Set-Cookie',`${COOKIE}=${payload}.${sign(payload,secret)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${LIFETIME}`);
  return reply(200,{ok:true});
 }
 if(req.method!=='GET'){res.setHeader('Allow','GET, POST');return reply(405,{error:'method_not_allowed'});}
 if(!authorized(req,secret))return reply(401,{error:'unauthorized'});
 try{
  const sets=JSON.parse(gunzipSync(Buffer.from(dataset,'base64'),{maxOutputLength:1024*1024}).toString('utf8'));
  if(!Array.isArray(sets)||sets.length!==20||sets.some(s=>!Array.isArray(s.words)||s.words.length!==15))throw Error();
  return reply(200,{sets});
 }catch{return reply(503,{error:'unavailable'});}
};
