import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankDrawing,validateDrawing,pitchesFor,pitchAt,yForPitch,compileDrawing,pixelsToPoints,strokesFromEvents,settingsFromGuide,gardenDrawing,VOICES} from '../dist/drawing-model.mjs';
import {encodeWav,DrawingPlayer} from '../dist/drawing-audio.mjs';
test('pitch centers round-trip in every key and scale',()=>{
  for(let key=0;key<12;key++)for(const scale of ['major','minor','pentatonic','chromatic']){const s={...blankDrawing().settings,key,scale};for(const pitch of pitchesFor(s))assert.equal(pitchAt(yForPitch(pitch,s),s),pitch);}
});
test('a horizontal stroke holds one note, and separate strokes retrigger it',()=>{
  const p=blankDrawing();p.settings.beats=4;p.settings.quantize=2;
  p.strokes=[{voice:'keys',size:6,points:[[.0625,.5],[.4375,.5]]}];
  assert.deepEqual(compileDrawing(p).events,[{pitch:pitchAt(.5,p.settings),voice:'keys',start:0,duration:2}]);
  p.strokes.push({voice:'keys',size:6,points:[[.5625,.5],[.9375,.5]]});
  assert.equal(compileDrawing(p).events.length,2);assert.equal(compileDrawing(p).events[1].start,2);
});
test('curves add intermediate notes while instrument colors remain separate',()=>{
  const p=blankDrawing();p.strokes=[{voice:'flute',size:6,points:[[.1,.9],[.8,.1]]},{voice:'bell',size:6,points:[[.4,.5]]}];
  const c=compileDrawing(p);assert.ok(c.events.filter(e=>e.voice==='flute').length>3);assert.ok(c.events.some(e=>e.voice==='bell'));assert.equal(c.dropped,0);
});
test('transparent and white pixels are silent; palette and one-voice import work',()=>{
  const pixels=new Uint8ClampedArray([255,255,255,255,29,158,117,255,216,90,48,255,0,0,0,0]);
  assert.deepEqual(pixelsToPoints(pixels,4,1).map(p=>p[2]),[0,1]);assert.deepEqual(pixelsToPoints(pixels,4,1,{voice:4}).map(p=>p[2]),[4,4]);
});
test('reference images and melody guides remain silent until made playable',()=>{
  const p=blankDrawing();p.image={mode:'reference',points:[[.3,.4,0]]};p.guide={events:[{pitch:60,start:0,duration:1}]};
  assert.equal(compileDrawing(p).events.length,0);p.image.mode='sound';assert.equal(compileDrawing(p).events.length,1);
});
test('the La La Land note events survive conversion to separate drawing strokes',()=>{
  const source=JSON.parse(readFileSync(new URL('../dist/data/mia-sebastian.json',import.meta.url))),p=blankDrawing();
  p.settings=settingsFromGuide(source);p.strokes=strokesFromEvents(source.events,p.settings);
  assert.equal(p.strokes[0].points.length,1,'a single-cell eighth note must render as a visible dot');
  assert.equal(p.strokes[6].points.length,2,'the held dotted-half note must render as a line');
  assert.deepEqual(compileDrawing(p).events.map(({voice,...e})=>e),source.events);assert.equal(p.settings.key,9);assert.equal(p.settings.octave,3);
});
test('dense art reports limited polyphony instead of claiming exact conversion',()=>{
  const p=blankDrawing();p.strokes=Array.from({length:15},(_,i)=>({voice:VOICES[i%9].id,size:5,points:[[.25,.5]]}));
  const c=compileDrawing(p);assert.equal(c.peak,15);assert.equal(c.events.length,12);assert.ok(c.dropped>0);
});
test('the garden is a valid, nonempty editable drawing with several voices',()=>{
  const p=validateDrawing(gardenDrawing()),c=compileDrawing(p);assert.ok(c.events.length>20);assert.ok(new Set(c.events.map(e=>e.voice)).size>=5);
});
test('untrusted project imports reject invalid coordinates and image URLs',()=>{
  const p=blankDrawing();assert.throws(()=>validateDrawing({...p,strokes:[{voice:'keys',size:6,points:[[NaN,.5]]}]}));
  assert.throws(()=>validateDrawing({...p,image:{dataURL:'https://example.com/private',mode:'sound',points:[]}}));
  assert.throws(()=>validateDrawing({...p,settings:{...p.settings,beats:900}}));
});
test('WAV output has a correct PCM header, interleaving and sample clipping',()=>{
  const buffer=encodeWav([Float32Array.from([0,.5,-2]),Float32Array.from([1,-1,2])],44100),v=new DataView(buffer);
  assert.equal(new TextDecoder().decode(new Uint8Array(buffer,0,4)),'RIFF');assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(40,true),12);assert.equal(v.getInt16(44,true),0);assert.equal(v.getInt16(46,true),32767);assert.equal(v.getInt16(52,true),-32768);
});
test('Stop cancels already scheduled next-loop notes and previews',()=>{
  const calls=[],node=id=>({stop(){calls.push(id);}}),player=new DrawingPlayer();
  globalThis.cancelAnimationFrame=()=>{};
  player.nodes=[node('current')];player.nextNodes=[node('next')];player.tailNodes=[node('tail')];player.previewNodes=[node('preview')];player.playing=true;player.stop();
  assert.deepEqual(calls,['current','next','tail','preview']);assert.equal(player.playing,false);assert.equal(player.nextNodes,null);
});
