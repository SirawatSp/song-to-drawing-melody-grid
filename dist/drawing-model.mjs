// Original drawing-to-notes engine. Coordinates are normalized so resizing
// changes the paper, not the music. One separate stroke is one separate voice.
export const VOICES = [
  {id:'keys', name:'Keys', color:'#1D9E75', hint:'Soft piano-like notes'},
  {id:'pluck', name:'Pluck', color:'#D85A30', hint:'A bright plucked string'},
  {id:'bell', name:'Bell', color:'#7F77DD', hint:'Round, ringing bells'},
  {id:'marimba', name:'Marimba', color:'#EF9F27', hint:'Warm wooden taps'},
  {id:'flute', name:'Flute', color:'#3E5EC6', hint:'A gentle, airy tone'},
  {id:'strings', name:'Strings', color:'#DE7BAE', hint:'Slow, soft bowed tones'},
  {id:'chime', name:'Chime', color:'#85BEE8', hint:'Light, glassy ringing'},
  {id:'bass', name:'Bass', color:'#33312B', hint:'A rounded, mellow tone'},
  {id:'8bit', name:'8-bit', color:'#F4BE82', hint:'A little video-game voice'}
];
export const SCALE_INTERVALS = {
  pentatonic:[0,2,4,7,9], major:[0,2,4,5,7,9,11],
  minor:[0,2,3,5,7,8,10], chromatic:[0,1,2,3,4,5,6,7,8,9,10,11]
};
export const DEFAULT_SETTINGS = {bpm:100,key:0,scale:'pentatonic',octave:3,range:2,beats:8,quantize:4};
export function blankDrawing() {
  return {format:'singing-sketchbook',version:1,title:'My singing drawing',settings:{...DEFAULT_SETTINGS},strokes:[],image:null,guide:null};
}
export function pitchesFor(s) {
  const base=(s.octave+1)*12+s.key, iv=SCALE_INTERVALS[s.scale], notes=[];
  for(let o=0;o<s.range;o++)for(const n of iv)notes.push(base+12*o+n);
  notes.push(base+s.range*12);
  return notes;
}
export function pitchAt(y,s) {
  const notes=pitchesFor(s);
  return notes[Math.min(notes.length-1,Math.max(0,Math.floor((1-y)*notes.length)))];
}
export function yForPitch(pitch,s) {
  const notes=pitchesFor(s), i=notes.indexOf(pitch);
  return i<0?null:1-(i+.5)/notes.length;
}
export function validateDrawing(raw) {
  if(!raw||raw.format!=='singing-sketchbook'||raw.version!==1)throw Error('Choose a Singing Sketchbook project JSON.');
  const p=structuredClone(raw),s=p.settings;
  if(!s||!Number.isFinite(s.bpm)||s.bpm<20||s.bpm>240||!Number.isInteger(s.key)||s.key<0||s.key>11||!SCALE_INTERVALS[s.scale]||![2,3,4,5].includes(s.octave)||![1,2,3].includes(s.range)||![4,8,16,32].includes(s.beats)||![1,2,3,4,6,8].includes(s.quantize))throw Error('The project has unsupported musical settings.');
  p.title=String(p.title||'My singing drawing').slice(0,120);
  const pointOK=q=>Array.isArray(q)&&q.length>=2&&q.slice(0,2).every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1);
  if(!Array.isArray(p.strokes)||p.strokes.length>1000)throw Error('Use up to 1,000 strokes in one drawing.');
  let count=0;
  p.strokes=p.strokes.map(st=>{
    if(!st||!VOICES.some(v=>v.id===st.voice)||!Number.isFinite(st.size)||st.size<1||st.size>24||!Array.isArray(st.points)||!st.points.length||st.points.length>4000||!st.points.every(pointOK))throw Error('The project contains an invalid drawing stroke.');
    count+=st.points.length;return {voice:st.voice,size:st.size,points:st.points.map(q=>[q[0],q[1]])};
  });
  if(count>100000)throw Error('This drawing has too many points. Save it in smaller sections.');
  if(p.image){
    const im=p.image;
    if(typeof im.dataURL!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(im.dataURL)||im.dataURL.length>4000000||!['sound','reference'].includes(im.mode)||!Array.isArray(im.points)||im.points.length>32768||!im.points.every(q=>pointOK(q)&&Number.isInteger(q[2])&&q[2]>=0&&q[2]<VOICES.length))throw Error('The project image is invalid or too large.');
    p.image={dataURL:im.dataURL,mode:im.mode,points:im.points.map(q=>[q[0],q[1],q[2]])};
  }
  if(p.guide){
    if(!Array.isArray(p.guide.events)||p.guide.events.length>500||!p.guide.events.every(e=>Number.isInteger(e.pitch)&&e.pitch>=0&&e.pitch<=127&&Number.isFinite(e.start)&&e.start>=0&&Number.isFinite(e.duration)&&e.duration>0&&e.start+e.duration<=s.beats+1e-7))throw Error('The melody guide contains invalid notes.');
    p.guide={title:String(p.guide.title||'Melody guide').slice(0,160),status:'Reference melody; recording timing unverified',events:p.guide.events.map(e=>({pitch:e.pitch,start:e.start,duration:e.duration}))};
  }
  return p;
}
function mark(cells,x,y,s,weight=1) {
  const step=Math.min(cells.length-1,Math.floor(Math.max(0,x)*cells.length)),pitch=pitchAt(y,s);
  cells[step].set(pitch,(cells[step].get(pitch)||0)+weight);
}
function strokeCells(st,s) {
  const cells=Array.from({length:s.beats*s.quantize},()=>new Map());
  mark(cells,...st.points[0],s);
  const lanes=pitchesFor(s).length;
  for(let i=1;i<st.points.length;i++){
    const a=st.points[i-1],b=st.points[i];
    const n=Math.max(1,Math.ceil(Math.abs(b[0]-a[0])*cells.length*2),Math.ceil(Math.abs(b[1]-a[1])*lanes*2));
    for(let k=1;k<=n;k++)mark(cells,a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n,s);
  }
  return cells;
}
export function compileDrawing(p) {
  const s=p.settings,steps=s.beats*s.quantize,parts=p.strokes.map((st,i)=>({id:'stroke'+i,voice:st.voice,cells:strokeCells(st,s)}));
  if(p.image?.mode==='sound'){
    const imageParts=VOICES.map((v,i)=>({id:'image'+i,voice:v.id,cells:Array.from({length:steps},()=>new Map())}));
    for(const[x,y,vi]of p.image.points)mark(imageParts[vi].cells,x,y,s);
    parts.push(...imageParts);
  }
  const active=new Map(),events=[];let dropped=0,peak=0;
  for(let st=0;st<=steps;st++){
    let candidates=[];
    if(st<steps)for(const part of parts)for(const[pitch,weight]of part.cells[st])candidates.push({key:part.id+':'+pitch,pitch,voice:part.voice,weight});
    candidates.sort((a,b)=>b.weight-a.weight||a.key.localeCompare(b.key));
    peak=Math.max(peak,candidates.length);dropped+=Math.max(0,candidates.length-12);candidates=candidates.slice(0,12);
    const keys=new Set(candidates.map(c=>c.key));
    for(const[key,e]of active)if(!keys.has(key)){events.push({pitch:e.pitch,voice:e.voice,start:e.start/s.quantize,duration:(st-e.start)/s.quantize});active.delete(key);}
    for(const c of candidates)if(!active.has(c.key))active.set(c.key,{...c,start:st});
  }
  events.sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
  return {events,dropped,peak};
}
export function nearestVoice(r,g,b) {
  let best=0,dist=Infinity;
  for(let i=0;i<VOICES.length;i++){
    const h=VOICES[i].color,rr=parseInt(h.slice(1,3),16),gg=parseInt(h.slice(3,5),16),bb=parseInt(h.slice(5,7),16);
    const d=(r-rr)**2+(g-gg)**2+(b-bb)**2;
    if(d<dist){dist=d;best=i;}
  }
  return best;
}
export function pixelsToPoints(rgba,width,height,{voice=null,sensitivity=35}={}) {
  const out=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,r=rgba[i],g=rgba[i+1],b=rgba[i+2],a=rgba[i+3];
    const light=(r+g+b)/3,chroma=Math.max(r,g,b)-Math.min(r,g,b);
    if(a<80||light>255-sensitivity||(chroma<18&&light>160))continue;
    out.push([(x+.5)/width,(y+.5)/height,voice===null?nearestVoice(r,g,b):voice]);
  }
  return out;
}
export function strokesFromEvents(events,s,voice='keys') {
  return events.map(e=>{
    const y=yForPitch(e.pitch,s);
    if(y===null||e.start<0||e.start+e.duration>s.beats+1e-7)return null;
    const first=Math.floor(e.start*s.quantize+1e-7),last=Math.ceil((e.start+e.duration)*s.quantize-1e-7)-1;
    return {voice,size:6,points:[[(first+.5)/(s.beats*s.quantize),y],[(last+.5)/(s.beats*s.quantize),y]]};
  }).filter(Boolean);
}
export function settingsFromGuide(p) {
  const c=p.pmt||{},key=c.key??9,shift=key>6?key-12:key;
  const base=48+shift+12*(c.octave??1),octave=Math.floor(base/12)-1;
  return {bpm:p.bpm,key,scale:SCALE_INTERVALS[c.scale]?c.scale:'major',octave,range:c.range??1,beats:c.canvasBeats??16,quantize:c.subdivision??2};
}
export function gardenDrawing() {
  const p=blankDrawing();p.title='A little singing garden';p.settings={...DEFAULT_SETTINGS,bpm:105,scale:'major',range:2};
  const stroke=(voice,points,size=6)=>p.strokes.push({voice,points,size});
  // Long low notes, plucked vines, pink petals and little bell stars.
  stroke('bass',[[.07,.88],[.24,.88]],8);stroke('bass',[[.4,.8],[.57,.8]],8);stroke('bass',[[.72,.88],[.93,.88]],8);
  for(const[cx,cy]of[[.2,.42],[.5,.29],[.8,.42]]){
    stroke('keys',[[cx,.82],[cx,.52],[cx,cy]],5);
    stroke('pluck',[[cx,.65],[cx-.085,.57],[cx-.12,.64],[cx,.69]],5);
    for(let k=0;k<5;k++){
      const angle=-Math.PI/2+k*Math.PI*2/5,pts=[];
      for(let j=0;j<=24;j++){const t=j/24*Math.PI*2,rad=.035+.027*Math.sin(t/2);pts.push([cx+Math.cos(angle)*rad+Math.cos(t)*.038,cy+Math.sin(angle)*rad+Math.sin(t)*.065]);}
      stroke('strings',pts,4);
    }
    stroke('marimba',[[cx-.006,cy],[cx+.006,cy]],12);
  }
  for(const[x,y]of[[.08,.14],[.36,.1],[.65,.12],[.93,.19]]){stroke('bell',[[x-.012,y],[x+.012,y]],5);stroke('chime',[[x,y-.025],[x,y+.025]],5);}
  return p;
}
