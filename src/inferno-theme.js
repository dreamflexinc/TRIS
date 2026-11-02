/* Inferno is a reversible appearance preset, using the retained appearance controls. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), C = window.GoblinColor, G = window.GoblinGraphCore;
  const MARK = 'triscore-inferno-theme-v1', BACKUP = 'triscore-inferno-previous-appearance-v1';
  const theme = { ...C.clone(C.DEFAULT), mode: 'dark', theme: '#FF793F',
    dark: {color:'#FF793F',tint:24}, light:{color:'#B3441D',tint:10}, oled:false };
  const graphs = { ...C.clone(G.DEFAULT), guard:true, width:2.5, dashes:true,
    dark:{curve1:'#FFA34D',curve2:'#FFD166',curve3:'#FF5A73',curve4:'#CB9AFF',grid:'#493029',text:'#E7C4AF',background:'#100B0A'},
    light:{curve1:'#994500',curve2:'#755100',curve3:'#AA2635',curve4:'#6640A4',grid:'#DDC9BA',text:'#694B3B',background:'#FFF8F0'} };
  let status = '';
  function say(message) { status = message; if ($('if-theme-status')) $('if-theme-status').textContent = message; }
  function applyControls(t, g) {
    C.validate(t); G.validate(g);
    $('cs-import').click(); $('cs-json').value = JSON.stringify(t);
    $('cs-json').dispatchEvent(new Event('input', {bubbles:true})); $('cs-review').click();
    if ($('cs-apply-import').hidden) throw Error('The theme could not be reviewed.');
    $('cs-apply-import').click(); $('cs-json-close').click();
    $('gp-import').click(); $('gp-json').value = JSON.stringify(g);
    $('gp-json').dispatchEvent(new Event('input', {bubbles:true})); $('gp-review').click();
    if ($('gp-apply').hidden) throw Error('The graph palette could not be reviewed.');
    $('gp-apply').click(); $('gp-json-close').click();
  }
  function keepPrevious() {
    if (localStorage.getItem(BACKUP) !== null) return;
    const rawTheme = localStorage.getItem(C.KEY), rawGraphs = localStorage.getItem(G.KEY);
    if (rawTheme !== null) C.parse(rawTheme);
    if (rawGraphs !== null) G.parse(rawGraphs);
    const previous = {schema:'triscore.inferno.appearance-backup.v1', theme:window.GoblinColorStudio.getState(), graphs:window.GoblinGraphs.getState()};
    C.validate(previous.theme); G.validate(previous.graphs);
    localStorage.setItem(BACKUP, JSON.stringify(previous));
  }
  function apply() {
    try {
      keepPrevious(); applyControls(theme, graphs);
      document.documentElement.dataset.inferno = 'on';
      localStorage.setItem(MARK, 'applied');
      say('Inferno palette applied. Your previous theme and graph settings are kept for restoration.');
      return true;
    } catch (error) { say('Appearance was not replaced: ' + error.message); return false; }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(BACKUP);
      if (!raw || raw.length > 40000) throw Error('No saved previous appearance is available.');
      const previous = JSON.parse(raw);
      if (!window.TRIScoreBrandCompat.isProtocol(previous.schema, 'triscore.inferno.appearance-backup.v1')) throw Error('Unsupported appearance backup.');
      applyControls(previous.theme, previous.graphs);
      document.documentElement.dataset.inferno = 'off';
      localStorage.setItem(MARK, 'restored');
      say('Previous theme and graph settings restored. Your color pickers remain available.');
      return true;
    } catch (error) { say('Previous appearance could not be restored: ' + error.message); return false; }
  }
  const card = document.createElement('article'); card.className = 'if-theme-card';
  const heading = document.createElement('h2'); heading.textContent = 'A little fire for the console.';
  const description = document.createElement('p'); description.textContent = 'Inferno adds charcoal, ember orange and solar gold. Every color remains editable in the original controls.';
  const actions = document.createElement('div'); actions.className = 'cs-actions';
  const fire = document.createElement('button'); fire.id = 'if-theme-apply'; fire.textContent = 'Apply Inferno palette'; fire.addEventListener('click', apply);
  const previous = document.createElement('button'); previous.id = 'if-theme-restore'; previous.textContent = 'Restore previous colors'; previous.addEventListener('click', restore);
  const message = document.createElement('p'); message.id = 'if-theme-status'; message.className = 'small'; message.setAttribute('role', 'status');
  actions.append(fire, previous); card.append(heading, description, actions, message);
  document.querySelector('.cs-bottom').append(card);
  window.TRIScoreInfernoTheme = Object.freeze({apply, restore, inspect:()=>({status,skin:document.documentElement.dataset.inferno,hasBackup:localStorage.getItem(BACKUP)!==null})});
  try {
    const mark = localStorage.getItem(MARK);
    document.documentElement.dataset.inferno = mark === 'restored' ? 'off' : 'on';
    if (mark === null) apply();
    else say('Your saved appearance is active. Inferno can be reapplied or your previous colors restored here.');
  } catch (error) { say('Appearance storage is unavailable: ' + error.message); }
})();
