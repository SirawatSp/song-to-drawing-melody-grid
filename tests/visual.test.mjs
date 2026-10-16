import test from 'node:test';
import assert from 'node:assert/strict';
import {blankDrawing} from '../dist/drawing-model.mjs';
import {blankSequence,compileSequence} from '../dist/drawing-sequence.mjs';
import {createVideoPainter} from '../dist/drawing-visual.mjs';
test('animated frames switch the actual drawing and labels without changing source events',async()=>{
  const priorDocument=globalThis.document,priorImage=globalThis.Image,calls=[];
  const context=new Proxy({}, {get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
  globalThis.document={createElement:()=>({getContext:()=>context})};globalThis.Image=class{async decode(){}};
  try{
    const a=blankDrawing(),b=blankDrawing();a.title='Ground floor';b.title='Upper floor';a.image={dataURL:'first-image',mode:'sound'};b.image={dataURL:'second-image',mode:'sound'};b.settings.key=2;
    a.image.points=b.image.points=[];const project=blankSequence(a);project.sections.push(b);const sequence=compileSequence(project),before=JSON.stringify(sequence.events),painter=await createVideoPainter(sequence);
    calls.length=0;painter.drawFrame(.5);assert.equal(calls.find(c=>c[0]==='drawImage')[1].src,'first-image');assert.ok(calls.some(c=>c[0]==='fillText'&&c[1]==='Ground floor'));
    calls.length=0;painter.drawFrame(sequence.segments[1].start);assert.equal(calls.find(c=>c[0]==='drawImage')[1].src,'second-image');assert.ok(calls.some(c=>c[0]==='fillText'&&c[1]==='Upper floor'));assert.ok(calls.some(c=>c[0]==='fillText'&&c[1].includes('D pentatonic')));assert.equal(JSON.stringify(sequence.events),before);
  }finally{if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;if(priorImage===undefined)delete globalThis.Image;else globalThis.Image=priorImage;}
});
