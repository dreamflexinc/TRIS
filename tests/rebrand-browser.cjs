'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results');
fs.mkdirSync(out,{recursive:true});
const retired=String.fromCharCode(116,97,114,100,105,115),retiredPattern=new RegExp(retired,'i');
const unwantedSuffix=new RegExp('TRIScore\\s+'+'O'+'S\\b','i');
const results=[],errors=[];let browser;
const pass=name=>{results.push(name);console.log('PASS '+name);};
const manifest=JSON.parse(fs.readFileSync(path.join(root,'BUILD-MANIFEST.json'),'utf8'));
const entry=path.join(root,manifest.entry||'TRIScore4_3_InfernoLab.html');
const html=fs.readFileSync(entry,'utf8');
function sources(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sources(path.join(dir,e.name)):[path.join(dir,e.name)]);}
(async()=>{
  const files=[...sources(path.join(root,'src')),...sources(path.join(root,'base')),...sources(path.join(root,'desktop')),entry]
    .filter(p=>/\.(?:html|js|cjs|css|cs|csproj|json|ps1|md|txt)$/i.test(p));
  for(const file of files){const source=fs.readFileSync(file,'utf8');assert(!retiredPattern.test(path.basename(file)),'A source filename retains the retired identity');assert(!retiredPattern.test(source),path.relative(root,file)+' contains the retired identity');assert(!unwantedSuffix.test(source),path.relative(root,file)+' contains an unwanted product suffix');}
  for(const f of fs.readdirSync(root).filter(f=>/\.(?:md|txt)$/i.test(f)))assert(!retiredPattern.test(fs.readFileSync(path.join(root,f),'utf8')),f+' contains the retired identity');
  assert(html.includes('TRIScore'),'The new identity must appear in the entry document');
  pass('Shipping UI, model modules, desktop source and guides use the new identity');

  browser=await chromium.launch({headless:true,channel:'msedge'});
  const context=await browser.newContext({viewport:{width:1600,height:1050},reducedMotion:'reduce',acceptDownloads:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://triscore.test/',route=>route.fulfill({path:entry,contentType:'text/html'}));
  await page.goto('https://triscore.test/');
  await page.waitForFunction(()=>window.TRIScoreOrigins&&window.TRIScoreAtlas&&window.TRIScoreTris);
  assert((await page.title()).includes('TRIScore'));
  const branding={wordmark:(await page.locator('header .brand b').innerText()).trim(),title:await page.title()};
  assert.equal(branding.wordmark,'TRIScore');assert(!unwantedSuffix.test(branding.title));assert(!/\bOS\b/.test(branding.title));
  const api=await page.evaluate(()=>({origins:typeof TRIScoreOrigins.inspect,atlas:typeof TRIScoreAtlas.inspect,tris:typeof TRIScoreTris.status,topology:typeof TRIScoreTopologyLab.inspect,theme:typeof TRIScoreInfernoTheme.inspect}));
  assert.deepEqual(api,{origins:'function',atlas:'function',tris:'function',topology:'function',theme:'function'});
  pass('Renamed global APIs initialize alongside the retained workbenches');
  await page.evaluate(()=>{TRIScoreOrigins.open();TRIScoreOrigins.setMode('soup');});
  await page.locator('header').screenshot({path:path.join(out,'TRIScore-Header.png')});
  await page.screenshot({path:path.join(out,'TRIScore-Desktop.png'),fullPage:false});

  const audit=await page.evaluate(retired=>{
    const pattern=new RegExp(retired,'i'),suffix=new RegExp('TRIScore\\s+'+'O'+'S\\b','i'),pages=[...document.querySelectorAll('main > .page[id]')].map(e=>e.id),failed=[],visited=[];
    for(const id of pages){go(id);const host=document.getElementById(id);if(host.hidden)failed.push(id+': navigation remained hidden');if(pattern.test(document.body.innerText))failed.push(id+': retired visible text');if(suffix.test(document.body.innerText))failed.push(id+': unwanted product suffix');visited.push({id,title:host.querySelector('h1,h2')?.textContent||''});}
    const attrs=[...document.querySelectorAll('*')].flatMap(e=>[...e.attributes].filter(a=>['aria-label','title','alt','placeholder','download'].includes(a.name)).map(a=>a.value));
    if(attrs.some(v=>pattern.test(v)))failed.push('An accessibility or export label retains the retired identity');
    const nav=[...document.querySelectorAll('[data-go]')].map(e=>e.dataset.go);for(const id of nav)if(!document.getElementById(id))failed.push('Missing navigation target: '+id);
    return{visited,failed};
  },retired);
  assert(audit.visited.length>=24);assert.deepEqual(audit.failed,[]);
  pass('All 24 workbenches and their navigation/accessibility labels pass the runtime identity audit');

  await page.evaluate(()=>go('home'));await page.locator('#open-command').click();
  await page.locator('#command-search').fill('origins');
  await page.locator('[data-command="origins"]').click();
  assert.equal(await page.locator('#origins').getAttribute('hidden'),null);
  assert(!retiredPattern.test(await page.locator('header').innerText()));
  pass('The command palette opens Cosmic Origins under the TRIScore wordmark');

  const fill=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('input');};
  await page.evaluate(()=>TRIScoreOrigins.setMode('bang'));
  const epochs=[];for(const id of ['plasma','nuclei','atoms','darkages','firststars','cosmicweb']){await page.locator('[data-co-era="'+id+'"]').click();epochs.push(await page.evaluate(()=>{const s=TRIScoreOrigins.inspect();return{id:s.era.id,a:s.a,temp:s.tempKelvin,age:s.ageSeconds};}));}
  for(let i=1;i<epochs.length;i++){assert(epochs[i].a>epochs[i-1].a);assert(epochs[i].age>epochs[i-1].age);assert(epochs[i].temp<epochs[i-1].temp);}
  await page.evaluate(()=>{TRIScoreOrigins.setMode('bounce');TRIScoreOrigins.seek(.2);});const contracting=await page.evaluate(()=>TRIScoreOrigins.inspect());
  await page.evaluate(()=>TRIScoreOrigins.seek(.8));const expanding=await page.evaluate(()=>TRIScoreOrigins.inspect());assert(contracting.hubble<0&&expanding.hubble>0);
  pass('Expanded Big Bang epochs and the Big Bounce retain their numerical behavior');

  await page.evaluate(()=>TRIScoreOrigins.setMode('soup'));
  for(const type of ['zap','stir','magnet'])await page.locator('#co-tool-'+type).click();
  const stirred=await page.evaluate(()=>TRIScoreOrigins.inspect());assert.equal(stirred.zapCount,1);assert.equal(stirred.stirCount,1);assert.equal(stirred.magnetCount,1);assert(stirred.beadCount>100);assert(stirred.kineticEnergy>0);
  await fill('co-electric',.42);await fill('co-stir',-.31);await fill('co-magnetic',.64);
  const forced=await page.evaluate(()=>TRIScoreOrigins.inspect());assert.equal(forced.forcing.electric,.42);assert.equal(forced.forcing.stir,-.31);assert.equal(forced.forcing.magnetic,.64);
  pass('Zap, stirring and magnetization still drive actual charged/dipolar bead state');

  await page.evaluate(()=>go('colors'));
  await page.locator('#cs-hex-dark').fill('#32B4D7');await page.locator('#cs-hex-dark').dispatchEvent('change');
  await page.locator('#cs-hex-light').fill('#7B40BE');await page.locator('#cs-hex-light').dispatchEvent('change');
  await page.locator('[data-cs-mode="dark"]').click();
  await page.locator('#gp-mode').selectOption('dark');await page.locator('#gp-guard').uncheck();await page.locator('#gp-dashes').check();await fill('gp-width',3.5);
  await page.locator('#gp-hex-curve1').fill('#ED6524');await page.locator('#gp-hex-curve1').dispatchEvent('change');
  await page.locator('#gp-mode').selectOption('light');await page.locator('#gp-hex-curve1').fill('#7045BE');await page.locator('#gp-hex-curve1').dispatchEvent('change');
  const appearance=await page.evaluate(()=>({theme:GoblinColorStudio.getState(),graphs:GoblinGraphs.getState()}));
  assert.equal(appearance.theme.dark.color,'#32B4D7');assert.equal(appearance.theme.light.color,'#7B40BE');assert.equal(appearance.graphs.dark.curve1,'#ED6524');assert.equal(appearance.graphs.light.curve1,'#7045BE');
  await page.waitForTimeout(300);await page.reload();await page.waitForFunction(()=>window.TRIScoreOrigins);
  assert.deepEqual(await page.evaluate(()=>({theme:GoblinColorStudio.getState(),graphs:GoblinGraphs.getState()})),appearance);
  await page.evaluate(()=>TRIScoreOrigins.open());
  const colors=await page.evaluate(()=>TRIScoreOrigins.inspect().palette);assert.equal(colors.colors[0],'#ED6524');assert.equal(colors.width,3.5);assert(colors.dashes[1].length>0);
  pass('Independent custom light/dark colors, graph palettes, line widths and patterns survive reload');

  await page.locator('#co-title-input').fill('TRIScore rebrand verification');await page.locator('#co-save').click();
  const jsonDownload=page.waitForEvent('download');await page.locator('#co-export').click();const exported=await jsonDownload;
  assert(exported.suggestedFilename().startsWith('TRIScore-'));assert(!retiredPattern.test(exported.suggestedFilename()));
  const jsonPath=path.join(out,'TRIScore-rebrand-origins.json');await exported.saveAs(jsonPath);const exportedText=fs.readFileSync(jsonPath,'utf8');assert(!retiredPattern.test(exportedText));
  const parsed=JSON.parse(exportedText);assert(parsed.records.some(r=>r.title==='TRIScore rebrand verification'));assert(parsed.schema.startsWith('triscore.'));
  const pngDownload=page.waitForEvent('download');await page.locator('#co-png').click();const cosmicPNG=await pngDownload;assert(cosmicPNG.suggestedFilename().startsWith('TRIScore-'));await cosmicPNG.saveAs(path.join(out,'TRIScore-rebrand-origins.png'));
  pass('Origins JSON and PNG downloads use rebranded filenames and portable schemas');

  await page.evaluate(()=>TRIScoreAtlas.open());const atlas=await page.evaluate(()=>TRIScoreAtlas.inspect());assert(atlas.faces>100);assert(atlas.maxResidual<1e-9);
  const atlasPNGDownload=page.waitForEvent('download');await page.locator('#cy-png').click();const atlasPNG=await atlasPNGDownload;assert(atlasPNG.suggestedFilename().startsWith('TRIScore-'));await atlasPNG.saveAs(path.join(out,'TRIScore-rebrand-atlas.png'));
  await page.evaluate(()=>go('forge'));await page.locator('#export-workspace').click();
  const workspace=await page.locator('#export-text').inputValue();assert(!retiredPattern.test(workspace));assert.equal(typeof JSON.parse(workspace).note,'string');
  pass('Retained Atlas and workspace exports retain their functionality with the new identity');

  await page.evaluate(()=>{TRIScoreOrigins.open();TRIScoreOrigins.setMode('soup');});
  await page.screenshot({path:path.join(out,'TRIScore-Desktop-Custom.png'),fullPage:false});
  await page.evaluate(()=>go('colors'));await page.screenshot({path:path.join(out,'TRIScore-Rebrand-ColorStudio.png'),fullPage:false});
  assert.deepEqual(errors,[]);pass('The complete identity audit finishes without renderer exceptions');
  fs.writeFileSync(path.join(out,'rebrand-browser-results.json'),JSON.stringify({release:manifest.release,htmlSha256:manifest.htmlSha256,branding,passed:results.length,results,pages:audit.visited,errors},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
