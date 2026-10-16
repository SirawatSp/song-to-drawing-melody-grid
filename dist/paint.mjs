import {VOICES,blankDrawing,pitchesFor,pitchAt,yForPitch,validateDrawing,compileDrawing,strokesFromEvents,settingsFromGuide,gardenDrawing,orchestraDrawing} from './drawing-model.mjs';
import {DrawingPlayer,renderWav} from './drawing-audio.mjs';
import {renderMp4} from './drawing-video.mjs';
import {blankSequence,validateSequence,compileSequence,sequencePosition,assertPlayableSequence,moveSection,secondsSettings,MAX_SECTIONS} from './drawing-sequence.mjs';
import {loadDraft,saveDraft} from './drawing-storage.mjs';
import {createVideoPainter,createSectionImageCache,paintMarks,musicalLabel} from './drawing-visual.mjs';
import {noteName,validate as validateGuide} from './model.mjs';
import {ImageImporter,currentPolicy} from './image-import.mjs';
import {MAX_PROJECT_FILE_BYTES,MAX_PROJECT_IMAGE_CHARS,imageSampleCount,trimImageHistory} from './image-data.mjs';

const $=id=>document.getElementById(id),canvas=$('drawing'),paper=$('paper');
const history=[],future=[];
let project=blankSequence(),sequencePlayback=null,playbackImages=null,playbackIndex=-1,playIntent=0,saveQueue=Promise.resolve(),saveRevision=0;
let drawing=blankDrawing(),selected='keys',tool='pen',grid=true,showGuide=true,active=null,beforeGesture=null;
let compiled={events:[],dropped:0},imageBitmap=null,pendingImage=null,saveTimer=0,renderFrame=0;
let videoExport=null,videoURL=null,pendingBatch=[],pendingTitle='',imageRequest=0,pendingFile=null,importController=null,importBusy=false;
const imageImporter=new ImageImporter();
const player=new DrawingPlayer(progress=>{
  const head=$('playhead');head.hidden=progress===null;
  if(progress!==null){
    const b=bounds();let local=progress;
    if(sequencePlayback){
      const position=sequencePosition(sequencePlayback,progress*sequencePlayback.duration);local=position.progress;
      if(playbackIndex!==position.segment.index){try{playbackImages.step(position.segment.index);}catch(e){stop();say(e.message,true);return;}playbackIndex=position.segment.index;requestRender();for(const [i,card]of [...$('section-list').children].entries())card.classList.toggle('is-playing',i===playbackIndex);}
      $('play-position').textContent=`Section ${playbackIndex+1} · bar ${position.bar} · beat ${position.beat.toFixed(1)}`;
      $('section-now').textContent=`Playing ${position.segment.drawing.title} · ${musicalLabel(position.segment.drawing.settings)}`;
    }else $('play-position').textContent=(progress*drawing.settings.beats).toFixed(1)+' / '+drawing.settings.beats+' beats';
    head.style.left=(b.x+local*b.w)+'px';
  }
},()=>{
  sequencePlayback=null;playbackImages?.dispose();playbackImages=null;playbackIndex=-1;requestRender();
  for(const card of $('section-list').children)card.classList.remove('is-playing');
  $('section-now').textContent='Each drawing keeps its own musical settings.';
  $('sequence-play').textContent='▶ Play sequence';
  $('paint-play').innerHTML='▶ <span>Play drawing</span>';$('paint-play').setAttribute('aria-label','Play drawing');$('paint-stop').disabled=true;
});

function say(text,error=false){$('paint-message').textContent=text;$('paint-message').classList.toggle('error',error);}
const safe=fn=>async(...args)=>{try{await fn(...args);}catch(e){say(e.message||String(e),true);}};
function bounds(){return{x:48,y:20,w:paper.clientWidth-68,h:paper.clientHeight-48};}
function stop(){playIntent++;player.stop();$('playhead').hidden=true;$('play-position').textContent='0.0 / '+drawing.settings.beats+' beats';}
function cloneDrawing(value){const {image,...rest}=value;return {...structuredClone(rest),image};}
function snapshot(){return cloneDrawing(drawing);}
function syncSection(){project.sections[project.active]=drawing;}
function projectSnapshot(){syncSection();return {...project,sections:project.sections.map(cloneDrawing)};}
function remember(p){history.push(p);if(history.length>20)history.shift();future.length=0;}
function record(before){const p=projectSnapshot();p.sections[p.active]=before;remember(p);}
function persist(){clearTimeout(saveTimer);const revision=++saveRevision;$('save-status').textContent='Saving on this device…';saveTimer=setTimeout(()=>saveNow(revision),180);}
function saveNow(revision=saveRevision){
  clearTimeout(saveTimer);const value=projectSnapshot();
  saveQueue=saveQueue.catch(()=>{}).then(()=>saveDraft(value));
  saveQueue.then(()=>{if(revision===saveRevision)$('save-status').textContent='Saved on this device';},()=>{if(revision===saveRevision){$('save-status').textContent='Download an editable sequence to save';say('This device could not save the sequence. Use “Save editable sequence” for a backup.',true);}});
}
function renderSections(){
  $('section-list').replaceChildren();let beats=0,seconds=0;
  project.sections.forEach((section,index)=>{
    const card=document.createElement('button');card.className='section-card';card.setAttribute('aria-pressed',index===project.active);card.setAttribute('aria-label',`Section ${index+1}: ${section.title}`);card.dataset.section=index;
    if(section.image){const image=document.createElement('img');image.src=section.image.thumbnail||section.image.dataURL;image.loading='lazy';image.alt='';card.append(image);}
    else {const thumbnail=document.createElement('canvas');thumbnail.width=180;thumbnail.height=90;paintMarks(thumbnail.getContext('2d'),section,null,{x:4,y:4,w:172,h:82},.6);card.append(thumbnail);}
    const title=document.createElement('strong');title.textContent=`${index+1}. ${section.title}`;
    const detail=document.createElement('small'),first=Math.floor(beats/project.beatsPerBar)+1,last=Math.ceil((beats+section.settings.beats)/project.beatsPerBar);
    detail.textContent=`Bars ${first}–${last} · ${section.settings.beats} beats · ${section.settings.bpm} BPM`;card.append(title,detail);card.onclick=safe(()=>selectSection(index));$('section-list').append(card);
    beats+=section.settings.beats;seconds+=section.settings.beats*60/section.settings.bpm;
  });
  $('sequence-summary').textContent=`${project.sections.length} sections · ${Math.ceil(beats/project.beatsPerBar)} bars · ${seconds.toFixed(1)} seconds`;
  $('section-title').value=drawing.title;$('sequence-title').value=project.title;$('sequence-meter').value=project.beatsPerBar;
  $('move-section-left').disabled=project.active===0;$('move-section-right').disabled=project.active===project.sections.length-1;$('remove-section').disabled=project.sections.length===1;
  $('add-section').disabled=$('duplicate-section').disabled=project.sections.length>=MAX_SECTIONS;
}
async function selectSection(index){stop();syncSection();project.active=index;drawing=project.sections[index];await hydrateImage();update({fields:true});}
function exportSequence(){const p=projectSnapshot();if($('export-scope').value==='current'){p.sections=[snapshot()];p.active=0;}return compileSequence(p);}
async function playSequence(){
  if(player.playing){stop();return;}stop();const intent=playIntent,sequence=compileSequence(projectSnapshot());assertPlayableSequence(sequence);
  $('sequence-play').disabled=true;
  try{
    await player.ready();const images=await createSectionImageCache(sequence.segments.map(s=>s.drawing));if(playIntent!==intent){images.dispose();return;}
    await player.play(sequence.events,secondsSettings(sequence),{loop:$('loop').checked});
    sequencePlayback=sequence;playbackImages=images;playbackIndex=-1;$('sequence-play').textContent='■ Stop sequence';$('paint-stop').disabled=false;
    say(sequence.dropped?'Playing the sequence. Some dense overlapping marks were limited to 12 simultaneous notes.':'Playing every section continuously in the arranged order.');
  }finally{$('sequence-play').disabled=false;}
}
async function addSection({duplicate=false}={}){
  if(project.sections.length>=MAX_SECTIONS)throw Error('Use up to 64 sections per project.');
  stop();remember(projectSnapshot());const next=duplicate?snapshot():blankDrawing();if(!duplicate)next.settings={...drawing.settings};next.title=duplicate?drawing.title+' copy':'Drawing '+(project.sections.length+1);
  project.sections.splice(project.active+1,0,next);project.active++;drawing=next;await hydrateImage();update({fields:true});
}
function update({fields=false}={}){
  syncSection();trimImageHistory(project,history,future);renderSections();compiled=compileDrawing(drawing);$('drawing-stats').textContent=drawing.strokes.length+' strokes · '+compiled.events.length+' notes';
  $('empty-hint').hidden=!!(drawing.strokes.length||drawing.image||drawing.guide);
  $('undo-drawing').disabled=!history.length;$('redo-drawing').disabled=!future.length;
  $('image-strip').hidden=!drawing.image;
  if(drawing.image){const info=drawing.image.info,detail=info?` · ${info.width}×${info.height} · ${imageSampleCount(drawing.image).toLocaleString()} ink anchors`:'';$('image-status').textContent=(drawing.image.mode==='sound'?'Image colors are playing · approximate musical interpretation':'Image is a silent tracing reference')+detail;$('image-mode-toggle').textContent=drawing.image.mode==='sound'?'Make image silent':'Make image sing';}
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
  const displayed=sequencePlayback?.segments[playbackIndex]?.drawing||drawing,displayImage=sequencePlayback?(playbackIndex>=0?playbackImages.get(playbackIndex):null):imageBitmap;
  const b=bounds(),s=displayed.settings,notes=pitchesFor(s),rowH=b.h/notes.length;
  if(displayImage){g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.globalAlpha=displayed.image?.mode==='reference'?.28:.93;g.drawImage(displayImage,b.x,b.y,b.w,b.h);g.restore();}
  if(grid&&!exporting){
    g.save();g.font='9px Verdana,sans-serif';g.textBaseline='middle';
    notes.forEach((pitch,i)=>{
      const y=b.y+(notes.length-i-.5)*rowH;
      if(i%2===0&&!displayImage){g.fillStyle='#e9eee128';g.fillRect(b.x,y-rowH/2,b.w,rowH);}
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
  if(displayed.guide&&showGuide&&!exporting){
    g.save();g.strokeStyle='#91a68b';g.fillStyle='#91a68b';g.globalAlpha=.5;g.lineWidth=3;g.setLineDash([4,5]);
    for(const e of displayed.guide.events){const ny=yForPitch(e.pitch,s);if(ny===null)continue;const x=b.x+e.start/s.beats*b.w,y=b.y+ny*b.h;g.beginPath();g.moveTo(x,y);g.lineTo(b.x+(e.start+e.duration)/s.beats*b.w,y);g.stroke();g.beginPath();g.arc(x,y,3,0,Math.PI*2);g.fill();}
    g.restore();
  }
  g.save();g.beginPath();g.rect(b.x,b.y,b.w,b.h);g.clip();g.lineCap='round';g.lineJoin='round';
  for(const st of displayed.strokes){g.strokeStyle=g.fillStyle=VOICES.find(v=>v.id===st.voice).color;g.lineWidth=st.size;g.beginPath();st.points.forEach(([x,y],i)=>{if(i)g.lineTo(b.x+x*b.w,b.y+y*b.h);else g.moveTo(b.x+x*b.w,b.y+y*b.h);});const isDot=st.points.every(([x,y])=>x===st.points[0][0]&&y===st.points[0][1]);if(isDot){g.arc(b.x+st.points[0][0]*b.w,b.y+st.points[0][1]*b.h,st.size/2,0,Math.PI*2);g.fill();}else g.stroke();}
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
function filterVoices(){const family=$('voice-family').value;for(const btn of $('palette').children){const index=VOICES.findIndex(v=>v.id===btn.dataset.voice),v=VOICES[index];btn.hidden=family==='orchestra'?!v.orchestra:family==='original'?index>=9:false;}const selectedButton=$('palette').querySelector('[aria-pressed=true]');if(selectedButton?.hidden)selectVoice([...$('palette').children].find(btn=>!btn.hidden).dataset.voice);}
function palette(){for(const v of VOICES){const btn=document.createElement('button');btn.className='swatch';btn.dataset.voice=v.id;btn.style.setProperty('--swatch',v.color);btn.setAttribute('aria-label',v.name+' · '+v.hint);btn.setAttribute('title',v.hint);btn.setAttribute('aria-pressed',v.id===selected);const dot=document.createElement('span');dot.className='color';const label=document.createElement('span');label.textContent=v.name;btn.append(dot,label);btn.onclick=()=>selectVoice(v.id);$('palette').append(btn);}}
async function hydrateImage(){const request=++imageRequest;imageBitmap=null;if(drawing.image){const im=new Image();im.src=drawing.image.dataURL;await im.decode();if(request!==imageRequest)return;imageBitmap=im;}requestRender();}
async function replace(p){stop();record(snapshot());drawing=validateDrawing(p);await hydrateImage();update({fields:true});}
async function undo(){if(!history.length)return;stop();future.push(projectSnapshot());project=history.pop();drawing=project.sections[project.active];await hydrateImage();update({fields:true});say('Undone.');}
async function redo(){if(!future.length)return;stop();history.push(projectSnapshot());project=future.pop();drawing=project.sections[project.active];await hydrateImage();update({fields:true});say('Redone.');}
async function playEvents(events,{guide=false}={}){
  if(!events.length){say('Make a colored mark first, open a drawing, or try the singing garden.');return;}
  if(events.length>1500)throw Error('This drawing is very dense. Choose a coarser Snap or simplify the image before playing.');
  stop();await player.play(events,drawing.settings,{loop:!guide&&$('loop').checked});$('paint-play').innerHTML='Ⅱ <span>Stop playing</span>';$('paint-play').setAttribute('aria-label','Stop playing');$('paint-stop').disabled=false;
  if(guide)say('Playing the reference notes. The guide itself remains silent on your paper.');else if(!compiled.dropped)say('Your drawing is playing. Every color has its own instrument voice.');
}
async function addGuide(raw){
  const source=validateGuide(raw),s=settingsFromGuide(source);if(!SCALE_VALID(s))throw Error('This melody uses a register outside the drawing canvas. Adjust its range in the melody editor.');
  stop();record(snapshot());drawing.settings=s;drawing.guide={title:source.title+' · '+source.section,status:'Recording timing unverified',events:source.events};
  drawing=validateDrawing(drawing);showGuide=true;$('show-guide').checked=true;update({fields:true});say('Melody guide added. Trace separate pale bars, or use “Make guide playable” to hear the note events. Existing marks follow the new canvas settings.');
}
function SCALE_VALID(s){return[2,3,4,5].includes(s.octave);}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const fileName=(title=drawing.title)=>title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'singing-drawing';
function importProgress(stage,value){$('image-import-status').textContent=stage+'…';$('image-import-progress').value=value;}
async function preparePending(file){
  importController?.abort();const controller=new AbortController();importController=controller;pendingFile=file;pendingImage=null;
  $('apply-image').disabled=true;$('image-preview').removeAttribute('src');$('image-import-status').classList.remove('error');$('image-import-progress').hidden=false;
  if(!$('image-dialog').open)$('image-dialog').showModal();
  try{
    const prepared=await imageImporter.prepare(file,currentPolicy($('image-quality').value),{signal:controller.signal,onProgress:(stage,value)=>{if(importController===controller&&!controller.signal.aborted)importProgress(stage,value);}});controller.signal.throwIfAborted();
    pendingImage=prepared;$('image-preview').src=prepared.thumbnail;$('image-import-status').textContent=`${prepared.info.sourceWidth}×${prepared.info.sourceHeight} source → ${prepared.info.width}×${prepared.info.height} retained · ${prepared.info.profile} quality`;
  }catch(e){
    if(!controller.signal.aborted){$('image-import-status').textContent=e.message;$('image-import-status').classList.add('error');say(e.message,true);}
  }finally{if(importController===controller){$('image-import-progress').hidden=true;$('apply-image').disabled=!pendingImage;}}
}
async function readImage(file){
  if(!file)return;stop();pendingBatch=[];pendingTitle=file.name.replace(/\.[^.]+$/,'');$('image-dialog-title').textContent='Give this image a voice.';await preparePending(file);
}
async function imagePayload(prepared,mode,signal){
  const voice=mode==='one'?VOICES.findIndex(v=>v.id===selected):null;
  const sound=await imageImporter.analyze(prepared,{voice,sensitivity:Number($('image-sensitivity').value)},{signal,onProgress:importProgress});
  return {dataURL:prepared.dataURL,thumbnail:prepared.thumbnail,info:prepared.info,points:[],samples:sound.samples,sampleWidth:sound.sampleWidth,sampleHeight:sound.sampleHeight,mode:mode==='reference'?'reference':'sound'};
}
async function readBatch(files){
  if(!files.length)return;
  if(files.length+project.sections.length-(project.sections.length===1&&!drawing.strokes.length&&!drawing.image&&!drawing.guide?1:0)>MAX_SECTIONS)throw Error('Use up to 64 sections per project.');
  await readImage(files[0]);if(pendingFile!==files[0]||importController?.signal.aborted)return;pendingBatch=files;$('image-dialog-title').textContent=`Import ${files.length} plans as sections.`;
}
async function applyImage(){
  if(!pendingImage||importBusy)return;
  const controller=importController,signal=controller.signal,mode=document.querySelector('input[name="image-treatment"]:checked').value,button=$('apply-image'),policy=currentPolicy($('image-quality').value),files=[...pendingBatch];
  importBusy=true;button.disabled=true;$('image-import-progress').hidden=false;$('image-import-status').classList.remove('error');
  for(const field of $('image-dialog').querySelectorAll('input,select'))field.disabled=true;
  try{
    if(files.length){
      const sections=[],empty=project.sections.length===1&&!drawing.strokes.length&&!drawing.image&&!drawing.guide;
      let stored=empty?0:project.sections.reduce((sum,section)=>sum+(section.image?.dataURL.length||0),0);
      for(const [index,file]of files.entries()){
        signal.throwIfAborted();$('image-dialog-title').textContent=`Importing plan ${index+1} of ${files.length}`;
        const prepared=index===0?pendingImage:await imageImporter.prepare(file,policy,{signal,onProgress:importProgress});
        const next=blankDrawing();next.version=2;next.settings={...drawing.settings};next.title=file.name.replace(/\.[^.]+$/,'');next.image=await imagePayload(prepared,mode,signal);stored+=next.image.dataURL.length;
        if(stored>MAX_PROJECT_IMAGE_CHARS)throw Error('This batch would exceed the 256 MB project image budget. Import fewer plans or choose Balanced quality.');
        sections.push(next);
      }
      signal.throwIfAborted();const next=projectSnapshot();if(empty)next.sections=[];const first=next.sections.length;next.sections.push(...sections);next.active=first;const checked=validateSequence(next);
      const image=new Image();image.src=checked.sections[checked.active].image.dataURL;await image.decode();signal.throwIfAborted();
      stop();remember(projectSnapshot());project=checked;drawing=project.sections[project.active];imageRequest++;imageBitmap=image;update({fields:true});say(`${sections.length} high-quality drawings added. Arrange them and Play sequence.`);
    }else{
      const next=snapshot();next.version=2;next.image=await imagePayload(pendingImage,mode,signal);signal.throwIfAborted();if(next.title==='My singing drawing')next.title=pendingTitle;
      const total=project.sections.reduce((sum,section,index)=>sum+(index===project.active?next.image.dataURL.length:section.image?.dataURL.length||0),0);if(total>MAX_PROJECT_IMAGE_CHARS)throw Error('The project image budget is 256 MB. Use Balanced quality or a smaller sequence.');
      const checked=validateDrawing(next),image=new Image();image.src=checked.image.dataURL;await image.decode();signal.throwIfAborted();
      stop();record(snapshot());drawing=checked;imageRequest++;imageBitmap=image;update({fields:true});say(mode==='reference'?'High-quality image added as a silent reference.':'Image added with finer line detection. Pixel interpretation is approximate; dense plans can add many notes.');
    }
    $('image-dialog').close();
  }catch(e){
    if(!signal.aborted){$('image-import-status').textContent=e.message;$('image-import-status').classList.add('error');say(e.message,true);}
  }finally{
    importBusy=false;if(importController===controller){for(const field of $('image-dialog').querySelectorAll('input,select'))field.disabled=false;button.disabled=!pendingImage;$('image-import-progress').hidden=true;}
  }
}
async function exportVideo(){
  if(videoExport)return;
  const sequence=exportSequence();assertPlayableSequence(sequence);stop();
  const name=fileName($('export-scope').value==='current'?drawing.title:project.title)+'.mp4';
  if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null;}
  const preview=$('video-preview'),link=$('video-download');preview.pause();preview.removeAttribute('src');preview.load();preview.hidden=true;link.hidden=true;link.removeAttribute('href');
  const controller=new AbortController();videoExport=controller;
  $('video-progress').hidden=false;$('video-progress').value=0;$('video-status').textContent='Preparing sound…';$('video-status').classList.remove('error');$('video-close').textContent='Cancel export';$('export-video').disabled=true;
  $('video-dialog').showModal();
  try{
    const blob=await renderMp4({painter:createVideoPainter(sequence),events:sequence.events,settings:secondsSettings(sequence),volume:Number($('paint-volume').value)/100,signal:controller.signal,onProgress:(progress,label)=>{$('video-progress').value=progress;$('video-status').textContent=label+' '+Math.round(progress*100)+'%';}});
    videoURL=URL.createObjectURL(blob);preview.src=videoURL;preview.hidden=false;link.href=videoURL;link.download=name;link.hidden=false;
    $('video-status').textContent='Ready: your drawings and sound, with musical labels and a synchronized playhead. Preview it, then download your MP4.';say('Video ready. Download your MP4 from the preview.');
  }catch(e){
    const cancelled=controller.signal.aborted;
    $('video-status').textContent=cancelled?'Video export cancelled. Your drawing is safe.':e.message||String(e);$('video-status').classList.toggle('error',!cancelled);
    say(cancelled?'Video export cancelled.':e.message||String(e),!cancelled);
  }finally{
    videoExport=null;$('export-video').disabled=false;$('video-progress').hidden=true;$('video-close').textContent='Close';
  }
}
function bind(){
  $('sequence-play').onclick=safe(playSequence);
  $('add-section').onclick=safe(()=>addSection());$('duplicate-section').onclick=safe(()=>addSection({duplicate:true}));
  $('section-title').onchange=()=>{stop();record(snapshot());drawing.title=$('section-title').value.trim()||'Untitled drawing';update();};
  $('sequence-title').onchange=()=>{stop();remember(projectSnapshot());project.title=$('sequence-title').value.trim()||'My drawing sequence';update();};
  $('sequence-meter').onchange=()=>{stop();remember(projectSnapshot());project.beatsPerBar=Number($('sequence-meter').value);update();};
  for(const [id,delta]of [['move-section-left',-1],['move-section-right',1]])$(id).onclick=safe(async()=>{stop();remember(projectSnapshot());moveSection(project,project.active,project.active+delta);drawing=project.sections[project.active];update();});
  $('remove-section').onclick=safe(async()=>{if(project.sections.length===1)return;stop();remember(projectSnapshot());project.sections.splice(project.active,1);project.active=Math.min(project.active,project.sections.length-1);drawing=project.sections[project.active];await hydrateImage();update({fields:true});say('Section removed. Undo restores it.');});
  $('import-sections').onclick=()=>$('section-files').click();$('section-files').onchange=safe(async e=>{const files=[...e.target.files];e.target.value='';await readBatch(files);});

  $('pen-tool').onclick=()=>setTool('pen');$('eraser-tool').onclick=()=>setTool('erase');$('undo-drawing').onclick=safe(undo);$('redo-drawing').onclick=safe(redo);
  $('grid-toggle').onclick=()=>{grid=!grid;$('grid-toggle').setAttribute('aria-pressed',grid);requestRender();};
  $('clear-drawing').onclick=safe(async()=>{const p=snapshot();p.strokes=[];p.image=null;await replace(p);say('Paper cleared. Undo brings your drawing back.');});
  $('voice-family').onchange=filterVoices;
  $('orchestra-demo').onclick=safe(async()=>{
    if(project.sections.length>=MAX_SECTIONS)throw Error('Use up to 64 sections per project.');
    stop();remember(projectSnapshot());const empty=project.sections.length===1&&!drawing.strokes.length&&!drawing.image&&!drawing.guide,next=orchestraDrawing();
    if(empty)project.sections[0]=next;else {project.sections.splice(project.active+1,0,next);project.active++;}
    drawing=next;await hydrateImage();$('voice-family').value='orchestra';filterVoices();selectVoice('violin');update({fields:true});say('An original eight-beat paper orchestra. Press Play to hear the layers. The demo is a new section; Undo returns to your previous project.');
  });
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
  $('image-mode-toggle').onclick=()=>{stop();record(snapshot());drawing.image={...drawing.image,mode:drawing.image.mode==='sound'?'reference':'sound'};update();};
  $('remove-image').onclick=safe(async()=>{const p=snapshot();p.image=null;await replace(p);say('Image removed. Undo brings it back.');});
  $('image-quality').onchange=safe(async()=>{if(pendingFile&&!importBusy)await preparePending(pendingFile);});
  $('image-dialog').addEventListener('close',()=>{if($('image-dialog').open)return;importController?.abort();pendingImage=null;pendingBatch=[];pendingFile=null;for(const field of $('image-dialog').querySelectorAll('input,select'))field.disabled=false;});
  $('open-image').onclick=()=>$('image-file').click();$('image-file').onchange=safe(async e=>{const file=e.target.files[0];e.target.value='';await readImage(file);});$('apply-image').onclick=safe(applyImage);
  $('save-project').onclick=()=>{download(new Blob([JSON.stringify(projectSnapshot())],{type:'application/json'}),fileName(project.title)+'.sequence.json');say('Editable sequence saved with all drawings, images, order and musical settings.');};
  $('open-project').onclick=()=>$('project-file').click();$('project-file').onchange=safe(async e=>{const file=e.target.files[0];if(!file)return;if(file.size>MAX_PROJECT_FILE_BYTES)throw Error('Choose a project smaller than 384 MB.');const next=validateSequence(JSON.parse(await file.text()));stop();remember(projectSnapshot());project=next;drawing=project.sections[project.active];await hydrateImage();update({fields:true});say('Editable project opened. Legacy drawings become a one-section sequence.');e.target.value='';});
  $('export-picture').onclick=safe(async()=>{renderPaper({exporting:true});try{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Picture export failed. Please try again.');download(blob,fileName()+'.png');say('Picture saved. Silent melody guides are left out of the exported drawing.');}finally{requestRender();}});
  $('export-wav').onclick=safe(async()=>{
    const sequence=exportSequence();assertPlayableSequence(sequence);const btn=$('export-wav');btn.disabled=true;btn.textContent='Rendering audio…';
    try{const wav=await renderWav(sequence.events,secondsSettings(sequence),Number($('paint-volume').value)/100);download(new Blob([wav],{type:'audio/wav'}),fileName($('export-scope').value==='current'?drawing.title:project.title)+'.wav');say('Audio saved with continuous sections and a final ringing tail.');}finally{btn.disabled=false;btn.textContent='↓ Audio WAV';}
  });
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
  window.addEventListener('pagehide',()=>{stop();videoExport?.abort();importController?.abort();saveNow();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();saveNow();}});
  new ResizeObserver(requestRender).observe(paper);
}
try{
  try{const saved=await loadDraft();if(saved){project=validateSequence(saved);drawing=project.sections[project.active];}}catch{$('save-status').textContent='New paper';}
  palette();bind();selectVoice('keys');await hydrateImage();update({fields:true});document.documentElement.dataset.ready='true';
  let guide;try{guide=JSON.parse(sessionStorage.getItem('singing-sketchbook-guide')||'null');sessionStorage.removeItem('singing-sketchbook-guide');}catch{}
  if(guide)await addGuide(guide);
}catch(e){say('Could not open the drawing studio: '+e.message,true);}
