import {VOICES,blankDrawing,pitchesFor,pitchAt,yForPitch,validateDrawing,compileDrawing,pixelsToPoints,strokesFromEvents,settingsFromGuide,gardenDrawing} from './drawing-model.mjs';
import {DrawingPlayer,renderWav} from './drawing-audio.mjs';
import {renderMp4} from './drawing-video.mjs';
import {noteName,validate as validateGuide} from './model.mjs';

const $=id=>document.getElementById(id),canvas=$('drawing'),paper=$('paper');
const STORAGE='singing-sketchbook-v1',history=[],future=[];
let drawing=blankDrawing(),selected='keys',tool='pen',grid=true,showGuide=true,active=null,beforeGesture=null;
let compiled={events:[],dropped:0},imageBitmap=null,pendingImage=null,previewURL=null,saveTimer=0,renderFrame=0;
let videoExport=null,videoURL=null;
const player=new DrawingPlayer(progress=>{
  const head=$('playhead');head.hidden=progress===null;
  if(progress!==null){const b=bounds();head.style.left=(b.x+progress*b.w)+'px';$('play-position').textContent=(progress*drawing.settings.beats).toFixed(1)+' / '+drawing.settings.beats+' beats';}
},()=>{$('paint-play').innerHTML='▶ <span>Play drawing</span>';$('paint-play').setAttribute('aria-label','Play drawing');$('paint-stop').disabled=true;});

function say(text,error=false){$('paint-message').textContent=text;$('paint-message').classList.toggle('error',error);}
const safe=fn=>async(...args)=>{try{await fn(...args);}catch(e){say(e.message||String(e),true);}};
function bounds(){return{x:48,y:20,w:paper.clientWidth-68,h:paper.clientHeight-48};}
function stop(){player.stop();$('playhead').hidden=true;$('play-position').textContent='0.0 / '+drawing.settings.beats+' beats';}
function snapshot(){return structuredClone(drawing);}
function record(before){history.push(before);if(history.length>40)history.shift();future.length=0;}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
  try{localStorage.setItem(STORAGE,JSON.stringify(drawing));$('save-status').textContent='Saved on this device';}
  catch{$('save-status').textContent='Download an editable copy to save';say('This browser could not save the drawing locally. Use “Save editable drawing” to keep it.');}
},180);}
function update({fields=false}={}){
  compiled=compileDrawing(drawing);$('drawing-stats').textContent=drawing.strokes.length+' strokes · '+compiled.events.length+' notes';
  $('empty-hint').hidden=!!(drawing.strokes.length||drawing.image||drawing.guide);
  $('undo-drawing').disabled=!history.length;$('redo-drawing').disabled=!future.length;
  $('image-strip').hidden=!drawing.image;
  if(drawing.image){$('image-status').textContent=drawing.image.mode==='sound'?'Image colors are playing · approximate musical interpretation':'Image is a silent tracing reference';$('image-mode-toggle').textContent=drawing.image.mode==='sound'?'Make image silent':'Make image sing';}
  $('guide-strip').hidden=!drawing.guide;
  if(drawing.guide){$('guide-title').textContent=drawing.guide.title;const missing=drawing.guide.events.some(e=>yForPitch(e.pitch,drawing.settings)===null);$('guide-status').textContent=missing?'Some guide pitches are outside this key/range. Adjust the paper to trace every note.':'Silent reference · recording timing unverified';}
  if(fields)for(const k of['bpm','key','scale','octave','range','beats','quantize'])$('paint-'+k).value=drawing.settings[k];
  if(compiled.dropped)say('Dense drawing: up to 12 notes play at once. Some overlapping marks were left out; try a simpler image or fewer strokes.');
  else if($('paint-message').textContent.startsWith('Dense drawing:'))say('');
  persist();requestRender();
}
function requestRender(){if(!renderFrame)renderFrame=requestAnimationFrame(()=>{renderFrame=0;renderPaper();});}
function renderPaper({exporting=false}={}){
  const dpr=window.devicePixelRatio||1,w=paper.clientWidth,h=paper.clientHeight;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);g.fillStyle='#fffdf8';g.fillRect(0,0,w,h);
  const b=bounds(),s=drawing.settings,notes=pitchesFor(s),rowH=b.h/notes.length;
  if(imageBitmap){g.save();g.globalAlpha=drawing.image?.mode==='reference'?.28:.93;g.drawImage(imageBitmap,b.x,b.y,b.w,b.h);g.restore();}
  if(grid&&!exporting){
    g.save();g.font='9px Verdana,sans-serif';g.textBaseline='middle';
    notes.forEach((pitch,i)=>{
      const y=b.y+(notes.length-i-.5)*rowH;
      if(i%2===0&&!imageBitmap){g.fillStyle='#e9eee128';g.fillRect(b.x,y-rowH/2,b.w,rowH);}
      g.strokeStyle=pitch%12===s.key?'#c5d2bc':'#e4e9dc';g.lineWidth=.7;g.beginPath();g.moveTo(b.x,y+rowH/2);g.lineTo(b.x+b.w,y+rowH/2);g.stroke();
      g.fillStyle='#71816b';g.textAlign='right';if(rowH>10||i%2===0)g.fillText(noteName(pitch),b.x-9,y);
    });
    const total=s.beats*s.quantize;
    for(let i=0;i<=total;i++){
      const x=b.x+i/total*b.w,beat=i%s.quantize===0;
      g.strokeStyle=beat?'#ced8c6':'#e9eee3';g.lineWidth=beat?.9:.5;g.setLineDash(beat?[]:[1,5]);g.beginPath();g.moveTo(x,b.y);g.lineTo(x,b.y+b.h);g.stroke();
      if(beat&&(s.beats<=16||i/s.quantize%2===0)){g.fillStyle='#85927b';g.textAlign='center';g.fillText(i/s.quantize,x,b.y+b.h+16);}
    }g.restore();
  }
  if(drawing.guide&&showGuide&&!exporting){
    g.save();g.strokeStyle='#91a68b';g.fillStyle='#91a68b';g.globalAlpha=.5;g.lineWidth=3;g.setLineDash([4,5]);
    for(const e of drawing.guide.events){const ny=yForPitch(e.pitch,s);if(ny===null)continue;const x=b.x+e.start/s.beats*b.w,y=b.y+ny*b.h;g.beginPath();g.moveTo(x,y);g.lineTo(b.x+(e.start+e.duration)/s.beats*b.w,y);g.stroke();g.beginPath();g.arc(x,y,3,0,Math.PI*2);g.fill();}
    g.restore();
  }
  g.save();g.beginPath();g.rect(b.x,b.y,b.w,b.h);g.clip();g.lineCap='round';g.lineJoin='round';
  for(const st of drawing.strokes){g.strokeStyle=g.fillStyle=VOICES.find(v=>v.id===st.voice).color;g.lineWidth=st.size;g.beginPath();st.points.forEach(([x,y],i)=>{if(i)g.lineTo(b.x+x*b.w,b.y+y*b.h);else g.moveTo(b.x+x*b.w,b.y+y*b.h);});const isDot=st.points.every(([x,y])=>x===st.points[0][0]&&y===st.points[0][1]);if(isDot){g.arc(b.x+st.points[0][0]*b.w,b.y+st.points[0][1]*b.h,st.size/2,0,Math.PI*2);g.fill();}else g.stroke();}
  g.restore();
}
function point(e){const r=canvas.getBoundingClientRect(),b=bounds();return[Math.max(0,Math.min(1,(e.clientX-r.left-b.x)/b.w)),Math.max(0,Math.min(1,(e.clientY-r.top-b.y)/b.h))];}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/n)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function erase(q){const b=bounds(),p=[q[0]*b.w,q[1]*b.h];drawing.strokes=drawing.strokes.filter(st=>!st.points.some((a,i)=>{const prev=st.points[Math.max(0,i-1)];return segmentDistance(p,[prev[0]*b.w,prev[1]*b.h],[a[0]*b.w,a[1]*b.h])<16+st.size/2;}));}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||active)return;e.preventDefault();stop();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);beforeGesture=snapshot();active={id:e.pointerId};const q=point(e);
  if(tool==='pen'){if(drawing.strokes.length>=1000){active=null;say('This page already has 1,000 strokes. Save it and start a new page.',true);return;}const st={voice:selected,size:Number($('brush-size').value),points:[q]};drawing.strokes.push(st);active.stroke=st;}
  else erase(q);
  $('empty-hint').hidden=true;requestRender();
});
canvas.addEventListener('pointermove',e=>{
  const q=point(e);showHover(q);
  if(!active||active.id!==e.pointerId)return;e.preventDefault();
  if(tool==='pen'){const st=active.stroke,last=st.points.at(-1);if(st.points.length<4000&&Math.hypot(q[0]-last[0],q[1]-last[1])>.0015)st.points.push(q);}
  else erase(q);
  requestRender();
});
function endGesture(e){if(!active||active.id!==e.pointerId)return;const changed=JSON.stringify(drawing.strokes)!==JSON.stringify(beforeGesture.strokes);if(changed)record(beforeGesture);active=null;beforeGesture=null;update();}
canvas.addEventListener('pointerup',endGesture);canvas.addEventListener('pointercancel',endGesture);canvas.addEventListener('lostpointercapture',endGesture);
canvas.addEventListener('pointerleave',()=>{$('hover-note').hidden=true;});
function showHover(q){const b=bounds(),tag=$('hover-note');tag.hidden=false;tag.textContent=noteName(pitchAt(q[1],drawing.settings))+' · beat '+(q[0]*drawing.settings.beats).toFixed(1);tag.style.left=Math.min(paper.clientWidth-110,b.x+q[0]*b.w+12)+'px';tag.style.top=Math.max(3,b.y+q[1]*b.h-28)+'px';}
function setTool(next){tool=next;$('pen-tool').setAttribute('aria-pressed',tool==='pen');$('eraser-tool').setAttribute('aria-pressed',tool==='erase');paper.classList.toggle('erase-mode',tool==='erase');}
function selectVoice(id){selected=id;const v=VOICES.find(v=>v.id===id);document.documentElement.style.setProperty('--voice',v.color);$('voice-name').textContent=v.name;$('voice-hint').textContent=v.hint;for(const btn of $('palette').children)btn.setAttribute('aria-pressed',btn.dataset.voice===id);setTool('pen');}
function palette(){for(const v of VOICES){const btn=document.createElement('button');btn.className='swatch';btn.dataset.voice=v.id;btn.style.setProperty('--swatch',v.color);btn.setAttribute('aria-label',v.name+' · '+v.hint);btn.setAttribute('title',v.hint);btn.setAttribute('aria-pressed',v.id===selected);const dot=document.createElement('span');dot.className='color';const label=document.createElement('span');label.textContent=v.name;btn.append(dot,label);btn.onclick=()=>selectVoice(v.id);$('palette').append(btn);}}
async function hydrateImage(){imageBitmap=null;if(drawing.image){const im=new Image();im.src=drawing.image.dataURL;await im.decode();imageBitmap=im;}requestRender();}
async function replace(p){stop();record(snapshot());drawing=validateDrawing(p);await hydrateImage();update({fields:true});}
async function undo(){if(!history.length)return;stop();future.push(snapshot());drawing=history.pop();await hydrateImage();update({fields:true});say('Undone.');}
async function redo(){if(!future.length)return;stop();history.push(snapshot());drawing=future.pop();await hydrateImage();update({fields:true});say('Redone.');}
async function playEvents(events,{guide=false}={}){
  if(!events.length){say('Make a colored mark first, open a drawing, or try the singing garden.');return;}
  if(events.length>1500)throw Error('This drawing is very dense. Choose a coarser Snap or simplify the image before playing.');
  await player.play(events,drawing.settings,{loop:!guide&&$('loop').checked});$('paint-play').innerHTML='Ⅱ <span>Stop playing</span>';$('paint-play').setAttribute('aria-label','Stop playing');$('paint-stop').disabled=false;
  if(guide)say('Playing the reference notes. The guide itself remains silent on your paper.');else if(!compiled.dropped)say('Your drawing is playing. Every color has its own instrument voice.');
}
async function addGuide(raw){
  const source=validateGuide(raw),s=settingsFromGuide(source);if(!SCALE_VALID(s))throw Error('This melody uses a register outside the drawing canvas. Adjust its range in the melody editor.');
  stop();record(snapshot());drawing.settings=s;drawing.guide={title:source.title+' · '+source.section,status:'Recording timing unverified',events:source.events};
  drawing=validateDrawing(drawing);showGuide=true;$('show-guide').checked=true;update({fields:true});say('Melody guide added. Trace separate pale bars, or use “Make guide playable” to hear the note events. Existing marks follow the new canvas settings.');
}
function SCALE_VALID(s){return[2,3,4,5].includes(s.octave);}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const fileName=()=>drawing.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'singing-drawing';
async function readImage(file){
  if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP drawing.');if(file.size>10000000)throw Error('Choose an image smaller than 10 MB.');
  if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(file);const im=new Image();im.src=previewURL;await im.decode();
  const c=document.createElement('canvas');c.width=1024;c.height=512;const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);const scale=Math.min(c.width/im.width,c.height/im.height),w=im.width*scale,h=im.height*scale;g.drawImage(im,(c.width-w)/2,(c.height-h)/2,w,h);
  pendingImage=c;$('image-preview').src=c.toDataURL('image/png');$('image-dialog').showModal();
}
async function applyImage(){
  if(!pendingImage)return;const mode=document.querySelector('input[name="image-treatment"]:checked').value;
  const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(pendingImage,0,0,256,128);
  const data=g.getImageData(0,0,256,128).data,voice=mode==='one'?VOICES.findIndex(v=>v.id===selected):null;
  const points=pixelsToPoints(data,256,128,{voice,sensitivity:Number($('image-sensitivity').value)}),dataURL=pendingImage.toDataURL('image/png');
  if(dataURL.length>4000000)throw Error('This image is too detailed to save. Try a smaller line drawing.');
  const next=snapshot();next.image={dataURL,points,mode:mode==='reference'?'reference':'sound'};await replace(next);$('image-dialog').close();pendingImage=null;
  if(!points.length&&mode!=='reference')say('No dark or colored marks were found. Try a darker drawing or lower “Ignore light background”.');
  else if(!compiled.dropped)say(mode==='reference'?'Image added as a silent reference. Draw colored marks on top.':'Image added. Press Play to hear its colors. This is an approximate musical interpretation.');
}
async function exportVideo(){
  if(videoExport)return;
  if(!compiled.events.length){say('Draw something musical first, or make your imported image sing.');return;}
  if(compiled.events.length>1500)throw Error('Choose a coarser Snap or fewer marks before exporting this dense drawing.');
  stop();
  // Freeze both image and music before awaiting anything. Later edits and window
  // resizing cannot change the exported artwork or its notes.
  renderPaper({exporting:true});
  const frame=document.createElement('canvas'),scale=Math.min(1,1920/canvas.width,1080/canvas.height);
  frame.width=Math.max(2,Math.floor(canvas.width*scale/2)*2);frame.height=Math.max(2,Math.floor(canvas.height*scale/2)*2);
  frame.getContext('2d').drawImage(canvas,0,0,frame.width,frame.height);requestRender();
  const events=structuredClone(compiled.events),settings={...drawing.settings},name=fileName()+'.mp4';
  if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null;}
  const preview=$('video-preview'),link=$('video-download');preview.pause();preview.removeAttribute('src');preview.load();preview.hidden=true;link.hidden=true;link.removeAttribute('href');
  const controller=new AbortController();videoExport=controller;
  $('video-progress').hidden=false;$('video-progress').value=0;$('video-status').textContent='Preparing sound…';$('video-status').classList.remove('error');$('video-close').textContent='Cancel export';$('export-video').disabled=true;
  $('video-dialog').showModal();
  try{
    const blob=await renderMp4({canvas:frame,events,settings,volume:Number($('paint-volume').value)/100,signal:controller.signal,onProgress:(progress,label)=>{$('video-progress').value=progress;$('video-status').textContent=label+' '+Math.round(progress*100)+'%';}});
    videoURL=URL.createObjectURL(blob);preview.src=videoURL;preview.hidden=false;link.href=videoURL;link.download=name;link.hidden=false;
    $('video-status').textContent='Ready: your drawing and sound, one loop with a short ringing tail. Preview it, then download your MP4.';say('Video ready. Download your MP4 from the preview.');
  }catch(e){
    const cancelled=controller.signal.aborted;
    $('video-status').textContent=cancelled?'Video export cancelled. Your drawing is safe.':e.message||String(e);$('video-status').classList.toggle('error',!cancelled);
    say(cancelled?'Video export cancelled.':e.message||String(e),!cancelled);
  }finally{
    videoExport=null;$('export-video').disabled=false;$('video-progress').hidden=true;$('video-close').textContent='Close';
  }
}
function bind(){
  $('pen-tool').onclick=()=>setTool('pen');$('eraser-tool').onclick=()=>setTool('erase');$('undo-drawing').onclick=safe(undo);$('redo-drawing').onclick=safe(redo);
  $('grid-toggle').onclick=()=>{grid=!grid;$('grid-toggle').setAttribute('aria-pressed',grid);requestRender();};
  $('clear-drawing').onclick=safe(async()=>{const p=snapshot();p.strokes=[];p.image=null;await replace(p);say('Paper cleared. Undo brings your drawing back.');});
  $('demo').onclick=safe(async()=>{await replace(gardenDrawing());say('An original singing garden. Press Play, then add your own colors. Undo returns to your previous drawing.');});
  $('audition').onclick=safe(()=>player.preview(pitchesFor(drawing.settings)[Math.floor(pitchesFor(drawing.settings).length/2)],selected));
  $('paint-play').onclick=safe(async()=>{if(player.playing)stop();else await playEvents(compiled.events);});$('paint-stop').onclick=stop;
  $('paint-volume').oninput=()=>player.setVolume(Number($('paint-volume').value)/100);
  $('loop').onchange=()=>{player.loop=$('loop').checked;};
  for(const key of['bpm','key','scale','octave','range','beats','quantize'])$('paint-'+key).onchange=safe(()=>{
    const next=snapshot();next.settings[key]=key==='scale'?$('paint-'+key).value:Number($('paint-'+key).value);
    if(key==='beats'&&next.guide?.events.some(e=>e.start+e.duration>next.settings.beats))next.guide=null;
    const p=validateDrawing(next);stop();record(snapshot());drawing=p;update({fields:true});say(key==='bpm'?'Tempo updated.':'Musical paper updated. Your marks now follow these settings.');
  });
  $('load-mia').onclick=safe(async()=>{const r=await fetch('./data/mia-sebastian.json');if(!r.ok)throw Error('The melody source could not be loaded.');await addGuide(await r.json());});
  $('show-guide').onchange=()=>{showGuide=$('show-guide').checked;requestRender();};
  $('guide-listen').onclick=safe(()=>playEvents(drawing.guide.events.map(e=>({...e,voice:'keys'})),{guide:true}));
  $('guide-to-ink').onclick=safe(()=>{
    const newStrokes=strokesFromEvents(drawing.guide.events,drawing.settings,selected);if(newStrokes.length!==drawing.guide.events.length)throw Error('Some melody pitches are outside this paper. Change the key, octave or range to include every guide note.');
    if(drawing.strokes.length+newStrokes.length>1000)throw Error('Save this drawing and clear some strokes before adding the melody.');
    const q=drawing.settings.quantize,approx=drawing.guide.events.some(e=>Math.abs(e.start*q-Math.round(e.start*q))>1e-7||Math.abs((e.start+e.duration)*q-Math.round((e.start+e.duration)*q))>1e-7);
    record(snapshot());stop();drawing.strokes.push(...newStrokes);update();say('Guide notes added as '+VOICES.find(v=>v.id===selected).name+' strokes. '+(approx?'Timing was approximated to the selected Snap cells. ':'Written beats fit the selected Snap cells. ')+'Recording timing remains unverified.');
  });
  $('remove-guide').onclick=()=>{record(snapshot());drawing.guide=null;update();};
  $('image-mode-toggle').onclick=()=>{stop();record(snapshot());drawing.image.mode=drawing.image.mode==='sound'?'reference':'sound';update();};
  $('remove-image').onclick=safe(async()=>{const p=snapshot();p.image=null;await replace(p);say('Image removed. Undo brings it back.');});
  $('open-image').onclick=()=>$('image-file').click();$('image-file').onchange=safe(async e=>{await readImage(e.target.files[0]);e.target.value='';});$('apply-image').onclick=safe(applyImage);
  $('save-project').onclick=()=>{download(new Blob([JSON.stringify(drawing)],{type:'application/json'}),fileName()+'.drawing.json');say('Editable drawing saved. Open this JSON file here on any device.');};
  $('open-project').onclick=()=>$('project-file').click();$('project-file').onchange=safe(async e=>{const file=e.target.files[0];if(!file)return;if(file.size>6000000)throw Error('Choose a drawing project smaller than 6 MB.');const p=validateDrawing(JSON.parse(await file.text()));await replace(p);say('Editable drawing opened.');e.target.value='';});
  $('export-picture').onclick=safe(async()=>{renderPaper({exporting:true});try{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Picture export failed. Please try again.');download(blob,fileName()+'.png');say('Picture saved. Silent melody guides are left out of the exported drawing.');}finally{requestRender();}});
  $('export-wav').onclick=safe(async()=>{if(!compiled.events.length){say('Draw something musical first.');return;}if(compiled.events.length>1500)throw Error('Choose a coarser Snap or fewer marks before exporting this dense drawing.');const btn=$('export-wav');btn.disabled=true;btn.textContent='Rendering audio…';say('Making one full loop of your drawing into a WAV file…');try{const wav=await renderWav(compiled.events,drawing.settings,Number($('paint-volume').value)/100);download(new Blob([wav],{type:'audio/wav'}),fileName()+'.wav');say('Audio saved: one loop with a short ringing tail.');}finally{btn.disabled=false;btn.textContent='↓ Audio WAV';}});
  $('export-video').onclick=safe(exportVideo);
  $('video-close').onclick=()=>{if(videoExport)videoExport.abort();else $('video-dialog').close();};
  $('video-dialog').addEventListener('cancel',e=>{if(videoExport){e.preventDefault();videoExport.abort();}});
  $('video-dialog').addEventListener('close',()=>{$('video-preview').pause();});
  $('help-open').onclick=()=>$('help-dialog').showModal();
  document.addEventListener('keydown',safe(async e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||document.querySelector('dialog[open]'))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();await(e.shiftKey?redo():undo());}
    else if(e.code==='Space'){e.preventDefault();if(player.playing)stop();else await playEvents(compiled.events);}
    else if(e.key.toLowerCase()==='p')setTool('pen');else if(e.key.toLowerCase()==='e')setTool('erase');
  }));
  window.addEventListener('pagehide',()=>{stop();videoExport?.abort();clearTimeout(saveTimer);try{localStorage.setItem(STORAGE,JSON.stringify(drawing));}catch{}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  new ResizeObserver(requestRender).observe(paper);
}
try{
  try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved)drawing=validateDrawing(saved);}catch{$('save-status').textContent='New paper';}
  palette();bind();selectVoice('keys');await hydrateImage();update({fields:true});
  let guide;try{guide=JSON.parse(sessionStorage.getItem('singing-sketchbook-guide')||'null');sessionStorage.removeItem('singing-sketchbook-guide');}catch{}
  if(guide)await addGuide(guide);
}catch(e){say('Could not open the drawing studio: '+e.message,true);}
