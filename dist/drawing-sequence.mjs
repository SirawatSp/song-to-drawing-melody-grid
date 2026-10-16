import {blankDrawing,validateDrawing,compileDrawing} from './drawing-model.mjs';
export const MAX_SECTIONS=64;
export function blankSequence(drawing=blankDrawing()){
  return {format:'singing-sketchbook-sequence',version:1,title:'My drawing sequence',beatsPerBar:4,active:0,sections:[drawing]};
}
export function validateSequence(raw){
  if(raw?.format==='singing-sketchbook')return blankSequence(validateDrawing(raw));
  if(raw?.format!=='singing-sketchbook-sequence'||raw.version!==1||!Array.isArray(raw.sections)||!raw.sections.length||raw.sections.length>MAX_SECTIONS)
    throw Error('Choose a drawing or sequence project with 1–64 sections.');
  if(![3,4,6].includes(raw.beatsPerBar)||!Number.isInteger(raw.active)||raw.active<0||raw.active>=raw.sections.length)throw Error('The sequence has invalid bar or section settings.');
  const sections=raw.sections.map(validateDrawing);
  if(sections.reduce((n,s)=>n+(s.image?.dataURL.length||0),0)>100000000)throw Error('Keep embedded images under 100 MB per sequence. Split this project into smaller sequences.');
  return {format:raw.format,version:1,title:String(raw.title||'My drawing sequence').slice(0,120),beatsPerBar:raw.beatsPerBar,active:raw.active,sections};
}
export function compileSequence(project){
  let seconds=0,beats=0,dropped=0;const events=[],segments=[];
  for(const [index,drawing]of project.sections.entries()){
    const compiled=compileDrawing(drawing),secondsPerBeat=60/drawing.settings.bpm,duration=drawing.settings.beats*secondsPerBeat;
    segments.push({index,drawing,start:seconds,duration,beatStart:beats,firstBar:Math.floor(beats/project.beatsPerBar)+1,lastBar:Math.ceil((beats+drawing.settings.beats)/project.beatsPerBar)});
    for(const e of compiled.events)events.push({...e,start:seconds+e.start*secondsPerBeat,duration:e.duration*secondsPerBeat});
    seconds+=duration;beats+=drawing.settings.beats;dropped+=compiled.dropped;
  }
  return {events,segments,duration:seconds,totalBeats:beats,dropped,beatsPerBar:project.beatsPerBar};
}
export function sequencePosition(sequence,seconds){
  const time=Math.max(0,Math.min(sequence.duration,seconds));
  const segment=sequence.segments.find(s=>time<s.start+s.duration)||sequence.segments.at(-1);
  const progress=Math.max(0,Math.min(1,(time-segment.start)/segment.duration));
  const localBeat=progress*segment.drawing.settings.beats,globalBeat=segment.beatStart+localBeat;
  // At the final endpoint retain the final bar instead of showing an extra bar.
  const displayBeat=Math.min(globalBeat,Math.max(0,sequence.totalBeats-1e-7));
  return {segment,progress,localBeat,globalBeat,bar:Math.floor(displayBeat/sequence.beatsPerBar)+1,beat:displayBeat%sequence.beatsPerBar+1};
}
export function assertPlayableSequence(sequence){
  if(!sequence.events.length)throw Error('Add sounding marks or images to at least one section.');
  if(sequence.events.length>12000)throw Error('This sequence has too many notes. Use a coarser Snap or export fewer sections.');
  if(sequence.duration>600)throw Error('Play and export up to 10 minutes at once. Split this project into shorter sequences.');
  if(sequence.segments.some(s=>compileDrawing(s.drawing).events.length>1500))throw Error('A section has more than 1,500 notes. Choose a coarser Snap or simplify that drawing.');
}
export function moveSection(project,from,to){
  if(from<0||from>=project.sections.length||to<0||to>=project.sections.length)return;
  const selected=project.sections[project.active],item=project.sections.splice(from,1)[0];project.sections.splice(to,0,item);project.active=project.sections.indexOf(selected);
}
export const secondsSettings=sequence=>({beats:sequence.duration,bpm:60});
