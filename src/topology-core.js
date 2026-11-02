/* TRIScore 4.0: numerical geometry, reference flow, and graph invariants.
 * Display coordinates do not affect any laboratory integrator. */
(function(root){'use strict';
 const TAU=2*Math.PI,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function finite(x){if(!Number.isFinite(x))throw Error('Nonfinite geometry input.');return x;}
 function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function lorenz(v,rho=28){const [x,y,z,a,b,c]=v;return [10*(y-x),x*(rho-z)-y,x*y-8*z/3,10*(b-a),(rho-z)*a-b-x*c,y*a+x*b-8*c/3];}
 function rk4(v,h,derivative){const a=derivative(v),b=derivative(v.map((x,i)=>x+h*a[i]/2)),c=derivative(v.map((x,i)=>x+h*b[i]/2)),d=derivative(v.map((x,i)=>x+h*c[i]));return v.map((x,i)=>x+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);}
 class ReferenceFlow{
  constructor({rho=28,dt=.005}={}){if(!Number.isFinite(rho)||rho<0||rho>50||!Number.isFinite(dt)||dt<.0005||dt>.01)throw Error('Invalid reference parameters.');this.rho=rho;this.dt=dt;this.v=[1,1,1,1,0,0];this.steps=0;this.sum=0;this.count=0;this.path=[];}
  advance(n=1){if(!Number.isInteger(n)||n<0||n>100000)throw Error('Invalid step count.');for(let i=0;i<n;i++){
   const v=rk4(this.v,this.dt,x=>lorenz(x,this.rho)),length=Math.hypot(...v.slice(3));
   if(v.some(x=>!Number.isFinite(x)||Math.abs(x)>1e6)||length<1e-100)throw Error('Reference integrator stopped at a finite-state guard.');
   this.steps++;if(this.steps*this.dt>10){this.sum+=Math.log(length);this.count++;}for(let j=3;j<6;j++)v[j]/=length;this.v=v;
   if(this.steps%4===0){this.path.push(v.slice(0,3));if(this.path.length>2000)this.path.shift();}
  }return this;}
  get estimate(){return this.count?this.sum/(this.count*this.dt):null;}
  get time(){return this.steps*this.dt;}
  point(p){return [p[0]/27,p[1]/32,(p[2]-25)/30];}
 }
 function complexPower(re,im,n){const r=Math.hypot(re,im)**n,a=Math.atan2(im,re)*n;return [r*Math.cos(a),r*Math.sin(a)];}
 // Affine chart Z0=1, Z3=Z4=0 of the Fermat quintic in CP4:
 // 1 + z1^5 + z2^5 = 0. This is a real 2D slice, not the whole CY threefold.
 function quinticPoint(r,theta,sheet){finite(r);finite(theta);if(r<0||r>2||!Number.isInteger(sheet)||sheet<0||sheet>4)throw Error('Invalid quintic chart point.');
  const a=r*Math.cos(theta),b=r*Math.sin(theta),[u,v]=complexPower(a,b,5),radius=Math.hypot(-1-u,-v)**.2,argument=(Math.atan2(-v,-1-u)+TAU)%TAU,angle=(argument+TAU*sheet)/5;return [a,b,radius*Math.cos(angle),radius*Math.sin(angle)];
 }
 function residual(p){const a=complexPower(p[0],p[1],5),b=complexPower(p[2],p[3],5);return Math.hypot(1+a[0]+b[0],a[1]+b[1]);}
 function project4(p,angle=.7){finite(angle);return [p[0]/1.45,p[1]/1.45,(p[2]*Math.cos(angle)+p[3]*Math.sin(angle))/1.25];}
 function quinticMesh(radial=12,angular=60){if(!Number.isInteger(radial)||radial<2||radial>30||!Number.isInteger(angular)||angular<12||angular>120)throw Error('Invalid mesh resolution.');
  const points=[],lines=[];
  for(let sheet=0;sheet<5;sheet++)for(let i=0;i<=radial;i++)for(let j=0;j<angular;j++){
   const p=quinticPoint(.08+1.24*i/radial,TAU*j/angular,sheet),index=points.length;points.push({p,sheet});
   for(const k of [j?index-1:-1,i?index-angular:-1])if(k>=0&&Math.hypot(...p.map((x,d)=>x-points[k].p[d]))<.65)lines.push([k,index,sheet]);
   if(j===angular-1){const k=index-j;if(Math.hypot(...p.map((x,d)=>x-points[k].p[d]))<.65)lines.push([k,index,sheet]);}
  }return {points,lines};
 }
 // Exact harmonic solution to u_tt = c^2 u_ss on a periodic 1D parameter.
 // Embedding through quinticPoint is illustrative, not a curved-space string EOM.
 function stringWave(s,t,{mode=3,speed=.7,amplitude=.09}={}){finite(s);finite(t);return amplitude*Math.cos(mode*s)*Math.cos(mode*speed*t);}
 function stringLoop(sheet,t,samples=120){return Array.from({length:samples+1},(_,i)=>{const s=TAU*i/samples;return quinticPoint(.63+stringWave(s,t),s,sheet);});}
 function project3(p,camera,width,height){const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch),x=p[0]*cy+p[2]*sy,z=-p[0]*sy+p[2]*cy,y=p[1]*cp-z*sp,depth=p[1]*sp+z*cp,scale=Math.min(width,height)*.31*camera.zoom/(1+depth*.18);return {x:width/2+x*scale,y:height/2-y*scale,depth,scale};}
 function graphStats(nodes,edges){const ids=new Set(nodes.map(n=>n.id)),parent=new Map([...ids].map(x=>[x,x])),pairs=new Set();
  const find=x=>{while(parent.get(x)!==x){parent.set(x,parent.get(parent.get(x)));x=parent.get(x);}return x;};
  for(const e of edges){if(!ids.has(e.source)||!ids.has(e.target)||e.source===e.target)continue;const key=[e.source,e.target].sort().join('|');if(pairs.has(key))continue;pairs.add(key);parent.set(find(e.source),find(e.target));}
  const components=new Set([...ids].map(find)).size;return {vertices:ids.size,edges:pairs.size,components,cycleRank:pairs.size-ids.size+components};
 }
 function networkPositions(nodes){const n=nodes.length;return new Map(nodes.map((node,i)=>{const y=1-2*(i+.5)/Math.max(n,1),r=Math.sqrt(1-y*y),phi=i*Math.PI*(3-Math.sqrt(5));return [node.id,[r*Math.cos(phi),y,r*Math.sin(phi)]];}));}
 function atomicGraph(checkpoint,limit=128,maxEdges=1200){
  const c=checkpoint?.config,positions=checkpoint?.unwrapped;if(!c||!Array.isArray(positions)||positions.length%3||!Number.isFinite(c.density)||c.density<=0||!Number.isFinite(c.cutoff)||c.cutoff<=0)throw Error('No valid Matter 3D checkpoint.');
  if(!Number.isInteger(limit)||limit<1||limit>512)throw Error('Invalid particle display limit.');
  const total=positions.length/3;if(total<1||total>512||positions.some(x=>!Number.isFinite(x)))throw Error('Invalid particle coordinates.');
  const n=Math.min(total,limit),L=Math.cbrt(total/c.density),wrap=x=>((x%L)+L)%L,minimum=x=>x-L*Math.round(x/L),nodes=[],edges=[];let candidateEdges=0;
  for(let i=0;i<n;i++)nodes.push({id:'atom:'+i,label:'Particle '+(i+1),group:'matter',state:'sample',position:positions.slice(i*3,i*3+3).map(x=>(wrap(x)/L-.5)*2),metrics:{index:i+1}});
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){let rr=0;for(let k=0;k<3;k++)rr+=minimum(positions[i*3+k]-positions[j*3+k])**2;const bond=c.model==='dimers'&&i%2===0&&j===i+1;
   if(bond||rr<c.cutoff*c.cutoff){candidateEdges++;if(edges.length<maxEdges)edges.push({id:'pair:'+i+':'+j,source:'atom:'+i,target:'atom:'+j,kind:bond?'harmonic-bond':'cutoff-neighbor',value:Math.sqrt(rr),label:bond?'Declared harmonic bond':'Within global cutoff (not a chemical bond)'});}
  }return {nodes,edges,total,shown:n,candidateEdges,truncated:n<total||candidateEdges>edges.length,boxLength:L};
 }
 const api=Object.freeze({ReferenceFlow,lorenz,rk4,quinticPoint,residual,project4,quinticMesh,stringWave,stringLoop,project3,graphStats,networkPositions,atomicGraph,hash,clamp});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TRIScoreTopologyCore=api;
})(globalThis);
