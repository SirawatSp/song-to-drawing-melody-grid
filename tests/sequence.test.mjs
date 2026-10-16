import test from 'node:test';
import assert from 'node:assert/strict';
import {blankDrawing,compileDrawing,pitchAt} from '../dist/drawing-model.mjs';
import {blankSequence,validateSequence,compileSequence,sequencePosition,moveSection,assertPlayableSequence,secondsSettings} from '../dist/drawing-sequence.mjs';
function drawing(bpm=120,beats=4,y=.5){const d=blankDrawing();d.settings.bpm=bpm;d.settings.beats=beats;d.strokes=[{voice:'keys',size:6,points:[[0,y],[.49,y]]}];return d;}
test('sections retain pitches and durations while different tempos join without a gap',()=>{
  const a=drawing(),b=drawing(180,3,.8);b.settings.key=2;b.settings.scale='minor';const p=blankSequence(a);p.sections.push(b);
  const c=compileSequence(p);assert.equal(c.duration,3);assert.deepEqual(c.segments.map(s=>s.start),[0,2]);
  assert.equal(c.events[0].pitch,pitchAt(.5,a.settings));assert.equal(c.events[1].pitch,pitchAt(.8,b.settings));
  assert.equal(c.events[1].start,2);assert.equal(c.events[1].duration,compileDrawing(b).events[0].duration/3);assert.deepEqual(secondsSettings(c),{beats:3,bpm:60});
});
test('empty sections preserve silence and drawing switches exactly at the boundary',()=>{
  const p=blankSequence(drawing());const silent=drawing();silent.strokes=[];p.sections.push(silent,drawing());const c=compileSequence(p);
  assert.equal(c.duration,6);assert.equal(c.events[1].start,4);assert.equal(sequencePosition(c,1.999).segment.index,0);assert.equal(sequencePosition(c,2).segment.index,1);assert.equal(sequencePosition(c,4).segment.index,2);assert.equal(sequencePosition(c,7).progress,1);
});
test('bar numbering handles partial bars and the final endpoint without adding a bar',()=>{
  const p=blankSequence(drawing(120,3));p.sections.push(drawing(120,3));p.beatsPerBar=3;const c=compileSequence(p);
  assert.equal(sequencePosition(c,1.5).bar,2);assert.equal(sequencePosition(c,c.duration).bar,2);
  p.beatsPerBar=4;const partial=compileSequence(p);assert.equal(sequencePosition(partial,1.5).bar,1);assert.equal(sequencePosition(partial,1.5).beat,4);
});
test('reordering retains the selected drawing identity and changes event order',()=>{
  const p=blankSequence(drawing(120,4,.2));p.sections.push(drawing(60,4,.8));p.active=1;const selected=p.sections[1];moveSection(p,1,0);assert.equal(p.active,0);assert.equal(p.sections[0],selected);assert.equal(compileSequence(p).events[0].pitch,pitchAt(.8,selected.settings));
});
test('legacy files migrate and complete sequence JSON preserves images, order and settings',()=>{
  const legacy=drawing();assert.equal(validateSequence(legacy).sections.length,1);
  const p=blankSequence(legacy),b=drawing(88,6);b.image={dataURL:'data:image/png;base64,AAAA',mode:'reference',points:[[.2,.3,0]]};p.sections.push(b);p.active=1;p.title='Plan studies';
  assert.deepEqual(validateSequence(JSON.parse(JSON.stringify(p))),p);
  assert.equal(compileSequence(p).events.length,2,'silent reference image adds no events');
});
test('invalid projects and oversized playback are rejected before allocating audio',()=>{
  const p=blankSequence();assert.throws(()=>validateSequence({...p,active:9}));assert.throws(()=>validateSequence({...p,sections:Array(65).fill(p.sections[0])}));assert.throws(()=>validateSequence({...p,beatsPerBar:7}));assert.throws(()=>assertPlayableSequence(compileSequence(p)),/sounding/);
  p.sections=Array.from({length:7},()=>drawing(20,32));assert.throws(()=>assertPlayableSequence(compileSequence(p)),/10 minutes/);
});
