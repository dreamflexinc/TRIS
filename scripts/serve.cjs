// Static loopback host: no vault API, directory listing, proxy, or remote access.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const port=Number(process.env.TRIScore_PORT||8763);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid TRIScore_PORT.');
const file=path.resolve(__dirname,'../TRIScore4_3_InfernoLab.html');
http.createServer((req,res)=>{
 if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`){res.writeHead(403);res.end();return;}
 if(!['GET','HEAD'].includes(req.method)||!['/','/TRIScore4_3_InfernoLab.html','/TRIScore3_TrisNative.html'].includes(req.url)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Opener-Policy':'same-origin'});
 if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>{
 const url=`http://127.0.0.1:${port}`;console.log(`TRIScore 4.3: ${url} (Ctrl+C to stop)`);
 if(process.argv.includes('--open')){
  const {spawn}=require('node:child_process');
  const child=process.platform==='win32'?spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'}):spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});
  child.on('error',()=>console.log('Open the address above in your browser.'));
 }
});
