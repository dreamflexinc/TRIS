(function(root){'use strict';
  class IndexedDBStore {
    #db=null;
    constructor(name='triscore-tris-native'){this.name=root.TRIScoreBrandCompat.databaseName(name);}
    async open(){if(this.#db)return this.#db;return new Promise((resolve,reject)=>{
      const request=indexedDB.open(this.name,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('vault');
      request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Storage upgrade blocked by another tab. Close other TRIScore tabs.'));
      request.onsuccess=()=>{this.#db=request.result;this.#db.onversionchange=()=>{this.#db.close();this.#db=null;};resolve(this.#db);};
    });}
    async read(){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('vault','readonly'),r=tx.objectStore('vault').get('current');let value=null;r.onsuccess=()=>value=r.result??null;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||new Error('Storage read aborted.'));});}
    async compareSwap(expected,next,signal){const db=await this.open();if(signal?.aborted)throw new Error('Operation canceled.');return new Promise((resolve,reject)=>{
      let tx;try{tx=db.transaction('vault','readwrite',{durability:'strict'});}catch(_){tx=db.transaction('vault','readwrite');}
      const store=tx.objectStore('vault'),r=store.get('current');let error;
      const abort=()=>{try{tx.abort();}catch(_){};};signal?.addEventListener('abort',abort,{once:true});
      r.onsuccess=()=>{if(signal?.aborted){abort();return;}if((r.result??null)!==expected){error=new Error('State changed in another tab. Seal and mount again; nothing overwritten.');tx.abort();return;}if(next===null)store.delete('current');else store.put(next,'current');};
      tx.oncomplete=()=>{signal?.removeEventListener('abort',abort);resolve();};
      tx.onabort=()=>{signal?.removeEventListener('abort',abort);reject(error||tx.error||new Error('Storage transaction canceled.'));};
    });}
    close(){this.#db?.close();this.#db=null;}
  }
  root.TrisBrowserStore=IndexedDBStore;
})(globalThis);
