import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('.qa',{recursive:true});
const server=spawn('python3',['-m','http.server','8000','--directory','dist'],{stdio:'ignore'});
let browser;
try{
for(let i=0;i<50;i++){
  try{if((await fetch('http://localhost:8000/paint.html')).ok)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
}
browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:8000/paint.html',{waitUntil:'domcontentloaded'});
console.log('capabilities',await page.evaluate(()=>({ua:navigator.userAgent,types:['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/mp4;codecs=avc1,opus','video/mp4'].map(t=>[t,MediaRecorder.isTypeSupported(t)])})));
await page.click('#demo');await page.waitForFunction(()=>document.querySelector('#drawing-stats').textContent.includes('35 strokes'));
await page.click('#export-video');await page.locator('#video-download').waitFor({state:'visible',timeout:25000});
console.log('export',await page.locator('#video-status').textContent());
await page.screenshot({path:'.qa/mp4-export-desktop.png',fullPage:true});
const dl=page.waitForEvent('download');await page.click('#video-download');await(await dl).saveAs('.qa/singing-garden.mp4');
assert.ok(await page.locator('#video-preview').evaluate(v=>v.videoWidth>0));
console.log('preview',await page.evaluate(()=>({width:document.querySelector('video').videoWidth,height:document.querySelector('video').videoHeight,duration:document.querySelector('video').duration})));
await page.click('#video-close');
// Actual cancellation, then recovery on a subsequent export.
await page.click('#export-video');await page.click('#video-close');await page.waitForFunction(()=>document.querySelector('#video-status').textContent.includes('cancelled'));
await page.click('#video-close');
await page.setViewportSize({width:390,height:844});await page.click('#export-video');await page.locator('#video-download').waitFor({state:'visible',timeout:25000});
await page.screenshot({path:'.qa/mp4-export-mobile.png',fullPage:true});
console.log('mobile',await page.evaluate(()=>({pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,dialog:document.querySelector('#video-dialog').getBoundingClientRect().toJSON(),status:document.querySelector('#video-status').textContent})));
const mdl=page.waitForEvent('download');await page.click('#video-download');await(await mdl).saveAs('.qa/mobile.mp4');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.click('#video-close');
// Imported image -> its pixel notes -> video.
await page.click('#clear-drawing');
await page.setInputFiles('#image-file','dist/downloads/singing-garden.png');await page.locator('#image-dialog').waitFor({state:'visible'});await page.click('#apply-image');
await page.selectOption('#paint-quantize','1');await page.click('#export-video');
await page.locator('#video-download').waitFor({state:'visible',timeout:25000});
const idl=page.waitForEvent('download');await page.click('#video-download');await(await idl).saveAs('.qa/import.mp4');
console.log('image export',await page.locator('#drawing-stats').textContent());
// Unsupported encoding is actionable and the rest of the studio still works.
await page.click('#video-close');
await page.evaluate(()=>MediaRecorder.isTypeSupported=()=>false);
await page.click('#export-video');
await page.waitForFunction(()=>document.querySelector('#video-status').textContent.includes('unavailable'));
assert.equal(await page.locator('#video-download').isVisible(),false);
await page.click('#video-close');
assert.equal(await page.locator('#export-video').isEnabled(),true);
assert.deepEqual(errors,[]);
const report=[];
for(const file of ['singing-garden.mp4','mobile.mp4','import.mp4']){
  const path='.qa/'+file;
  const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'}));
  const video=info.streams.find(s=>s.codec_type==='video'),audio=info.streams.find(s=>s.codec_type==='audio');
  assert.ok(video&&audio,'MP4 must contain both image and sound');
  assert.match(info.format.format_name,/mp4/);
  assert.ok(video.width>0&&video.height>0&&video.width<=1920&&video.height<=1080);
  assert.ok(Number(info.format.duration)>4.5&&Number(info.format.duration)<7,'one garden loop plus release tail and recording padding');
  const pcm=execFileSync('ffmpeg',['-v','error','-i',path,'-map','0:a:0','-ac','1','-f','f32le','-'],{maxBuffer:10000000});
  let peak=0;for(let i=0;i<pcm.length;i+=4)peak=Math.max(peak,Math.abs(pcm.readFloatLE(i)));
  assert.ok(peak>.001,'exported sound must not be silent');
  report.push({file,video:video.codec_name,audio:audio.codec_name,width:video.width,height:video.height,duration:info.format.duration,peak});
}
await writeFile('.qa/report.json',JSON.stringify({report,pageErrors:errors},null,2));
console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();server.kill();}
