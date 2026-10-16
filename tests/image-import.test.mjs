import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_IMAGE_BYTES,importPolicy,fitImport,imageDimensions,encodeSamples,sampleCodes,validateSamples,imageSampleCount} from '../dist/image-data.mjs';
import {analyzeImage,poolInkPixels,prepareImage} from '../dist/image-import-core.mjs';
import {blankDrawing,validateDrawing,compileDrawing,pixelsToPoints} from '../dist/drawing-model.mjs';
import {blankSequence,validateSequence} from '../dist/drawing-sequence.mjs';
import {SectionImageCache} from '../dist/drawing-images.mjs';
function png(width,height){const b=new Uint8Array(24);b.set([137,80,78,71,13,10,26,10]);new DataView(b.buffer).setUint32(16,width);new DataView(b.buffer).setUint32(20,height);return b;}
const packed=(codes,width=1024,height=512)=>({samples:encodeSamples(codes),sampleWidth:width,sampleHeight:height});
test('device-aware profiles retain up to 4K without upscaling or unbounded decoding',()=>{
  assert.equal(MAX_IMAGE_BYTES,100000000);const desk=importPolicy('auto',{memory:8}),mobile=importPolicy('auto',{memory:4,mobile:true});
  assert.equal(desk.width,4096);assert.equal(mobile.width,2048);assert.equal(importPolicy('detailed',{memory:4}).width,4096);
  const big=fitImport(10000,8000,desk);assert.ok(big.width*big.height<=8388608);assert.ok(big.drawWidth<=4096&&big.drawHeight<=2048);
  const small=fitImport(300,200,desk);assert.equal(small.drawWidth,300);assert.equal(small.drawHeight,200);
  assert.throws(()=>fitImport(10000,8000,mobile),/32 megapixel/);assert.throws(()=>fitImport(32769,1,desk));
});
test('header inspection reads PNG/JPEG/WebP dimensions before raster decoding',()=>{
  assert.deepEqual(imageDimensions(png(8000,6000)),{width:8000,height:6000,format:'PNG'});
  const jpeg=new Uint8Array([255,216,255,192,0,8,8,1,44,2,88,0]);assert.deepEqual(imageDimensions(jpeg),{width:600,height:300,format:'JPEG'});
  const webp=new Uint8Array(30);webp.set(new TextEncoder().encode('RIFF'),0);webp.set(new TextEncoder().encode('WEBPVP8X'),8);webp[24]=255;webp[25]=3;webp[27]=255;webp[28]=1;assert.deepEqual(imageDimensions(webp),{width:1024,height:512,format:'WebP'});
  assert.throws(()=>imageDimensions(new Uint8Array(32)));
});
test('oversized files and source pixel counts fail before any decode allocation',async()=>{
  let decoded=false;const options={decode:()=>{decoded=true;throw Error('must not decode');}};
  await assert.rejects(prepareImage({size:100000001},importPolicy(),options),/100 MB/);
  const file={size:1000,slice:()=>({arrayBuffer:async()=>png(30000,30000).buffer})};await assert.rejects(prepareImage(file,importPolicy(),options),/megapixel/);assert.equal(decoded,false);
});
test('fine neutral ink survives contrast pooling when average reduction would erase it',async()=>{
  const input=new Uint8ClampedArray(4*4*4).fill(255);input.set([0,0,0,255],0);
  const pooled=await poolInkPixels(input,4,4,2,2),sound=await analyzeImage(pooled,2,2);assert.equal(sound.sampleCount,1);
  assert.equal(pixelsToPoints(new Uint8ClampedArray([191,191,191,255]),1,1).length,0);
  assert.equal(sampleCodes({...sound})[0]>>>19,7,'black ink uses the bass palette voice');
});
test('compact sound maps round trip to the exact legacy event positions',()=>{
  const a=blankDrawing();a.image={dataURL:'data:image/png;base64,AAAA',mode:'sound',points:[[100.5/1024,200.5/512,0],[700.5/1024,400.5/512,4]]};
  const b=blankDrawing();b.version=2;b.image={dataURL:a.image.dataURL,mode:'sound',points:[],...packed([100|(200<<10),700|(400<<10)|(4<<19)])};
  assert.deepEqual(compileDrawing(validateDrawing(b)),compileDrawing(a));assert.equal(imageSampleCount(b.image),2);assert.ok(validateSamples(b.image));
  const p=blankSequence(a);p.sections.push(b);assert.deepEqual(compileDrawing(validateSequence(JSON.parse(JSON.stringify(p))).sections[1]),compileDrawing(b));
  assert.throws(()=>validateDrawing({...b,version:1}));assert.equal(validateSamples(packed([0xffffffff])),false);assert.equal(validateSamples({samples:'AA==',sampleWidth:10,sampleHeight:10}),false);assert.equal(validateSamples({samples:'!!!!',sampleWidth:10,sampleHeight:10}),false);
});
test('analysis has a bounded sample count and respects sensitivity, voice and cancellation',async()=>{
  const pixels=new Uint8ClampedArray(1024*512*4);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
  const data=await analyzeImage(pixels,1024,512,{voice:2});assert.equal(data.sampleCount,131072);assert.ok(sampleCodes(data).every(code=>code>>>19===2));assert.ok(data.samples.length<700000);
  const c=new AbortController();c.abort();await assert.rejects(analyzeImage(pixels,1024,512,{signal:c.signal}),{name:'AbortError'});
});
test('decoded image cache stays bounded to current/next plans and releases them',async()=>{
  const made=[],sections=Array.from({length:20},(_,i)=>({image:{dataURL:'image-'+i}}));
  const cache=await new SectionImageCache(sections,()=>{const image={async decode(){}};made.push(image);return image;}).start();assert.equal(cache.entries.size,2);
  for(let index=0;index<20;index++){await cache.prepare(index);cache.step(index);await cache.prepare((index+1)%20);assert.equal(cache.entries.size,2);}
  assert.equal(made.filter(im=>im.src).length,2);cache.dispose();assert.equal(made.filter(im=>im.src).length,0);
});
