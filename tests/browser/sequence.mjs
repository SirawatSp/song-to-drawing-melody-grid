import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {blankDrawing} from '../../dist/drawing-model.mjs';
await mkdir('.qa',{recursive:true});
const server=spawn('python3',['-m','http.server','8000','--directory','dist'],{stdio:'ignore'});
let browser,page;
try{
  for(let i=0;i<50;i++){try{if((await fetch('http://localhost:8000/paint.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});page=await browser.newPage({viewport:{width:1280,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8000/paint.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  const png=await readFile('dist/downloads/singing-garden.png');
  await page.setInputFiles('#section-files',[{name:'Ground floor.png',mimeType:'image/png',buffer:png},{name:'Upper floor.png',mimeType:'image/png',buffer:png}]);
  await page.locator('#image-dialog').waitFor({state:'visible'});await page.click('#apply-image');
  await page.waitForFunction(()=>document.querySelectorAll('.section-card').length===2);
  await page.selectOption('#paint-beats','4');await page.locator('#paint-bpm').fill('120');await page.locator('#paint-bpm').press('Tab');
  await page.click('.section-card[data-section="1"]');await page.selectOption('#paint-beats','3');await page.selectOption('#paint-key','2');await page.selectOption('#paint-scale','minor');await page.selectOption('#paint-quantize','1');await page.locator('#paint-bpm').fill('180');await page.locator('#paint-bpm').press('Tab');
  await page.click('#move-section-left');
  assert.match(await page.locator('.section-card').first().innerText(),/Upper floor/);
  assert.equal(await page.locator('#paint-bpm').inputValue(),'180');
  await page.click('#remove-section');assert.equal(await page.locator('.section-card').count(),1);await page.click('#undo-drawing');assert.equal(await page.locator('.section-card').count(),2);
  await page.click('#duplicate-section');assert.equal(await page.locator('.section-card').count(),3);await page.click('#undo-drawing');assert.equal(await page.locator('.section-card').count(),2);
  await page.locator('#sequence-title').fill('Architecture in sound');await page.locator('#sequence-title').press('Tab');
  await page.locator('#save-status').filter({hasText:'Saved on this device'}).waitFor();
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  assert.equal(await page.locator('.section-card').count(),2);assert.match(await page.locator('.section-card').first().innerText(),/Upper floor/);assert.equal(await page.locator('#sequence-title').inputValue(),'Architecture in sound');
  const save=page.waitForEvent('download');await page.click('#save-project');await(await save).saveAs('.qa/plans.sequence.json');
  const project=JSON.parse(await readFile('.qa/plans.sequence.json','utf8'));
  assert.equal(project.sections.length,2);assert.equal(project.sections[0].title,'Upper floor');assert.equal(project.sections[0].settings.key,2);assert.equal(project.sections[0].settings.bpm,180);assert.equal(project.sections[1].settings.bpm,120);assert.ok(project.sections.every(s=>s.image.dataURL));
  await page.locator('#loop').uncheck();await page.click('#sequence-play');
  await page.waitForFunction(()=>document.querySelector('#section-now').textContent.includes('Playing Ground floor'));
  await page.waitForFunction(()=>document.querySelector('#sequence-play').textContent.includes('Play sequence'));
  await page.screenshot({path:'.qa/sequence-desktop.png',fullPage:true});
  await page.click('#export-video');
  await page.waitForFunction(()=>!document.querySelector('#video-download').hidden||document.querySelector('#video-status').classList.contains('error'),{},{timeout:25000});
  assert.equal(await page.locator('#video-download').isVisible(),true,await page.locator('#video-status').textContent());
  const video=page.waitForEvent('download');await page.click('#video-download');await(await video).saveAs('.qa/plans-sequence.mp4');await page.screenshot({path:'.qa/sequence-export.png',fullPage:true});await page.click('#video-close');
  const wav=page.waitForEvent('download');await page.click('#export-wav');await(await wav).saveAs('.qa/plans-sequence.wav');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.qa/sequence-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile must not overflow');
  // JSON round trip restores the whole sequence, not just the selected drawing.
  await page.click('#remove-section');await page.setInputFiles('#project-file','.qa/plans.sequence.json');await page.waitForFunction(()=>document.querySelectorAll('.section-card').length===2);
  // Opening a legacy drawing remains supported.
  await page.setInputFiles('#project-file',{name:'legacy.drawing.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(blankDrawing()))});await page.waitForFunction(()=>document.querySelectorAll('.section-card').length===1);
  assert.deepEqual(errors,[]);
  const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json','.qa/plans-sequence.mp4'],{encoding:'utf8'}));
  assert.ok(info.streams.some(s=>s.codec_type==='video'));assert.ok(info.streams.some(s=>s.codec_type==='audio'));assert.ok(+info.format.duration>3.4&&+info.format.duration<4.3);
  function frame(time,name){
    if(name)execFileSync('ffmpeg',['-v','error','-y','-ss',String(time),'-i','.qa/plans-sequence.mp4','-frames:v','1',`.qa/${name}.png`]);
    return execFileSync('ffmpeg',['-v','error','-ss',String(time),'-i','.qa/plans-sequence.mp4','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:4000000});
  }
  function cursor(bytes){let best=0,column=-1;for(let x=76;x<1236;x++){let count=0;for(let y=125;y<575;y++){const i=(y*1280+x)*3;if(Math.abs(bytes[i]-164)<28&&Math.abs(bytes[i+1]-116)<28&&Math.abs(bytes[i+2]-58)<28)count++;}if(count>best){best=count;column=x;}}assert.ok(best>150,'moving golden playhead is present');return column;}
  const x1=cursor(frame(.3,'sequence-first')),x2=cursor(frame(.7));assert.ok(x2>x1+100,'playhead advances with the audio clock');frame(1.6,'sequence-next');
  for(const start of [.2,1.4]){const pcm=execFileSync('ffmpeg',['-v','error','-ss',String(start),'-i','.qa/plans-sequence.mp4','-t','.4','-map','0:a:0','-ac','1','-f','f32le','-']);let peak=0;for(let i=0;i<pcm.length;i+=4)peak=Math.max(peak,Math.abs(pcm.readFloatLE(i)));assert.ok(peak>.001,'both drawings contribute audible sound');}
  const audioInfo=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-of','json','.qa/plans-sequence.wav'],{encoding:'utf8'}));assert.ok(Math.abs(+audioInfo.format.duration-3.5)<.01);
  await writeFile('.qa/sequence-report.json',JSON.stringify({duration:info.format.duration,sections:2,video:info.streams.find(s=>s.codec_type==='video').codec_name,audio:info.streams.find(s=>s.codec_type==='audio').codec_name,cursor:[x1,x2],pageErrors:errors},null,2));
  console.log('Sequence import, reordering, undo, persistence, playback, animated MP4 and WAV passed.');
}catch(e){if(page){console.log('status',await page.locator('#paint-message').textContent(),await page.locator('#video-status').textContent());await page.screenshot({path:'.qa/sequence-failure.png',fullPage:true});}throw e;}finally{await browser?.close();server.kill();}
