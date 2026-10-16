import {VOICES,pitchesFor} from './drawing-model.mjs';
import {noteName} from './model.mjs';
import {sequencePosition} from './drawing-sequence.mjs';
const KEYS=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
export const musicalLabel=s=>`${KEYS[s.key]} ${s.scale==='chromatic'?'chromatic':s.scale} · ${s.bpm} BPM`;
export async function loadSectionImages(sections){
  return Promise.all(sections.map(async drawing=>{
    if(!drawing.image)return null;
    const image=new Image();image.src=drawing.image.dataURL;await image.decode();return image;
  }));
}
export function paintMarks(g,drawing,image,b,scale=1){
  g.save();g.beginPath();g.rect(b.x,b.y,b.w,b.h);g.clip();
  if(image){g.globalAlpha=drawing.image?.mode==='reference'?.28:.93;g.drawImage(image,b.x,b.y,b.w,b.h);g.globalAlpha=1;}
  g.lineCap='round';g.lineJoin='round';
  for(const stroke of drawing.strokes){
    g.strokeStyle=g.fillStyle=VOICES.find(v=>v.id===stroke.voice).color;g.lineWidth=stroke.size*scale;g.beginPath();
    stroke.points.forEach(([x,y],i)=>{if(i)g.lineTo(b.x+x*b.w,b.y+y*b.h);else g.moveTo(b.x+x*b.w,b.y+y*b.h);});
    if(stroke.points.every(([x,y])=>x===stroke.points[0][0]&&y===stroke.points[0][1])){g.arc(b.x+stroke.points[0][0]*b.w,b.y+stroke.points[0][1]*b.h,stroke.size*scale/2,0,Math.PI*2);g.fill();}else g.stroke();
  }g.restore();
}
export async function createVideoPainter(sequence){
  const images=await loadSectionImages(sequence.segments.map(s=>s.drawing));
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  const g=canvas.getContext('2d'),b={x:76,y:112,w:1160,h:474};
  function drawFrame(seconds){
    const position=sequencePosition(sequence,seconds),{segment,progress}=position,{drawing}=segment,s=drawing.settings,notes=pitchesFor(s),rowHeight=b.h/notes.length;
    g.fillStyle='#fffdf8';g.fillRect(0,0,canvas.width,canvas.height);
    g.textBaseline='alphabetic';g.textAlign='left';g.fillStyle='#203f35';g.font='26px Georgia,serif';g.fillText(drawing.title.slice(0,72),b.x,40);
    g.font='14px Verdana,sans-serif';g.fillStyle='#526a55';g.fillText(musicalLabel(s),b.x,69);
    g.textAlign='right';g.fillText(`Section ${segment.index+1}/${sequence.segments.length} · ${sequence.beatsPerBar}/4`,b.x+b.w,40);
    g.fillText(`Bar ${position.bar} · Beat ${position.beat.toFixed(1)}`,b.x+b.w,69);
    paintMarks(g,drawing,images[segment.index],b,1.35);
    // Pitch lanes and beat/bar lines are visual only; never enter the compiler.
    g.save();g.font='11px Verdana,sans-serif';g.textBaseline='middle';
    notes.forEach((pitch,i)=>{
      const y=b.y+(notes.length-i-.5)*rowHeight;
      g.strokeStyle='#cad5c47a';g.lineWidth=.7;g.beginPath();g.moveTo(b.x,y+rowHeight/2);g.lineTo(b.x+b.w,y+rowHeight/2);g.stroke();
      g.fillStyle='#526a55';g.textAlign='right';if(rowHeight>12||i%2===0)g.fillText(noteName(pitch),b.x-10,y);
    });
    for(let beat=0;beat<=s.beats;beat++){
      const x=b.x+beat/s.beats*b.w,isBar=(segment.beatStart+beat)%sequence.beatsPerBar===0;
      g.strokeStyle=isBar?'#a3b19b':'#dce3d6';g.lineWidth=isBar?1.3:.6;g.beginPath();g.moveTo(x,b.y);g.lineTo(x,b.y+b.h);g.stroke();
      g.fillStyle='#657b60';g.textAlign='center';if(s.beats<=16||beat%2===0)g.fillText(beat,x,b.y+b.h+19);
    }
    g.restore();
    const cursor=b.x+progress*b.w;g.fillStyle='#a4743a14';g.fillRect(b.x,b.y,progress*b.w,b.h);
    g.strokeStyle='#a4743a';g.lineWidth=3;g.beginPath();g.moveTo(cursor,b.y-8);g.lineTo(cursor,b.y+b.h+3);g.stroke();
    g.fillStyle='#a4743a';g.beginPath();g.moveTo(cursor-6,b.y-8);g.lineTo(cursor+6,b.y-8);g.lineTo(cursor,b.y);g.fill();
    g.textAlign='left';g.fillStyle='#526a55';g.font='12px Verdana,sans-serif';g.fillText('BEATS →',b.x,628);
    g.textAlign='right';g.fillText(`${Math.min(sequence.duration,Math.max(0,seconds)).toFixed(1)} / ${sequence.duration.toFixed(1)} seconds`,b.x+b.w,628);
    for(const item of sequence.segments){
      const x=b.x+item.start/sequence.duration*b.w,w=item.duration/sequence.duration*b.w;
      g.fillStyle=item.index===segment.index?'#197c59':'#e2e8dc';g.fillRect(x,649,Math.max(1,w-2),20);
      if(w>25){g.fillStyle=item.index===segment.index?'#fffdf8':'#526a55';g.font='11px Verdana,sans-serif';g.textAlign='center';g.fillText(String(item.index+1),x+w/2,663);}
    }
    g.fillStyle='#a4743a';g.fillRect(b.x,680,b.w*Math.max(0,Math.min(1,seconds/sequence.duration)),3);
    return position;
  }
  drawFrame(0);return {canvas,drawFrame};
}
