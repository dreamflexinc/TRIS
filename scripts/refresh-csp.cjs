'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const hash=text=>"'sha256-"+crypto.createHash('sha256').update(text).digest('base64')+"'";
for(const file of [...fs.readdirSync(root).filter(f=>f.endsWith('.html')).map(f=>path.join(root,f)),...fs.readdirSync(path.join(root,'base')).filter(f=>f.endsWith('.html')).map(f=>path.join(root,'base',f))]){
 let html=fs.readFileSync(file,'utf8').replace(/\r\n?/g,'\n');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]),styles=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
 html=html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(">)/,(_,a,policy,b)=>a+policy.replace(/script-src [^;]+/,'script-src '+scripts.map(hash).join(' ')).replace(/style-src [^;]+/,'style-src '+styles.map(hash).join(' '))+b);
 fs.writeFileSync(file,html);
}
console.log('Refreshed inline content hashes for the renamed offline documents.');
