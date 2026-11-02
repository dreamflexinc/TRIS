const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const original=read('base/TRIScore2_Convergence.html');
const expected='bed22a23c9c79885bfe64a28b42c228033efe5586944369f0a5d409fd9233392';
if(crypto.createHash('sha256').update(original).digest('hex')!==expected)throw Error('Unexpected TRIScore 2.0 base. Review the integration before building.');
let html=original.replace('<title>TRIScore 2.0 / Convergence</title>','<title>TRIScore 4.0 / Chaos Topology</title>')
 .replace('2.0 / CONVERGENCE</span>','4.0 / CHAOS TOPOLOGY</span>')
 .replace('TRIScore 2.0 / CONVERGENCE','TRIScore 4.0 / THE LIVING MAP')
 .replace('<strong>0</strong><span>DECLARED APK PERMISSIONS</span>','<strong>Tris</strong><span>ENCRYPTED CONTINUITY</span>')
 .replace('</style></head>',read('src/tris-style.css')+'\n'+read('src/topology-style.css')+'\n</style></head>')
 .replace('</main>',read('src/tris-panel.html')+'\n'+read('src/topology-panel.html')+'\n</main>')
 .replace('<div class="header-actions">','<div class="header-actions"><button id="tp-header" class="icon-button" aria-label="Toggle floating chaos monitor">✧</button>')
 .replace('<nav aria-label="Workbench navigation">','<nav aria-label="Workbench navigation"><button data-go="topology" aria-label="Chaos Topology"><span aria-hidden="true">◈</span><span>Topology</span></button><button data-go="tris" aria-label="Tris Native"><span aria-hidden="true">✦</span><span>Tris</span></button>')
 .replace('<div class="cx-metrics">','<div class="tn-console"><div><span class="td-kicker">03 / TRIS NATIVE</span><strong>Continuity has a home.</strong><p id="tn-console-state">Sealed · unlock to mount</p></div><button data-go="tris">Open Tris Native ↗</button></div><div class="cx-metrics">');
html=html.replace('<div class="tn-console">','<div class="tp-launch"><div><span class="tp-kicker">NEW IN 4.0 / THE LIVING MAP</span><h2>Your workbench. In another dimension.</h2><p>Live signal paths, strange attractors, and a computed Calabi–Yau slice.</p></div><button data-go="topology">Enter Chaos Topology ↗</button></div><div class="tn-console">');
const added=['src/tris-core.js','src/tris-browser-store.js','src/tris-ui.js','src/topology-core.js','src/topology-telemetry.js','src/topology-ui.js'].map(read);
html=html.replace('</body>',added.map(s=>'<script>\n'+s+'\n</script>').join('\n')+'</body>');
const hash=s=>"'sha256-"+crypto.createHash('sha256').update(s).digest('base64')+"'";
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const styles=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
const policy="default-src 'none'; script-src "+scripts.map(hash).join(' ')+"; style-src "+styles.map(hash).join(' ')+"; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; media-src 'none'; base-uri 'none'; form-action 'none'";
html=html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/,(_,a,b)=>a+policy+b);
fs.writeFileSync(path.join(root,'TRIScore4_ChaosTopology.html'),html);
const originalScripts=[...original.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!originalScripts.every((s,i)=>s===scripts[i]))throw Error('A retained script changed.');
const version3Scripts=[...read('TRIScore3_TrisNative.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(version3Scripts.length!==46||!version3Scripts.every((s,i)=>s===scripts[i]))throw Error('A retained TRIScore 3.0 script changed.');
const manifest={release:'4.0.0',base:'TRIScore 2.0 / Convergence + Tris Native 3.0',baseSha256:expected,retainedScripts:originalScripts.length,trisScriptsUnchanged:3,addedScripts:added.length,htmlSha256:crypto.createHash('sha256').update(html).digest('hex')};
fs.writeFileSync(path.join(root,'BUILD-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
