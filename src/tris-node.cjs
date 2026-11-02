'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {Vault,MAX_BYTES}=require('./tris-core.js');
// FileStore is for trusted, single-owner host services. Never expose it to an agent tool.
class FileStore {
 constructor(directory){
  this.directory=path.resolve(directory);this.file=path.join(this.directory,'identity.tris-vault');this.lockFile=path.join(this.directory,'writer.lock');
  const existed=fs.existsSync(this.directory);fs.mkdirSync(this.directory,{recursive:true,mode:0o700});
  if(!fs.lstatSync(this.directory).isDirectory()||fs.lstatSync(this.directory).isSymbolicLink())throw Error('Vault directory must be a real private directory.');
  if(process.platform==='win32'){
   // No chmod fiction on Windows: protect/verify NTFS ACLs using the current SID.
   const script=`$ErrorActionPreference='Stop'; $p=$env:TRIS_ACL_PATH; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; ${!existed?`$acl=New-Object System.Security.AccessControl.DirectorySecurity; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $acl.AddAccessRule($rule); [System.IO.Directory]::SetAccessControl($p,$acl);`:''} $acls=@([System.IO.Directory]::GetAccessControl($p)); $f=[System.IO.Path]::Combine($p,'identity.tris-vault'); if([System.IO.File]::Exists($f)){$acls+= [System.IO.File]::GetAccessControl($f)}; foreach($acl in $acls){foreach($r in $acl.Access){ $id=$r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value; if($r.AccessControlType -eq 'Allow' -and $id -notin @($sid.Value,'S-1-5-18','S-1-5-32-544')){ throw 'Vault ACL grants another identity access. Use a new private directory.' } }; if($acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value){ throw 'Vault has an unexpected owner.' }}`;
   execFileSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,TRIS_ACL_PATH:this.directory},windowsHide:true,stdio:'pipe'});
  }else{const stat=fs.statSync(this.directory);if(stat.uid!==process.getuid()||(stat.mode&0o077))throw Error('Vault directory must be owned by this user with mode 0700.');}
 }
 #checkFile(){if(fs.existsSync(this.file)){const stat=fs.lstatSync(this.file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('Unsafe vault file.');if(stat.size>MAX_BYTES*1.5)throw Error('Vault file exceeds size limit.');if(process.platform!=='win32'&&(stat.uid!==process.getuid()||(stat.mode&0o077)))throw Error('Vault file permissions must be 0600.');}}
 async read(){this.#checkFile();try{return fs.readFileSync(this.file,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async compareSwap(expected,next,signal){
  if(signal?.aborted)throw Error('Operation canceled.');
  let lock;try{lock=fs.openSync(this.lockFile,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Another writer or a stale lock exists. See recovery instructions.');throw e;}
  const temp=path.join(this.directory,'.commit-'+crypto.randomUUID()+'.tmp');let fd;
  try{
   fs.writeFileSync(lock,JSON.stringify({pid:process.pid,at:new Date().toISOString()}));fs.fsyncSync(lock);
   this.#checkFile();let current;try{current=fs.readFileSync(this.file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;current=null;}
   if(current!==expected)throw Error('Vault changed in another process. Nothing overwritten.');
   if(signal?.aborted)throw Error('Operation canceled.');
   if(next===null){if(current!==null)fs.unlinkSync(this.file);}else{
    fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,next,'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
    if(signal?.aborted)throw Error('Operation canceled.');fs.renameSync(temp,this.file);
   }
   if(process.platform!=='win32'){const dir=fs.openSync(this.directory,'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}
  }finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp);fs.closeSync(lock);fs.unlinkSync(this.lockFile);}
 }
}
async function bootTris({store,keyProvider,service,available=[]}){
 if(typeof keyProvider!=='function')throw Error('Host must supply a key provider.');
 const vault=new Vault(store);let pass=await keyProvider();
 try{await vault.mount(pass);}finally{pass=null;}
 try{const state=vault.attach(service,available);state.identity();return Object.freeze({state,status:()=>vault.status(),unmount:()=>vault.lock()});}
 catch(e){vault.lock();throw e;}
}
module.exports={FileStore,bootTris};
