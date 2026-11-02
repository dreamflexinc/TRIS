// Original code-drawn TRIScore monogram; no external artwork or font dependency.
const fs=require('node:fs'),path=require('node:path');
const sizes=[16,32,64],parts=[];
for(const size of sizes){
 const maskStride=Math.ceil(size/32)*4,pixels=Buffer.alloc(size*size*4),mask=Buffer.alloc(maskStride*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size,v=(y+.5)/size;
  const rounded=(a,b,c,d,r)=>u>=a&&u<=c&&v>=b&&v<=d&&Math.hypot(Math.max(a+r-u,0,u-(c-r)),Math.max(b+r-v,0,v-(d-r)))<=r;
  let color=[0,0,0,0];
  if(rounded(.025,.025,.975,.975,.19))color=[90,159,248,255];
  if(rounded(.075,.075,.925,.925,.14))color=[11,21,38,255];
  if(u>.22&&u<.78&&v>.22&&v<.36||u>.43&&u<.57&&v>.31&&v<.79)color=[133,211,255,255];
  const i=((size-y-1)*size+x)*4;pixels[i]=color[2];pixels[i+1]=color[1];pixels[i+2]=color[0];pixels[i+3]=color[3];
  if(!color[3])mask[(size-y-1)*maskStride+(x>>3)]|=1<<(7-x%8);
 }
 const h=Buffer.alloc(40);h.writeUInt32LE(40,0);h.writeInt32LE(size,4);h.writeInt32LE(size*2,8);h.writeUInt16LE(1,12);h.writeUInt16LE(32,14);h.writeUInt32LE(pixels.length+mask.length,20);parts.push(Buffer.concat([h,pixels,mask]));
}
const h=Buffer.alloc(6+16*sizes.length);h.writeUInt16LE(1,2);h.writeUInt16LE(sizes.length,4);let offset=h.length;
parts.forEach((p,i)=>{const start=6+i*16;h[start]=h[start+1]=sizes[i];h.writeUInt16LE(1,start+4);h.writeUInt16LE(32,start+6);h.writeUInt32LE(p.length,start+8);h.writeUInt32LE(offset,start+12);offset+=p.length;});
fs.writeFileSync(path.join(__dirname,'triscore.ico'),Buffer.concat([h,...parts]));
