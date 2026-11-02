(async () => {
  const checks = [], q = id => document.getElementById(id);
  window.__desktopQA = {done:false, checks};
  const ok = (condition, message) => {if (!condition) throw Error(message); checks.push(message);};
  const until = async predicate => {const end=Date.now()+30000; while(!predicate()){if(Date.now()>end)throw Error('Timed out: '+predicate);await new Promise(r=>setTimeout(r,60));}};
  const fill = (id, value) => {q(id).value=value;q(id).dispatchEvent(new Event('input',{bubbles:true}));};
  const pass = 'synthetic desktop test passphrase only';
  try {
    await until(()=>window.TRIScoreTris && window.TRIScoreTopologyLab && q('tn-status').textContent);
    ok(isSecureContext && !!crypto.subtle && !!indexedDB, 'Secure context, Web Crypto and IndexedDB available in packaged host');
    ok(!!GoblinMatterLab && !!GoblinResonanceLab && !!TRIScoreCapsules, 'Retained labs initialized');
    if (window.__testStage.startsWith('atlas')) {
      TRIScoreAtlas.open();
      ok(!!TRIScoreAtlas && TRIScoreAtlas.inspect().faces > 100, 'Packaged atlas initialized and generated geometry');
      ok(TRIScoreAtlas.inspect().maxResidual < 1e-10, 'Packaged polynomial residual below 1e-10');
      if (window.__testStage === 'atlas') {
        fill('cy-title-input','NATIVE ATLAS PERSISTENCE');fill('cy-note','Synthetic manifold experiment');
        fill('cy-mix','1.73');q('cy-save-experiment').click();
        await until(()=>TRIScoreAtlas.inspect().recordCount===1);
        q('cy-notebook').click();
        ok(q('note').value.includes('NATIVE ATLAS PERSISTENCE'),'Experiment appended to native notebook');
      } else {
        ok(TRIScoreAtlas.inspect().recordCount===1,'Atlas experiment survives full Windows process restart');
        q('cy-library').selectedIndex=1;q('cy-load').click();
        ok(Math.abs(TRIScoreAtlas.inspect().config.mix-1.73)<1e-8,'Camera and projection recipe restored in native host');
        ok(q('note').value.includes('NATIVE ATLAS PERSISTENCE'),'Native notebook capture survives process restart');
      }
      window.__desktopQA={done:true,checks};return;
    }
    go('tris');
    await until(()=>q('tn-status').textContent.includes('Ready') || q('tn-status').textContent.includes('Encrypted Tris'));
    if (window.__testStage === 'create') {
      fill('tn-pass',pass);fill('tn-confirm',pass);q('tn-create').click();
      await until(()=>!q('tn-workspace').hidden);
      fill('tn-memory-title','Desktop continuity check');fill('tn-body','DESKTOP_PRIVATE_MEMORY');q('tn-save-memory').click();
      await until(()=>q('tn-status').textContent.includes('Memory saved'));
      ok(q('tn-memory-list').textContent.includes('DESKTOP_PRIVATE_MEMORY'),'Memory saved through actual desktop UI');
      localStorage.setItem('desktop-test-identity',JSON.parse(q('tn-identity').textContent).id);
      document.querySelector('[data-tn-tab="recovery"]').click();
      fill('tn-backup-pass',pass);fill('tn-backup-confirm',pass);q('tn-export').click();
      await until(()=>q('tn-status').textContent.includes('prepared for download'));
    } else if (window.__testStage === 'import') {
      fill('tn-import-text',window.__testBackup);fill('tn-import-pass',pass);q('tn-review').click();
      await until(()=>q('tn-status').textContent.includes('Backup authenticated'));
      const review=JSON.parse(q('tn-review-info').textContent);
      fill('tn-import-pass',pass);fill('tn-import-new',pass);fill('tn-import-new-confirm',pass);
      fill('tn-import-confirm','IMPORT '+review.identity.id);q('tn-import').click();
      await until(()=>!q('tn-workspace').hidden);
      ok(q('tn-memory-list').textContent.includes('DESKTOP_PRIVATE_MEMORY'),'Encrypted backup imports through desktop owner controls');
      ok(q('tn-permissions').textContent==='{}','Import clears previous service permissions');
    } else {
      ok(q('tn-workspace').hidden && !TRIScoreTris.status().mounted,'Fresh executable launch begins sealed');
      fill('tn-pass',pass);q('tn-unlock').click();await until(()=>!q('tn-workspace').hidden);
      ok(JSON.parse(q('tn-identity').textContent).id===localStorage.getItem('desktop-test-identity'),'Identity survives full executable exit and relaunch');
      ok(q('tn-memory-list').textContent.includes('DESKTOP_PRIVATE_MEMORY'),'Memory survives full executable exit and relaunch');
    }
    const raw=await new TrisBrowserStore().read();
    ok(typeof raw==='string'&&!raw.includes('DESKTOP_PRIVATE_MEMORY')&&!raw.includes(pass),'Persisted vault contains encrypted payload only');
    TRIScoreTopologyLab.open();
    ok(TRIScoreTopologyLab.snapshot().observation.nodes.length>20,'Topology observes registered modules in desktop shell');
    ok(!JSON.stringify(TRIScoreTopologyLab.snapshot()).includes('DESKTOP_PRIVATE_MEMORY'),'Topology excludes private memory');
    TRIScoreTris.seal();
    ok(!TRIScoreTris.status().mounted,'Explicit seal clears mounted Tris');
    window.__desktopQA={done:true,checks,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth+1}};
  } catch(error) {window.__desktopQA={done:true,checks,error:String(error.stack||error)};}
})();
