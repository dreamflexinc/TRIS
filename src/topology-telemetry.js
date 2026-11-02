(function(root){'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./topology-core.js'):root.TRIScoreTopologyCore,copy=x=>JSON.parse(JSON.stringify(x));
 const groups={matter3d:'matter',bondlab:'matter',forcefields:'matter',elements:'matter',resonance:'chaos',nexus:'chaos',kaos:'chaos',frontier:'chaos',accelerator:'science',relativity:'science',orbital:'science',tris:'security',sentinel:'security',dreamflex:'private',notes:'private',exchange:'tools',capsules:'tools',colors:'tools',graphs:'tools',topology:'chaos'};
 const names={home:'Console',topology:'Chaos topology',tris:'Tris continuity',sentinel:'Sentinel vault',matter3d:'Matter 3D',resonance:'Resonance fabric',nexus:'Nexus',kaos:'Kaos / strings',frontier:'Frontier',accelerator:'Collider',forcefields:'Force Fields',bondlab:'Bond Lab',colors:'Color Studio',graphs:'Graph Studio',notes:'Private notes',dreamflex:'DreamFlex',export:'Export desk',forge:'Forge',evidence:'Evidence',exchange:'Exchange',relativity:'Relativity',orbital:'Orbital'};
 class Telemetry {
  constructor(host=root,document=root.document){this.host=host;this.document=document;this.events=[];this.sequence=0;this.last=null;this.errors=[];}
  event(type,source,targets){if(!['navigation','seal','theme','graphs','state-change','control-request'].includes(type))throw Error('Unsupported telemetry event.');this.events.push({seq:++this.sequence,time:Date.now(),type,source,targets:targets.slice(0,60)});if(this.events.length>80)this.events.shift();}
  sample(){
   const h=this.host,nodes=[{id:'workbench',label:'TRIScore workbench',group:'system',state:'ready',metrics:{}}],edges=[],errors=[];
   const pages=[...this.document.querySelectorAll('.page')];
   for(const p of pages){nodes.push({id:p.id,label:names[p.id]||(p.querySelector('h1')?.textContent||p.id).trim().slice(0,64),group:groups[p.id]||'tools',state:p.hidden?'idle':'open',metrics:{},route:p.id});edges.push({id:'contains:'+p.id,source:'workbench',target:p.id,kind:'contains',label:'Application module'});}
   const by=id=>nodes.find(n=>n.id===id),numeric=(o,keys)=>Object.fromEntries(keys.filter(k=>Number.isFinite(o?.[k])).map(k=>[k,o[k]]));
   const read=(id,name,fn)=>{if(!by(id))return;try{const api=h[name];if(!api){by(id).state='unavailable';return;}fn(api,by(id));}catch(_){by(id).state='unavailable';errors.push(id);}};
   const state=(s,n)=>{n.state=s.dirty?'draft':s.halted?'halted':s.busy?'busy':s.running||s.playing?'running':'paused';};
   read('matter3d','GoblinMatterLab',(api,n)=>{const s=api.inspect();state(s,n);n.metrics=numeric(s.metrics,['step','time','n','temperature','energy','drift']);});
   read('forcefields','GoblinForceFieldLab',(api,n)=>{const s=api.inspect();state(s,n);n.metrics=numeric(s,['step','acceptedAtoms']);n.model=String(s.model||'').slice(0,150);});
   read('bondlab','GoblinBondLab',(api,n)=>{const s=api.inspect();state(s,n);n.metrics={...numeric(s,['step']),...numeric(s.metrics,['temperature','E','U','K','minR'])};});
   read('kaos','GoblinKaosLab',(api,n)=>{const s=api.inspect();state(s,n);n.metrics=numeric(s,['steps','time','norm']);
    for(const [id,label]of [['strings','String modes'],['lorenz','Kaos Lorenz'],['wave','Quantum wave']]){nodes.push({id:'kaos-'+id,label,group:'chaos',state:n.state,metrics:{},route:'kaos'});edges.push({id:'kaos-contains:'+id,source:'kaos',target:'kaos-'+id,kind:'contains',label:'Kaos subengine'});}
    for(const [source,key,label]of [['kaos-strings','coupling','String displacement → wave potential'],['kaos-lorenz','chaos','Lorenz modulation → wave potential']])if(Number.isFinite(s.controls?.[key]))edges.push({id:'kaos-coupling:'+key,source,target:'kaos-wave',kind:'coupling',label,enabled:s.controls[key]!==0,active:s.running&&s.controls[key]!==0,value:null,gain:s.controls[key]});
   });
   read('nexus','GoblinNexusLab',(api,n)=>{const s=api.inspect();state(s,n);n.metrics=numeric(s,['steps','t']);n.model=s.model;
    if(!s.dirty&&['standard','logistic'].includes(s.model)&&Number.isFinite(s.metrics?.[s.model==='standard'?0:1]?.[1]))n.sensitivity={value:s.metrics[s.model==='standard'?0:1][1],label:s.model==='standard'?'Finite-time tangent growth':'Finite-sample logistic growth',unit:'per iterate',source:'Nexus accepted model'};
   });
   read('accelerator','TRIScoreColliderLab',(api,n)=>{const s=api.inspect();state(s,n);n.metrics=numeric(s,['turn','cell']);});
   read('relativity','GoblinRelativityLab',(api,n)=>{const s=api.inspect();state(s,n);});
   read('frontier','TRIScoreFrontierLab',(api,n)=>{const s=api.inspect();n.state=s.hasResult?'result':'idle';n.model=s.model;if(s.model==='lyapunov'&&s.hasResult){const result=api.result();if(Number.isFinite(result?.spectrum?.[0]))n.sensitivity={value:result.spectrum[0],label:'Finite-time Lorenz spectrum / first QR rate',unit:'per model time',source:'Frontier accepted result'};}});
   read('resonance','GoblinResonanceLab',(api,n)=>{const s=api.inspect();state(s,n);n.metrics={...numeric(s,['ticks']),...numeric(s.metrics,['time','temperature','coherence','norm','correctedResidual'])};
    for(const [id,label]of [['chaos','Coupled Lorenz'],['osc','Resonator'],['sync','Synchrony'],['wave','Wave field'],['matter','Coupled matter']]){nodes.push({id:'rs-'+id,label,group:id==='matter'?'matter':'chaos',state:s.dirty?'draft':n.state,metrics:{},route:'resonance'});edges.push({id:'rs-contains:'+id,source:'resonance',target:'rs-'+id,kind:'contains',label:'Resonance subengine'});}
    if(!s.dirty&&typeof api.snapshot==='function'){const p=api.snapshot().chaos;if(Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)){by('rs-chaos').stateVector=p.slice();by('rs-chaos').metrics={tick:s.ticks,x:p[0],y:p[1],z:p[2]};}}
    if(!s.dirty)for(const r of (s.config?.routes||[]).slice(0,8)){const source='rs-'+r.source.split('.')[0],target='rs-'+r.target.split('.')[0];if(!by(source)||!by(target))continue;const committed=s.ports?.links?.find(x=>x.id===r.id);edges.push({id:'signal:'+r.id,source,target,kind:'signal',label:r.source+' → '+r.target,enabled:!!r.enabled,active:!!(r.enabled&&s.running&&committed),value:Number.isFinite(committed?.value)?committed.value:null,gain:r.gain});}
   });
   // Privacy boundary: never call vault readState, consoleIdentity, DreamFlex.inspect,
   // Exchange.inspect, or read text areas/journal/export content.
   read('tris','TRIScoreTris',(api,n)=>{const s=api.status();n.state=s.mounted?'mounted':'sealed';n.metrics={};});
   read('sentinel','TRIScoreSentinel',(api,n)=>{const s=api.inspect();n.state=s.unlocked?'mounted':'sealed';n.metrics={};});
   read('capsules','TRIScoreCapsules',(api,n)=>{const s=api.inspect();n.state=s.busy?'busy':s.hasCapsule?'result':'idle';});
   for(const [source,target,label]of [['forcefields','capsules','Explicit science capture'],['accelerator','capsules','Explicit recipe capture'],['capsules','forcefields','Reviewed staging'],['capsules','accelerator','Reviewed staging'],['matter3d','resonance','Reviewed checkpoint transfer'],['resonance','matter3d','Reviewed checkpoint transfer'],['kaos','exchange','Explicit experiment exchange'],['orbital','exchange','Explicit experiment exchange']])if(by(source)&&by(target))edges.push({id:'declared:'+source+':'+target,source,target,kind:'declared',label});
   const cutoff=Date.now()-2500;for(const e of this.events.filter(e=>e.time>=cutoff))for(const target of e.targets){if(by(e.source)&&by(target)&&e.source!==target)edges.push({id:'event:'+e.seq+':'+target,source:e.source,target,kind:'event',label:e.type,age:Date.now()-e.time,active:true});}
   this.last={schema:'triscore.topology.observation.v1',sampledAt:new Date().toISOString(),scope:'Application modules in one browser process; no OS process inventory',nodes,edges,events:copy(this.events),errors};return this.last;
  }
  atoms(){try{return C.atomicGraph(this.host.GoblinMatterLab.snapshot());}catch(_){return null;}}
  clear(){this.events=[];this.last=null;this.errors=[];}
 }
 const api=Object.freeze({Telemetry,groups,names});if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TRIScoreTopologyTelemetry=api;
})(globalThis);
