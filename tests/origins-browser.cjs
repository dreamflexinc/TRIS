'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'test-results');
fs.mkdirSync(out, {recursive:true});
const port = 18766, url = `http://127.0.0.1:${port}`, results = [], errors = [];
const server = spawn(process.execPath, ['scripts/serve.cjs'], {cwd:root, env:{...process.env,TRIScore_PORT:String(port)}, windowsHide:true, stdio:'pipe'});
const pass = name => {results.push(name); console.log('PASS ' + name);};
let browser;
(async () => {
  await new Promise((resolve,reject) => {server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>{if(code)reject(Error('Test server exited: '+code));});});
  browser = await chromium.launch({headless:true,channel:'msedge'});
  const context = await browser.newContext({viewport:{width:1600,height:1100},acceptDownloads:true,reducedMotion:'reduce'});
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const inspect = () => page.evaluate(() => TRIScoreOrigins.inspect());
  const shot = () => page.evaluate(() => TRIScoreOrigins.snapshot());
  const mode = async m => {await page.locator(`[data-co-mode="${m}"]`).click();};
  const fill = async (id,value) => {await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('input');};
  await page.goto(url);
  await page.getByRole('button',{name:'Cosmic Origins: Big Bang, Big Bounce and prebiotic soup'}).click();
  assert.equal((await inspect()).paused,true);
  assert.equal((await inspect()).config.mode,'bang');
  assert(await page.evaluate(() => TRIScoreAtlas.inspect().faces > 100));
  pass('Origins navigation initializes alongside retained Atlas and respects reduced motion');

  await fill('co-timeline',200);const early=await inspect();
  await fill('co-timeline',800);const late=await inspect();
  assert(late.a>early.a && late.temperature<early.temperature);
  await page.locator('#co-play').click();
  await page.waitForTimeout(180);
  assert((await inspect()).time>late.time);
  await page.locator('#co-play').click();assert((await inspect()).paused);
  const paused=(await inspect()).time;await page.locator('#co-step').click();
  assert((await inspect()).time>paused);
  pass('Big Bang scrub, play, pause and single-step advance real finite expansion values');

  await mode('bounce');
  await fill('co-timeline',200);const contraction=await inspect();
  await fill('co-timeline',500);const minimum=await inspect();
  await fill('co-timeline',800);const expansion=await inspect();
  assert(contraction.hubble<0 && expansion.hubble>0);
  assert.equal(minimum.a,minimum.config.bounceMin);assert(Math.abs(minimum.hubble)<1e-10);
  await fill('co-minimum',.25);await page.locator('#co-apply').click();await fill('co-timeline',500);
  assert.equal((await inspect()).a,.25);
  pass('Bounce contracts, reaches the chosen positive minimum and re-expands with correct signed H');

  const camera=(await inspect()).camera;
  await page.locator('#co-canvas').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');
  assert((await inspect()).camera.yaw>camera.yaw);assert((await inspect()).camera.zoom>camera.zoom);
  const box=await page.locator('#co-canvas').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+70,box.y+box.height/2+25);await page.mouse.up();
  assert((await inspect()).camera.yaw>camera.yaw+.2);
  pass('Keyboard zoom and drag orbit update the camera without changing the physics');

  await mode('soup');await fill('co-seed',73);await page.locator('#co-apply').click();
  const initial=await shot();for(let i=0;i<6;i++)await page.locator('#co-step').click();
  const evolved=await shot();assert.notEqual(evolved.V,initial.V);assert(evolved.time>initial.time);
  const soupBox=await page.locator('#co-canvas').boundingBox();
  await page.mouse.click(soupBox.x+soupBox.width/2,soupBox.y+soupBox.height/2);
  const seeded=await shot();assert.notEqual(seeded.V,evolved.V);assert.equal(seeded.time,evolved.time);
  pass('Prebiotic reaction fields genuinely evolve and catalyst painting changes concentrations');

  const committed=(await inspect()).config.feed;
  await fill('co-feed',.045);assert.equal((await inspect()).config.feed,committed);
  await page.locator('#co-apply').click();assert.equal((await inspect()).config.feed,.045);
  await page.locator('#co-soup-preset').selectOption('filaments');await page.locator('#co-apply').click();
  assert.equal((await inspect()).config.feed,.028);
  assert.equal((await inspect()).config.kill,.057);
  pass('Draft reaction controls wait for Apply and reaction recipes commit the selected values');

  for(let i=0;i<5;i++)await page.locator('#co-step').click();
  await page.locator('#co-title-input').fill('Saved soup <img src=x onerror=alert(1)>');
  await page.locator('#co-note').fill('Synthetic QA note <script>not code</script>');
  await page.locator('#co-save').click();assert.equal((await inspect()).recordCount,1);
  const saved=await shot(),id=await page.locator('#co-library').inputValue();
  await page.reload();await page.evaluate(() => TRIScoreOrigins.open());
  assert.equal((await inspect()).recordCount,1);
  await page.locator('#co-library').selectOption(id);await page.locator('#co-load').click();
  assert.deepEqual(await shot(),saved);assert((await inspect()).paused);
  assert.equal(await page.locator('#co-record-detail script,#co-record-detail img').count(),0);
  await page.locator('#co-step').click();
  const afterRestore=await shot();
  const expected=await page.evaluate(state=>{const s=TRIScoreOriginsCore.restore(state);TRIScoreOriginsCore.step(s,.5);return TRIScoreOriginsCore.snapshot(s);},saved);
  assert.deepEqual(afterRestore,expected);
  pass('Soup snapshots persist exact state and future evolution across reload; notes remain plain text');

  const downloadPromise=page.waitForEvent('download');await page.locator('#co-export').click();
  const download=await downloadPromise,file=path.join(out,'origins-roundtrip.json');await download.saveAs(file);
  const data=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(data.records.length,1);
  const imp=JSON.parse(JSON.stringify(data));imp.records[0].id='imported-experiment';
  const importFile=path.join(out,'origins-import.json');fs.writeFileSync(importFile,JSON.stringify(imp));
  await page.locator('.co-library-card details summary').click();
  await page.locator('#co-file').setInputFiles(importFile);await page.waitForFunction(()=>!document.getElementById('co-import').disabled);
  assert.equal((await inspect()).recordCount,1);await page.locator('#co-import').click();assert.equal((await inspect()).recordCount,2);
  await page.locator('#co-file').setInputFiles([]);await page.locator('#co-file').setInputFiles(importFile);await page.waitForFunction(()=>!document.getElementById('co-import').disabled);
  await page.locator('#co-import').click();assert.equal((await inspect()).recordCount,2);
  pass('JSON export and reviewed merge import round-trip state and skip duplicate records');

  imp.records[0].state.config.grid=1e9;fs.writeFileSync(importFile,JSON.stringify(imp));
  await page.locator('#co-file').setInputFiles([]);await page.locator('#co-file').setInputFiles(importFile);
  await page.waitForFunction(()=>document.getElementById('co-status').textContent.includes('Out-of-range'));
  assert(await page.locator('#co-import').isDisabled());assert.equal((await inspect()).recordCount,2);
  pass('Oversized hostile simulation imports are rejected without altering saved data');

  const physics=await shot();await page.evaluate(()=>go('colors'));
  await page.locator('[data-cs-mode="dark"]').click();
  await page.locator('#gp-mode').selectOption('dark');await page.locator('#gp-guard').uncheck();
  await fill('gp-picker-curve1','#ee5599');await fill('gp-width',3.5);await page.locator('#gp-dashes').check();
  await page.locator('#cs-oled').check();
  await page.evaluate(()=>TRIScoreOrigins.open());
  const palette=(await inspect()).palette;
  assert.equal(palette.colors[0].toUpperCase(),'#EE5599');assert.equal(palette.width,3.5);assert(palette.dashes[1].length>0);
  assert.deepEqual(await shot(),physics);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()),'#000000');
  await page.evaluate(()=>go('colors'));await page.locator('[data-cs-mode="light"]').click();await page.evaluate(()=>TRIScoreOrigins.open());
  assert.notEqual((await inspect()).palette.colors[0].toUpperCase(),'#EE5599');
  await page.evaluate(()=>go('colors'));await page.locator('[data-cs-mode="dark"]').click();await page.evaluate(()=>TRIScoreOrigins.open());
  assert.equal((await inspect()).palette.colors[0].toUpperCase(),'#EE5599');
  pass('Independent theme/graph palettes, pure black, line weight and dash controls update Origins without changing its state');

  await page.locator('#co-play').click();await page.evaluate(()=>window.dispatchEvent(new Event('triscore-freeze')));
  assert((await inspect()).paused);
  await page.locator('#open-command').click();await page.locator('#command-search').fill('big bounce');await page.locator('[data-command="origins"]').click();
  assert(await page.locator('#origins').isVisible());
  pass('Global freeze and command-palette search integrate with the new lab');

  const imagePromise=page.waitForEvent('download');await page.locator('#co-png').click();const image=await imagePromise;
  await image.saveAs(path.join(out,'Origins-Soup-Export.png'));assert(fs.statSync(path.join(out,'Origins-Soup-Export.png')).size>5000);
  pass('PNG export produces the current rendered simulation with model labeling');

  await mode('bounce');await fill('co-timeline',660);await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});
  await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'Origins-Desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(out,'Origins-Mobile.png'),fullPage:true});
  pass('Desktop and narrow layouts render without horizontal overflow');

  await page.setViewportSize({width:1600,height:1100});
  await page.evaluate(()=>localStorage.setItem('triscore-cosmic-origins-v1','{broken'));
  await page.reload();await page.evaluate(()=>TRIScoreOrigins.open());assert((await inspect()).blocked);
  await page.locator('#co-save').click();assert.equal(await page.evaluate(()=>localStorage.getItem('triscore-cosmic-origins-v1')),'{broken');
  pass('Corrupt saved data is preserved and blocked from accidental overwrite');
  assert.deepEqual(errors,[]);pass('No unhandled renderer exceptions across all new workflows');
  fs.writeFileSync(path.join(out,'origins-browser-results.json'),JSON.stringify({passed:results.length,results,errors},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.kill();});
