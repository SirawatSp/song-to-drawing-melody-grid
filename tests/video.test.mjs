import test,{afterEach,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {mp4MimeType,isMp4,renderMp4} from '../dist/drawing-video.mjs';

const globals=['AudioContext','OfflineAudioContext','MediaRecorder','document'];
let saved,contexts,tracks,recorders,mode;
const mp4=()=>new Blob([new Uint8Array([0,0,0,24]),'ftypisom',new Uint8Array(12)]);
beforeEach(()=>{
  saved=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  contexts=[];tracks=[];recorders=[];mode='ok';
});
afterEach(()=>{for(const k of globals)if(saved[k])Object.defineProperty(globalThis,k,saved[k]);else delete globalThis[k];});
function environment(){
  const track=()=>{const t={stopped:false,stop(){this.stopped=true;}};tracks.push(t);return t;};
  const audioParam={setValueAtTime(){},exponentialRampToValueAtTime(){},value:0};
  class Context{
    constructor(...args){this.offline=!!args.length;this.state='suspended';this.currentTime=0;this.sampleRate=44100;this.destination={};contexts.push(this);}
    async resume(){this.state='running';}
    async close(){this.state='closed';}
    createMediaStreamDestination(){return {stream:{getAudioTracks:()=>[track()]}};}
    createBufferSource(){return {connect(){},disconnect(){},start(){if(mode!=='wait')setTimeout(()=>this.onended?.(),5);},stop(){}};}
    createGain(){return {gain:audioParam,connect(){}};}
    createDynamicsCompressor(){return {threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){}};}
    createOscillator(){return {frequency:{},connect(){},start(){},stop(){}};}
    async startRendering(){return {duration:.01};}
  }
  class Recorder{
    static isTypeSupported(type){return type==='video/mp4';}
    constructor(...args){this.offline=!!args.length;this.state='inactive';recorders.push(this);}
    start(){this.state='recording';setTimeout(()=>{if(mode==='error')this.onerror?.();/* start can wait until media arrives */},0);}
    stop(){this.state='inactive';this.ondataavailable?.({data:mode==='invalid'?new Blob(['webm data']):mp4()});this.onstop?.();}
  }
  globalThis.AudioContext=globalThis.OfflineAudioContext=Context;
  globalThis.MediaRecorder=Recorder;globalThis.document=new EventTarget();document.hidden=false;
  const captureTracks=[track()];
  return {width:100,height:100,getContext:()=>({drawImage(){}}),captureStream:()=>({getTracks:()=>captureTracks,addTrack:t=>captureTracks.push(t)})};
}
const options=canvas=>({canvas,events:[{pitch:60,start:0,duration:1,voice:'keys'}],settings:{beats:4,bpm:120}});
function cleaned(){assert.ok(contexts.filter(c=>!c.offline).every(c=>c.state==='closed'));assert.ok(tracks.every(t=>t.stopped));assert.ok(recorders.every(r=>r.state==='inactive'));}

test('MP4 preference selects only supported MP4 types, with no WebM fallback',()=>{
  const seen=[];const Recorder={isTypeSupported:type=>{seen.push(type);return type.includes('mp4a');}};
  assert.match(mp4MimeType(Recorder),/avc1.*mp4a/);assert.ok(seen.every(t=>t.startsWith('video/mp4')));
  assert.equal(mp4MimeType({isTypeSupported:()=>false}),null);assert.equal(mp4MimeType({}),null);
});
test('file validation rejects WebM content even when labeled MP4',async()=>{
  assert.equal(await isMp4(mp4()),true);
  assert.equal(await isMp4(new Blob(['this is webm data'],{type:'video/mp4'})),false);
});
test('export starts media without waiting for recorder onstart and releases resources',async()=>{
  const blob=await renderMp4(options(environment()));assert.equal(blob.type,'video/mp4');assert.ok(await isMp4(blob));cleaned();
});
test('cancellation releases all media resources and does not return a partial video',async()=>{
  const canvas=environment();mode='wait';const controller=new AbortController();
  const promise=renderMp4({...options(canvas),signal:controller.signal});setTimeout(()=>controller.abort(),10);
  await assert.rejects(promise,{name:'AbortError'});cleaned();
});
test('encoder failure and mislabeled non-MP4 output fail cleanly',async()=>{
  const canvas=environment();mode='error';await assert.rejects(renderMp4(options(canvas)),/could not encode/);cleaned();
  mode='invalid';await assert.rejects(renderMp4(options(canvas)),/valid MP4/);cleaned();
});
test('switching away interrupts export instead of saving an incomplete video',async()=>{
  const canvas=environment();mode='wait';const promise=renderMp4(options(canvas));
  setTimeout(()=>{document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));},10);
  await assert.rejects(promise,/interrupted/);cleaned();
});
test('unsupported browsers and drawings without sounding notes report actionable errors',async()=>{
  const canvas=environment();MediaRecorder.isTypeSupported=()=>false;
  await assert.rejects(renderMp4(options(canvas)),/unavailable/);assert.equal(contexts.length,0);
  MediaRecorder.isTypeSupported=()=>true;
  await assert.rejects(renderMp4({...options(canvas),events:[]}),/musical first/);
});
