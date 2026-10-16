import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('.qa',{recursive:true});
const server=spawn('python3',['-m','http.server','8000','--directory','dist'],{stdio:'ignore'});
let browser,page;
try{
  for(let i=0;i<50;i++){try{if((await fetch('http://localhost:8000/paint.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});page=await browser.newPage({viewport:{width:1280,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:8000/paint.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  assert.equal(await page.locator('.swatch:visible').count(),16);
  await page.selectOption('#voice-family','original');assert.equal(await page.locator('.swatch:visible').count(),9);
  await page.selectOption('#voice-family','orchestra');assert.equal(await page.locator('.swatch:visible').count(),9);
  for(const id of ['violin','cello','oboe','clarinet','horn','trumpet','harp']){await page.click(`[data-voice="${id}"]`);await page.click('#audition');assert.equal(await page.locator(`[data-voice="${id}"]`).getAttribute('aria-pressed'),'true');}
  // Render each new timbre through the same real Web Audio path as playback and
  // exports. Compare harmonic spectra at the same pitch, not just renamed UI.
  const samples=await page.evaluate(async()=>{
    const {renderAudioBuffer,encodeWav}=await import('./drawing-audio.mjs');
    const voices=['keys','violin','cello','oboe','clarinet','horn','trumpet','harp'],result=[];
    for(const voice of voices){
      const audio=await renderAudioBuffer([{pitch:60,voice,start:0,duration:1.5}],{bpm:120,beats:2}),data=audio.getChannelData(0),rate=audio.sampleRate;
      let peak=0,sum=0;for(const n of data){peak=Math.max(peak,Math.abs(n));sum+=n*n;}
      const harmonics=[];for(let h=1;h<=8;h++){let re=0,im=0;for(let i=Math.floor(.22*rate);i<Math.floor(.5*rate);i++){const phase=2*Math.PI*261.625565*h*i/rate;re+=data[i]*Math.cos(phase);im+=data[i]*Math.sin(phase);}harmonics.push(Math.hypot(re,im));}
      const scale=Math.hypot(...harmonics),spectrum=harmonics.map(n=>n/scale),buffer=encodeWav([data],rate),bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      result.push({voice,peak,rms:Math.sqrt(sum/data.length),spectrum,wav:btoa(binary)});
    }
    return result;
  });
  for(const sample of samples){assert.ok(sample.peak>.01&&sample.peak<1&&sample.rms>.001,`audible unclipped ${sample.voice}`);await writeFile(`.qa/voice-${sample.voice}.wav`,Buffer.from(sample.wav,'base64'));}
  let closest=Infinity;
  for(let i=1;i<samples.length;i++)for(let j=0;j<i;j++){const distance=Math.hypot(...samples[i].spectrum.map((v,k)=>v-samples[j].spectrum[k]));closest=Math.min(closest,distance);assert.ok(distance>.015,`${samples[i].voice} and ${samples[j].voice} must have distinct spectra: ${distance}`);}
  // Preserve the user's existing drawing when trying the original ensemble.
  await page.click('#demo');await page.waitForFunction(()=>document.querySelector('#drawing-stats').textContent.includes('35 strokes'));await page.click('#orchestra-demo');assert.equal(await page.locator('.section-card').count(),2);assert.equal(await page.locator('#section-title').inputValue(),'A little paper orchestra');
  await page.click('#undo-drawing');assert.equal(await page.locator('.section-card').count(),1);assert.match(await page.locator('#drawing-stats').innerText(),/35 strokes/);await page.click('#redo-drawing');assert.equal(await page.locator('.section-card').count(),2);
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved on this device');await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.equal(await page.locator('#section-title').inputValue(),'A little paper orchestra');
  await page.selectOption('#voice-family','orchestra');await page.click('[data-voice="violin"]');await page.screenshot({path:'.qa/orchestra-desktop.png',fullPage:true});
  await page.locator('#loop').uncheck();await page.click('#paint-play');await page.waitForFunction(()=>document.querySelector('#paint-stop').disabled);
  await page.selectOption('#export-scope','current');const wav=page.waitForEvent('download');await page.click('#export-wav');await(await wav).saveAs('.qa/paper-orchestra.wav');
  await page.click('#export-video');await page.waitForFunction(()=>!document.querySelector('#video-download').hidden||document.querySelector('#video-status').classList.contains('error'),{},{timeout:25000});assert.equal(await page.locator('#video-download').isVisible(),true,await page.locator('#video-status').innerText());const video=page.waitForEvent('download');await page.click('#video-download');await(await video).saveAs('.qa/paper-orchestra.mp4');await page.click('#video-close');
  const pcm=execFileSync('ffmpeg',['-v','error','-i','.qa/paper-orchestra.mp4','-map','0:a:0','-ac','1','-f','f32le','-']);let videoPeak=0;for(let i=0;i<pcm.length;i+=4)videoPeak=Math.max(videoPeak,Math.abs(pcm.readFloatLE(i)));assert.ok(videoPeak>.01);
  // New highest-index voice must work for imported pixels too.
  await page.click('#clear-drawing');await page.click('[data-voice="harp"]');const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,256,128);g.fillStyle='#9B68AD';g.fillRect(20,50,200,4);return c.toDataURL().split(',')[1];});
  await page.setInputFiles('#image-file',{name:'harp-plan.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>!document.querySelector('#apply-image').disabled);await page.check('input[name="image-treatment"][value="one"]');await page.click('#apply-image');await page.locator('#image-dialog').waitFor({state:'hidden'});
  const saved=page.waitForEvent('download');await page.click('#save-project');await(await saved).saveAs('.qa/orchestra.sequence.json');const project=JSON.parse(await readFile('.qa/orchestra.sequence.json','utf8')),image=project.sections[project.active].image,codes=Buffer.from(image.samples,'base64');assert.ok(codes.length>0);for(let i=0;i<codes.length;i+=4)assert.equal(codes.readUInt32LE(i)>>>19,15);
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');await page.click('#paint-play');await page.waitForFunction(()=>document.querySelector('#paint-stop').disabled);
  const mobile=await browser.newPage({viewport:{width:390,height:844}});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('http://localhost:8000/paint.html');await mobile.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.equal(await mobile.locator('.swatch:visible').count(),16);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mobile.selectOption('#voice-family','orchestra');await mobile.click('[data-voice="horn"]');await mobile.click('#audition');await mobile.click('#orchestra-demo');await mobile.screenshot({path:'.qa/orchestra-mobile.png',fullPage:true});assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);await writeFile('.qa/orchestra-report.json',JSON.stringify({voices:samples.map(({wav,...sample})=>sample),closestSpectralDistance:closest,videoPeak,pageErrors:errors,mobile:'passed',highestImageVoice:'harp (15)',savedProject:'passed',demoUndo:'passed'},null,2));console.log('Orchestral audition, distinct rendered spectra, non-destructive demo, saved projects, highest image voice, WAV, MP4 and mobile passed.');
}catch(e){if(page)await page.screenshot({path:'.qa/orchestra-failure.png',fullPage:true});throw e;}finally{await browser?.close();server.kill();}
