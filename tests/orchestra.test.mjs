import test from 'node:test';
import assert from 'node:assert/strict';
import {VOICES,blankDrawing,validateDrawing,compileDrawing,orchestraDrawing,nearestVoice} from '../dist/drawing-model.mjs';
import {encodeSamples,validateSamples} from '../dist/image-data.mjs';
import {analyzeImage} from '../dist/image-import-core.mjs';
const added=['violin','cello','oboe','clarinet','horn','trumpet','harp'];
test('orchestral colors append to the stable original palette',()=>{
  assert.deepEqual(VOICES.slice(0,9).map(v=>v.id),['keys','pluck','bell','marimba','flute','strings','chime','bass','8bit']);
  assert.deepEqual(VOICES.slice(9).map(v=>v.id),added);assert.equal(new Set(VOICES.map(v=>v.color)).size,16);
  for(const [i,v]of VOICES.entries()){const rgb=[1,3,5].map(at=>parseInt(v.color.slice(at,at+2),16));assert.equal(nearestVoice(...rgb),i);}
});
test('every new voice survives stroke and compact-image JSON round trips',async()=>{
  for(const voice of added){
    const index=VOICES.findIndex(v=>v.id===voice),p=blankDrawing();p.strokes=[{voice,size:6,points:[[.25,.5]]}];
    assert.equal(compileDrawing(validateDrawing(JSON.parse(JSON.stringify(p)))).events[0].voice,voice);
    const data=await analyzeImage(new Uint8ClampedArray([0,0,0,255]),1,1,{voice:index});p.version=2;p.strokes=[];p.image={dataURL:'data:image/png;base64,AAAA',mode:'sound',points:[],...data};
    assert.equal(compileDrawing(validateDrawing(JSON.parse(JSON.stringify(p)))).events[0].voice,voice);
  }
  assert.equal(validateSamples({samples:encodeSamples([16<<19]),sampleWidth:1,sampleHeight:1}),false);
});
test('the original orchestra demo has eight beats, no dropped notes, and each orchestral layer',()=>{
  const p=validateDrawing(orchestraDrawing()),compiled=compileDrawing(p);assert.equal(p.settings.beats,8);assert.equal(compiled.dropped,0);
  assert.ok(compiled.events.length>25);for(const voice of [...added,'strings'])assert.ok(compiled.events.some(e=>e.voice===voice));
  assert.ok(compiled.events.every(e=>e.start>=0&&e.start+e.duration<=8));
});
