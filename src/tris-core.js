/* Tris Native 3.0. Durable agent continuity, not a claim of consciousness.
 * No network, eval, plaintext persistence, or model execution. */
(function (root) {
  'use strict';
  const SCHEMA = 3, ITERATIONS = 600000, MAX_BYTES = 16 * 1024 * 1024;
  const SCOPES = Object.freeze(['identity:read', 'memory:read', 'memory:write', 'preferences:read', 'capabilities:read']);
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8', {fatal: true});
  const fail = message => { throw new Error(message); };
  const clone = x => JSON.parse(JSON.stringify(x));
  const now = () => new Date().toISOString();
  const uuid = () => root.crypto.randomUUID();
  function ready() {
    if (!root.crypto?.subtle || (typeof window !== 'undefined' && !root.isSecureContext)) fail('Secure Web Crypto unavailable. Start from localhost or HTTPS. No plaintext fallback.');
  }
  function object(x) { if (!x || typeof x !== 'object' || Array.isArray(x)) fail('Expected an object.'); }
  function exact(x, keys) {
    object(x);
    if (Object.keys(x).sort().join('|') !== keys.slice().sort().join('|')) fail('Unexpected or missing fields.');
  }
  function text(x, max = 500, empty = false) {
    if (typeof x !== 'string' || (!empty && !x.trim()) || enc.encode(x).length > max) fail('Invalid text or text exceeds its limit.');
    return x;
  }
  function id(x) { if (typeof x !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(x) || ['__proto__','constructor','prototype'].includes(x)) fail('Invalid identifier.'); return x; }
  function date(x) { if (typeof x !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(x) || !Number.isFinite(Date.parse(x))) fail('Invalid date.'); }
  function integer(x, min = 0) { if (!Number.isSafeInteger(x) || x < min) fail('Invalid counter.'); }
  function safeJSON(x, depth = 0) {
    if (depth > 24) fail('Data is nested too deeply.');
    if (x === null || typeof x === 'boolean' || typeof x === 'string') return;
    if (typeof x === 'number' && Number.isFinite(x)) return;
    if (typeof x !== 'object') fail('Only JSON data is accepted.');
    for (const k of Object.keys(x)) { if (['__proto__','constructor','prototype'].includes(k)) fail('Unsafe object key.'); safeJSON(x[k], depth + 1); }
  }
  function canonical(x) {
    safeJSON(x);
    if (x === null || typeof x !== 'object') return JSON.stringify(x);
    if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
    return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
  }
  function parse(raw) {
    if (typeof raw !== 'string' || enc.encode(raw).length > MAX_BYTES * 1.5) fail('Input exceeds the 24 MiB envelope limit.');
    const value = JSON.parse(raw); safeJSON(value); return value;
  }
  function b64(bytes) { let s = ''; for (let i=0; i<bytes.length; i+=8192) s+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(s); }
  function unb64(s, min, max) {
    if (typeof s !== 'string' || s.length > Math.ceil(max/3)*4 || s.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)) fail('Invalid base64 data.');
    const bytes = Uint8Array.from(atob(s), c=>c.charCodeAt(0));
    if (bytes.length < min || bytes.length > max || b64(bytes)!==s) fail('Invalid data length.'); return bytes;
  }
  const random = n => root.crypto.getRandomValues(new Uint8Array(n));
  async function digest(x) { return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256',enc.encode(typeof x === 'string' ? x : canonical(x))))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
  function passphrase(pass) { text(pass,1024); if ([...pass].length<15 || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(pass)) fail('Use a unique passphrase of at least 15 valid Unicode characters.'); }
  async function derive(pass, salt) {
    ready(); passphrase(pass); const raw=enc.encode(pass); let base;
    try { base=await root.crypto.subtle.importKey('raw',raw,'PBKDF2',false,['deriveKey']); } finally { raw.fill(0); }
    return root.crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:unb64(salt,32,32),iterations:ITERATIONS},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function envelope(e) {
    exact(e,['format','version','purpose','cipher','kdf','iterations','salt','iv','revision','data']);
    if (e.format!=='tris.envelope' || e.version!==1 || !['vault','backup'].includes(e.purpose) || e.cipher!=='AES-256-GCM' || e.kdf!=='PBKDF2-SHA256' || e.iterations!==ITERATIONS) fail('Unsupported encryption format.');
    integer(e.revision,1); unb64(e.salt,32,32); unb64(e.iv,12,12); unb64(e.data,16,MAX_BYTES+16); return e;
  }
  function aad(e) { const {data, ...header}=e; return enc.encode(canonical(header)); }
  async function seal(archive, key, salt, purpose='vault') {
    const raw=enc.encode(canonical(archive)); if(raw.length>MAX_BYTES)fail('Vault exceeds 16 MiB. Prune snapshots or export an archive.');
    const e={format:'tris.envelope',version:1,purpose,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt,iv:b64(random(12)),revision:archive.revision,data:''};
    try { e.data=b64(new Uint8Array(await root.crypto.subtle.encrypt({name:'AES-GCM',iv:unb64(e.iv,12,12),additionalData:aad(e),tagLength:128},key,raw))); } finally { raw.fill(0); }
    return JSON.stringify(e);
  }
  async function decrypt(raw, pass) {
    const e=envelope(parse(raw)), key=await derive(pass,e.salt); let bytes;
    try { bytes=new Uint8Array(await root.crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(e.iv,12,12),additionalData:aad(e),tagLength:128},key,unb64(e.data,16,MAX_BYTES+16))); }
    catch (_) { fail('Incorrect passphrase or damaged/modified encrypted data.'); }
    let archive; try { archive=parse(dec.decode(bytes)); } finally { bytes.fill(0); }
    await validateArchive(archive); if(archive.revision!==e.revision)fail('Revision integrity check failed.'); return {archive,key,salt:e.salt,purpose:e.purpose};
  }
  function validateMemory(m, schema) {
    exact(m,['id','kind','title','body','project','source','createdAt','updatedAt','version',...(schema>=3?['trust']:[])]);
    id(m.id); if(!['long-term','episodic','project'].includes(m.kind))fail('Unsupported memory kind.');
    text(m.title,200);text(m.body,100000,true);text(m.project,200,true);text(m.source,500);date(m.createdAt);date(m.updatedAt);integer(m.version,1);
    if(m.kind==='project'&&!m.project.trim())fail('Project memories require a project name.');
    if(schema>=3 && m.trust!=='untrusted-data')fail('Memory cannot grant authority or become executable instructions.');
  }
  function validateState(s,schema=SCHEMA) {
    exact(s,['identity','profile','memories','preferences','permissions',...(schema>=2?['capabilities']:[])]);
    exact(s.identity,['id','createdAt','kind']);id(s.identity.id);date(s.identity.createdAt);if(s.identity.kind!=='agent-continuity')fail('Invalid identity kind.');
    exact(s.profile,['name','description']);text(s.profile.name,100);text(s.profile.description,4000,true);
    if(!Array.isArray(s.memories)||s.memories.length>5000)fail('Maximum 5,000 memories.');
    s.memories.forEach(m=>validateMemory(m,schema));if(new Set(s.memories.map(m=>m.id)).size!==s.memories.length)fail('Duplicate memory IDs.');
    object(s.preferences);if(Object.keys(s.preferences).length>100)fail('Too many preferences.');
    for(const [k,v]of Object.entries(s.preferences)){id(k);text(v,4000,true);}
    object(s.permissions);if(Object.keys(s.permissions).length>100)fail('Too many grants.');
    for(const [k,v]of Object.entries(s.permissions)){id(k);if(!Array.isArray(v)||new Set(v).size!==v.length||v.some(x=>!SCOPES.includes(x)))fail('Invalid service permissions.');}
    if(schema>=2){if(!Array.isArray(s.capabilities)||s.capabilities.length>100)fail('Invalid capabilities.');for(const c of s.capabilities){exact(c,['id','description','version']);id(c.id);text(c.description,1000);text(c.version,100);}if(new Set(s.capabilities.map(c=>c.id)).size!==s.capabilities.length)fail('Duplicate capability IDs.');}
    safeJSON(s);return s;
  }
  async function validateArchive(a) {
    exact(a,['format','schema','revision','state','snapshots','audit']);
    if(a.format!=='tris.archive'||![1,2,3].includes(a.schema))fail('Unsupported state schema; existing data preserved.');
    integer(a.revision,1);validateState(a.state,a.schema);
    if(!Array.isArray(a.snapshots)||a.snapshots.length>12)fail('Maximum 12 snapshots.');
    const ids=new Set();for(const s of a.snapshots){exact(s,['id','at','label','schema','state']);id(s.id);date(s.at);text(s.label,200);if(ids.has(s.id)||![1,2,3].includes(s.schema))fail('Invalid snapshot.');ids.add(s.id);validateState(s.state,s.schema);if(canonical(s.state.identity)!==canonical(a.state.identity))fail('Snapshot identity mismatch.');}
    exact(a.audit,['anchor','next','entries']);if(!/^[a-f0-9]{64}$/.test(a.audit.anchor))fail('Invalid audit anchor.');integer(a.audit.next,1);
    if(!Array.isArray(a.audit.entries)||a.audit.entries.length>2000)fail('Invalid audit log.');
    let previous=a.audit.anchor,seq=a.audit.next-a.audit.entries.length;
    for(const event of a.audit.entries){exact(event,['seq','at','actor','action','target','previous','hash']);integer(event.seq,1);date(event.at);id(event.actor);id(event.action);text(event.target,200,true);
      const {hash,...record}=event;if(event.seq!==seq++||event.previous!==previous||await digest(record)!==hash)fail('Audit integrity check failed.');previous=hash;
    }
    if(!a.audit.entries.length||a.audit.next<2)fail('Audit trail is missing.');
    return a;
  }
  async function audit(a,actor,action,target='') {
    const record={seq:a.audit.next++,at:now(),actor,action,target,previous:a.audit.entries.at(-1)?.hash||a.audit.anchor};
    a.audit.entries.push({...record,hash:await digest(record)});
    if(a.audit.entries.length>2000)a.audit.anchor=a.audit.entries.shift().hash;
  }
  function snapshot(a,label) {
    if(a.snapshots.length>=12)fail('Snapshot limit reached. Export or prune an old snapshot first.');
    const s={id:uuid(),at:now(),label:text(label,200),schema:a.schema,state:clone(a.state)};a.snapshots.push(s);return s.id;
  }
  function migrateState(s,from) {
    const result=clone(s);
    if(from===1)result.capabilities=[];
    if(from<=2)result.memories=result.memories.map(m=>({...m,trust:'untrusted-data'}));
    return validateState(result);
  }
  async function migrate(a) {
    if(a.schema===SCHEMA)return false;
    const from=a.schema;snapshot(a,'Before migration from schema '+from);a.state=migrateState(a.state,from);a.state.permissions={};a.schema=SCHEMA;
    await audit(a,'owner','schema-migration',from+'->'+SCHEMA);return true;
  }
  function fresh(profile) {
    return {format:'tris.archive',schema:SCHEMA,revision:1,state:{identity:{id:uuid(),createdAt:now(),kind:'agent-continuity'},profile:{name:profile?.name||'Tris',description:profile?.description||''},memories:[],preferences:{},permissions:{},capabilities:[]},snapshots:[],audit:{anchor:'0'.repeat(64),next:1,entries:[]}};
  }
  class Vault {
    #store;#raw=null;#key=null;#salt=null;#archive=null;#busy=false;#epoch=0;#session=null;#runtime=new Map();#controller=null;
    constructor(store){if(!store?.read||!store?.compareSwap)fail('A persistence adapter is required.');this.#store=store;}
    get mounted(){return !!this.#key;}
    get busy(){return this.#busy;}
    async exists(){return (await this.#store.read())!==null;}
    async exportCiphertext(){return this.#task(async check=>{const raw=await this.#store.read();check();if(raw===null)fail('No stored vault to rescue.');if(enc.encode(raw).length>MAX_BYTES*1.5)fail('Stored data exceeds the rescue limit. Preserve the browser profile for manual recovery.');return raw;});}
    async eraseSealed(confirmation){return this.#task(async(check,signal)=>{if(this.mounted)fail('Seal first, or use the authenticated delete control.');if(confirmation!=='DELETE SEALED TRIS VAULT')fail('Sealed deletion requires the exact confirmation.');const raw=await this.#store.read();check();if(raw===null)fail('No stored vault to delete.');await this.#store.compareSwap(raw,null,signal);this.lock();});}
    status(){return {mounted:this.mounted,busy:this.#busy,schema:this.#archive?.schema??null,revision:this.#archive?.revision??null,sessionId:this.#session};}
    lock(){this.#epoch++;this.#controller?.abort();this.#key=null;this.#salt=null;this.#raw=null;this.#archive=null;this.#session=null;this.#runtime.clear();}
    #require(){if(!this.mounted)fail('Unlock Tris before accessing state.');}
    async #task(fn){if(this.#busy)fail('Another Tris operation is running.');this.#busy=true;const epoch=this.#epoch;const controller=new AbortController();this.#controller=controller;
      const check=()=>{if(epoch!==this.#epoch)fail('Operation canceled because Tris was sealed.');};
      try{return await fn(check,controller.signal);}finally{this.#busy=false;if(this.#controller===controller)this.#controller=null;}}
    async #commit(a,key,salt,expected,check,signal){
      await validateArchive(a);check();const raw=await seal(a,key,salt);check();
      await this.#store.compareSwap(expected,raw,signal);check();this.#archive=a;this.#key=key;this.#salt=salt;this.#raw=raw;
    }
    async create(pass,profile){return this.#task(async(check,signal)=>{ready();if(await this.exists())fail('A vault already exists. Nothing overwritten.');const a=fresh(profile),salt=b64(random(32)),key=await derive(pass,salt);await audit(a,'owner','identity-created',a.state.identity.id);await this.#commit(a,key,salt,null,check,signal);this.#session=uuid();return this.inspect();});}
    async mount(pass){return this.#task(async(check,signal)=>{if(this.mounted)fail('Already mounted. Seal before mounting again.');const raw=await this.#store.read();if(raw===null)fail('No saved Tris vault.');const next=await decrypt(raw,pass);check();if(next.purpose!=='vault')fail('Use import for a backup envelope.');await migrate(next.archive);next.archive.revision++;await audit(next.archive,'owner','mounted');await this.#commit(next.archive,next.key,next.salt,raw,check,signal);this.#session=uuid();return this.inspect();});}
    inspect(){this.#require();return clone({identity:this.#archive.state.identity,profile:this.#archive.state.profile,counts:{memories:this.#archive.state.memories.length,snapshots:this.#archive.snapshots.length},schema:SCHEMA,revision:this.#archive.revision,sessionId:this.#session});}
    readState(){this.#require();return clone(this.#archive.state);}
    listSnapshots(){this.#require();return this.#archive.snapshots.map(({state,...meta})=>clone(meta));}
    readAudit(){this.#require();return clone(this.#archive.audit);}
    async verify(){return this.#task(async check=>{this.#require();await validateArchive(this.#archive);check();if(await this.#store.read()!==this.#raw)fail('Stored state changed. Seal and mount again.');check();const result={revision:this.#archive.revision,head:this.#archive.audit.entries.at(-1).hash,identityHash:await digest(this.#archive.state.identity)};check();return result;});}
    async #change(action,target,fn,actor='owner') {return this.#task(async(check,signal)=>{this.#require();const a=clone(this.#archive);const result=fn(a);a.revision++;await audit(a,actor,action,target);await this.#commit(a,this.#key,this.#salt,this.#raw,check,signal);return result;});}
    async setProfile(profile){const p=clone(profile);return this.#change('profile-edited','profile',a=>{a.state.profile=p;});}
    async setPreference(key,value){id(key);if(value!==null)text(value,4000,true);return this.#change('preference-edited',key,a=>{if(value===null)delete a.state.preferences[key];else a.state.preferences[key]=value;});}
    async putMemory(input,actor='owner') {
      const x=clone(input);exact(x,['id','kind','title','body','project','source']);if(x.id!==null)id(x.id);
      const memoryId=x.id||uuid();return this.#change('memory-saved',memoryId,a=>{const old=a.state.memories.find(m=>m.id===memoryId);const record={...x,id:memoryId,createdAt:old?.createdAt||now(),updatedAt:now(),version:(old?.version||0)+1,trust:'untrusted-data'};validateMemory(record,SCHEMA);if(old)a.state.memories[a.state.memories.indexOf(old)]=record;else a.state.memories.push(record);return memoryId;},actor);
    }
    async deleteMemory(memoryId){id(memoryId);return this.#change('memory-deleted',memoryId,a=>{if(!a.state.memories.some(m=>m.id===memoryId))fail('Memory not found.');a.state.memories=a.state.memories.filter(m=>m.id!==memoryId);});}
    async setCapabilities(capabilities){const c=clone(capabilities);return this.#change('capabilities-edited','registry',a=>{a.state.capabilities=c;});}
    async grant(service,scopes){id(service);const s=clone(scopes);return this.#change('permissions-edited',service,a=>{if(!s.length)delete a.state.permissions[service];else a.state.permissions[service]=s;});}
    async takeSnapshot(label='Manual snapshot'){return this.#change('snapshot-created','state',a=>snapshot(a,label));}
    async deleteSnapshot(snapshotId){id(snapshotId);return this.#change('snapshot-deleted',snapshotId,a=>{if(!a.snapshots.some(s=>s.id===snapshotId))fail('Snapshot not found.');a.snapshots=a.snapshots.filter(s=>s.id!==snapshotId);});}
    async rollback(snapshotId,confirmation){this.#require();if(confirmation!=='RESTORE '+this.#archive.state.identity.id)fail('Restore requires the current identity confirmation.');await this.#change('snapshot-restored',snapshotId,a=>{const s=a.snapshots.find(s=>s.id===snapshotId);if(!s)fail('Snapshot not found.');snapshot(a,'Before rollback');a.state=migrateState(s.state,s.schema);a.state.permissions={};});this.#session=uuid();this.#runtime.clear();}
    async reset(confirmation){this.#require();if(confirmation!=='RESET '+this.#archive.state.identity.id)fail('Reset requires the current identity confirmation.');await this.#change('state-reset',this.#archive.state.identity.id,a=>{a.state.profile={name:'Tris',description:''};a.state.memories=[];a.state.preferences={};a.state.capabilities=[];a.state.permissions={};a.snapshots=[];});this.#session=uuid();this.#runtime.clear();}
    async erase(confirmation){return this.#task(async(check,signal)=>{this.#require();if(confirmation!=='DELETE '+this.#archive.state.identity.id)fail('Delete requires the current identity confirmation.');check();await this.#store.compareSwap(this.#raw,null,signal);this.lock();});}
    async exportBackup(pass){return this.#task(async(check,signal)=>{this.#require();const a=clone(this.#archive);a.revision++;await audit(a,'owner','backup-exported');const salt=b64(random(32)),key=await derive(pass,salt);const backup=await seal(a,key,salt,'backup');check();await this.#commit(a,this.#key,this.#salt,this.#raw,check,signal);return backup;});}
    async reviewBackup(raw,pass){return this.#task(async check=>{const next=await decrypt(raw,pass);check();const fingerprint=await digest(raw);check();return {identity:clone(next.archive.state.identity),name:next.archive.state.profile.name,memories:next.archive.state.memories.length,schema:next.archive.schema,fingerprint};});}
    async importBackup(raw,backupPass,newPass,confirmation,fingerprint){return this.#task(async(check,signal)=>{if(await this.exists())fail('Import only into an empty vault. Export and delete the current vault, or use a separate browser profile.');if(await digest(raw)!==fingerprint)fail('Backup changed since review.');const next=await decrypt(raw,backupPass);check();if(confirmation!=='IMPORT '+next.archive.state.identity.id)fail('Review and confirm the imported identity.');const a=next.archive;await migrate(a);a.state.permissions={};for(const s of a.snapshots)s.state.permissions={};a.revision++;await audit(a,'owner','backup-imported',a.state.identity.id);const salt=b64(random(32)),key=await derive(newPass,salt);await this.#commit(a,key,salt,null,check,signal);this.#session=uuid();this.#runtime.clear();return this.inspect();});}
    async rotatePassphrase(pass){return this.#task(async(check,signal)=>{this.#require();const a=clone(this.#archive),salt=b64(random(32)),key=await derive(pass,salt);a.revision++;await audit(a,'owner','key-rotated');await this.#commit(a,key,salt,this.#raw,check,signal);});}
    attach(service,available=[]){
      this.#require();id(service);if(!Array.isArray(available)||available.some(x=>typeof x!=='string'))fail('Invalid runtime capabilities.');const epoch=this.#epoch,session=this.#session,availableNow=new Set(available);
      const allowed=scope=>{this.#require();if(this.#epoch!==epoch||this.#session!==session)fail('Service handle expired. Mount again.');if(!this.#archive.state.permissions[service]?.includes(scope))fail('Permission denied: '+scope);};
      return Object.freeze({
        identity:()=>{allowed('identity:read');return clone({identity:this.#archive.state.identity,profile:this.#archive.state.profile});},
        memories:(query={})=>{allowed('memory:read');return clone(this.#archive.state.memories.filter(m=>(!query.kind||m.kind===query.kind)&&(!query.project||m.project===query.project)));},
        remember:input=>{allowed('memory:write');return this.putMemory(input,service);},
        preferences:()=>{allowed('preferences:read');return clone(this.#archive.state.preferences);},
        capabilities:()=>{allowed('capabilities:read');return this.#archive.state.capabilities.map(c=>({...clone(c),available:availableNow.has(c.id)}));},
        runtime:Object.freeze({get:key=>{allowed('identity:read');return clone(this.#runtime.get(service+':'+id(key))??null);},set:(key,value)=>{allowed('identity:read');safeJSON(value);if(enc.encode(canonical(value)).length>100000)fail('Runtime value exceeds limit.');if(this.#runtime.size>=100&&!this.#runtime.has(service+':'+key))fail('Runtime slot limit.');this.#runtime.set(service+':'+id(key),clone(value));}})
      });
    }
  }
  const api=Object.freeze({Vault,SCHEMA,SCOPES,MAX_BYTES,ITERATIONS,canonical,digest,validateArchive,validateState});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TrisNative=api;
})(globalThis);
