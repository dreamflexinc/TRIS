(async () => {
  const checks = [], q = id => document.getElementById(id);
  window.__desktopQA = {done:false, checks};
  const ok = (condition, message) => {if (!condition) throw Error(message); checks.push(message);};
  const until = async predicate => {const end=Date.now()+25000; while(!predicate()){if(Date.now()>end)throw Error('Timed out: '+predicate);await new Promise(r=>setTimeout(r,60));}};
  const fill = (id,value,event='input') => {q(id).value=String(value);q(id).dispatchEvent(new Event(event,{bubbles:true}));};
  const pause = () => TRIScoreOrigins.pause();
  const mode = id => {document.querySelector('[data-co-mode="'+id+'"]').click();pause();};
  const metric = () => Number(q('co-metric-1').textContent);
  try {
    await until(()=>window.TRIScoreOrigins && window.TRIScoreAtlas && window.TRIScoreTris && q('tn-status').textContent);
    TRIScoreOrigins.open();pause();
    ok(isSecureContext && !!crypto.subtle && !!indexedDB,'Packaged secure context and encrypted-vault APIs available');
    ok(!!GoblinMatterLab && !!GoblinResonanceLab && !!TRIScoreCapsules && !!GoblinColorStudio,'Retained labs, capsules and Color Studio initialized');
    ok(TRIScoreAtlas.inspect().faces>100 && TRIScoreAtlas.inspect().maxResidual<1e-10,'Retained Manifold Atlas generates valid sampled geometry');
    ok(!!q('gp-picker-curve1') && !!q('gp-picker-grid') && !!q('gp-picker-background') && !!q('gp-width'),'Independent Graph Studio controls preserved');
    if(window.__testStage==='origins-legacy') {
      const old=JSON.parse(window.__legacyOriginsLibrary),r=old.records[0];
      ok(localStorage.getItem('triscore-cosmic-origins-v1')===window.__legacyOriginsLibrary,'Original 4.2 library remains byte-identical after automatic migration');
      ok(TRIScoreOrigins.inspect().recordCount===1&&!!localStorage.getItem('triscore-inferno-origins-v2'),'4.2 experiments automatically copied into separate Inferno library');
      q('co-library').selectedIndex=1;q('co-load').click();pause();const migrated=TRIScoreOrigins.snapshot();
      ok(migrated.config.seed===r.state.config.seed&&migrated.time===r.state.time,'Legacy soup seed and clock restored exactly');
      ok(migrated.U===r.state.U&&migrated.V===r.state.V,'Legacy soup concentrations restored byte-identically');
      ok(migrated.schema==='triscore-origins-state/v2'&&TRIScoreOrigins.inspect().beadCount>0,'Legacy state upgraded with bounded coarse-grained particles');
      ok(migrated.forcing.electric===0&&migrated.forcing.stir===0&&migrated.forcing.magnetic===0,'Legacy experiment starts with zero forcing');
      ok(localStorage.getItem('triscore-cosmic-origins-v1')===window.__legacyOriginsLibrary,'Restoring copied experiment leaves original 4.2 library unchanged');
    } else if(window.__testStage==='origins-reopen') {
      ok(TRIScoreOrigins.inspect().recordCount===1,'Origins experiment survives full Windows process restart');
      q('co-library').selectedIndex=1;q('co-load').click();pause();
      ok(document.querySelector('[data-co-mode="soup"]').getAttribute('aria-pressed')==='true','Soup snapshot restores its simulation mode');
      ok(Number(q('co-seed').value)===73,'Saved soup recipe restores its seed');
      ok(q('co-title-input').value==='NATIVE INFERNO PERSISTENCE','Saved title restored after process restart');
      ok(JSON.stringify(TRIScoreOrigins.snapshot())===localStorage.getItem('native-inferno-expected-state'),'Full bead, force, pulse and concentration state survives process restart exactly');
      ok(document.documentElement.dataset.colorMode==='dark','Selected appearance mode persists across process restart');
      ok(getComputedStyle(document.documentElement).getPropertyValue('--graph-curve1').trim().toUpperCase()==='#EE5599','Custom graph color survives process restart');
      ok(Number(getComputedStyle(document.documentElement).getPropertyValue('--graph-width'))===3.5,'Graph line weight survives process restart');
     } else {
      const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),warm=GoblinColor.hexToHsv(accent);
      ok(!!window.TRIScoreInfernoTheme&&(warm.h<65||warm.h>330),'Fresh Inferno profile starts with a warm accent and reversible appearance controls');
      mode('bang');
      const eras=[...document.querySelectorAll('[data-co-era]')];
      ok(eras.length>=5,'Expanded Big Bang timeline exposes multiple named epochs');
      for(const e of eras){e.click();pause();ok(Number.isFinite(TRIScoreOrigins.inspect().a),'Epoch '+e.textContent.trim()+' has finite cosmic state');}
      fill('co-timeline',200);const early=metric();fill('co-timeline',800);const late=metric();
      ok(Number.isFinite(early)&&Number.isFinite(late)&&late>early,'Big Bang scrub increases the displayed scale factor');
      mode('bounce');fill('co-timeline',0);const before=metric();fill('co-timeline',500);const minimum=metric();fill('co-timeline',1000);const after=metric();
      ok(Number.isFinite(minimum)&&minimum>0&&before>minimum&&after>minimum,'Big Bounce contracts to a finite positive minimum and expands again');
      mode('soup');fill('co-seed',73);q('co-apply').click();pause();
      const numericalBefore=TRIScoreOrigins.snapshot();
      for(let i=0;i<8;i++)q('co-step').click();
      await new Promise(r=>setTimeout(r,200));
      ok(q('co-canvas').width>100&&q('co-canvas').height>100,'Soup renders a sized native canvas');
      const numericalAfter=TRIScoreOrigins.snapshot();
      ok(numericalAfter.time>numericalBefore.time&&(numericalAfter.U!==numericalBefore.U||numericalAfter.V!==numericalBefore.V),'Soup simulation advances concentration fields and model time when stepped');
      for(const type of ['zap','stir','magnet']){
        const before=TRIScoreOrigins.inspect(),beads=JSON.stringify(TRIScoreOrigins.snapshot().beads);
        q('co-tool-'+type).click();pause();const after=TRIScoreOrigins.inspect();
        ok(after[type+'Count']===before[type+'Count']+1,type+' tool records an actual numerical interaction');
        ok(JSON.stringify(TRIScoreOrigins.snapshot().beads)!==beads,type+' tool changes particle positions or momenta');
        ok(Number.isFinite(after.kineticEnergy)&&Number.isFinite(after.alignment),type+' interaction keeps particle diagnostics finite');
      }
      q('co-fields-on').checked=true;q('co-fields-on').dispatchEvent(new Event('change',{bubbles:true}));
      fill('co-electric',.6);fill('co-stir',-.45);fill('co-magnetic',.7);fill('co-polarity',-1,'change');pause();
      const forcing=TRIScoreOrigins.snapshot().forcing;
      ok(Math.abs(forcing.electric-.6)<1e-9&&Math.abs(forcing.stir+.45)<1e-9&&Math.abs(forcing.magnetic-.7)<1e-9,'Continuous electric, stirring and magnetic sliders update numerical forcing');
      const beadsForced=JSON.stringify(TRIScoreOrigins.snapshot().beads);q('co-step').click();pause();
      ok(JSON.stringify(TRIScoreOrigins.snapshot().beads)!==beadsForced&&Number.isFinite(TRIScoreOrigins.inspect().kineticEnergy),'Continuous field step evolves finite particle state');
      q('co-fields-on').checked=false;q('co-fields-on').dispatchEvent(new Event('change',{bubbles:true}));
      ok(['electric','stir','magnetic'].every(k=>TRIScoreOrigins.snapshot().forcing[k]===0),'Field enable switch removes all continuous forces');
      q('co-fields-on').checked=true;q('co-fields-on').dispatchEvent(new Event('change',{bubbles:true}));pause();
      q('co-expand').click();ok(q('co-expand').getAttribute('aria-pressed')==='true','Expanded laboratory stage opens');q('co-expand').click();
      const recipeBefore=JSON.stringify(TRIScoreOrigins.inspect().config);
      go('colors');document.querySelector('[data-cs-mode="dark"]').click();fill('cs-hex-theme','#8855EE','change');
      fill('gp-mode','dark','change');q('gp-guard').checked=false;q('gp-guard').dispatchEvent(new Event('change',{bubbles:true}));
      fill('gp-picker-curve1','#ee5599');fill('gp-width',3.5);
      q('gp-dashes').checked=true;q('gp-dashes').dispatchEvent(new Event('change',{bubbles:true}));
      TRIScoreOrigins.open();pause();
      ok(getComputedStyle(document.documentElement).getPropertyValue('--graph-curve1').trim().toUpperCase()==='#EE5599','Color picker updates the live graph palette');
      ok(Number(getComputedStyle(document.documentElement).getPropertyValue('--graph-width'))===3.5,'Graph line-weight picker updates live settings');
      ok(recipeBefore===JSON.stringify(TRIScoreOrigins.inspect().config),'Changing appearance leaves simulation equations and recipe unchanged');
      q('co-play').click();window.dispatchEvent(new Event('triscore-freeze'));
      ok(!q('co-play').textContent.includes('Pause'),'Global freeze pauses Cosmic Origins playback');
      fill('co-title-input','NATIVE INFERNO PERSISTENCE');fill('co-note','Synthetic interacting bead snapshot; no private notes.');q('co-save').click();
      await until(()=>TRIScoreOrigins.inspect().recordCount===1);
      ok(TRIScoreOrigins.inspect().recordCount===1,'Interacting soup experiment captured through the packaged UI');
      localStorage.setItem('native-inferno-expected-state',JSON.stringify(TRIScoreOrigins.snapshot()));
      await new Promise(r=>setTimeout(r,250));
    }
    ok(!window.__nativeErrors?.length,'No unhandled renderer exceptions');
    window.__desktopQA={done:true,checks,origins:TRIScoreOrigins.inspect(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth+1}};
  } catch(error) {window.__desktopQA={done:true,checks,error:String(error.stack||error),nativeErrors:window.__nativeErrors||[]};}
})();
