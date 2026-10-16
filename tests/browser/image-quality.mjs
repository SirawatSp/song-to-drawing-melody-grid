import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
await mkdir('.qa',{recursive:true});
const server=spawn('python3',['-m','http.server','8000','--directory','dist'],{stdio:'ignore'});
let browser,page;
try{
  for(let i=0;i<50;i++){try{if((await fetch('http://localhost:8000/paint.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  // Real 12-megapixel PNG with deliberately uncompressed pixels, not a padded
  // small file: it exercises the old 10 MB ceiling and actual decoding work.
  execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=white:s=4096x3072','-vf','drawgrid=width=256:height=256:thickness=1:color=black,drawbox=x=512:y=384:w=2800:h=2100:color=black:t=3','-frames:v','1','-pix_fmt','rgb24','-compression_level','0','.qa/large-plan.png']);
  const fileBytes=(await stat('.qa/large-plan.png')).size;assert.ok(fileBytes>10000000&&fileBytes<100000000);
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});page=await browser.newPage({viewport:{width:1280,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{let last=performance.now();window.importGaps=[];setInterval(()=>{const now=performance.now();window.importGaps.push(now-last);last=now;},16);});
  await page.goto('http://localhost:8000/paint.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  const started=Date.now();await page.setInputFiles('#image-file','.qa/large-plan.png');await page.locator('#image-dialog').waitFor({state:'visible'});
  await page.selectOption('#image-quality','detailed');await page.locator('#apply-image').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#apply-image').disabled,{},{timeout:90000});
  assert.match(await page.locator('#image-import-status').innerText(),/4096×2048 retained/);
  const previewInk=await page.evaluate(async()=>{const im=document.querySelector('#image-preview');await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);const rgba=g.getImageData(0,0,c.width,c.height).data;let ink=0;for(let i=0;i<rgba.length;i+=4)if(rgba[i]<250&&rgba[i+3]>80)ink++;return ink;});assert.ok(previewInk>50,'thin plan lines must remain visible in the preview');
  const prepareMs=Date.now()-started,prepareGap=await page.evaluate(()=>Math.max(...window.importGaps));assert.ok(prepareGap<1000,`worker import stalled UI for ${prepareGap} ms`);
  await page.screenshot({path:'.qa/large-image-import.png',fullPage:true});await page.click('#apply-image');await page.locator('#image-dialog').waitFor({state:'hidden',timeout:90000});
  assert.match(await page.locator('#image-status').innerText(),/4096×2048/);assert.match(await page.locator('#image-status').innerText(),/ink anchors/);
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved on this device');
  const save=page.waitForEvent('download');await page.click('#save-project');await(await save).saveAs('.qa/large-plan.sequence.json');
  const project=JSON.parse(await readFile('.qa/large-plan.sequence.json','utf8')),image=project.sections[0].image;
  assert.equal(project.sections[0].version,2);assert.equal(image.info.width,4096);assert.equal(image.info.height,2048);assert.equal(image.info.sourceWidth,4096);assert.equal(image.info.sourceHeight,3072);assert.equal(image.info.fileBytes,fileBytes);assert.equal(image.sampleWidth,1024);assert.equal(image.sampleHeight,512);assert.ok(image.samples.length>0&&image.samples.length<700000);assert.equal(image.points.length,0);assert.ok(image.thumbnail.length<1000000);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');assert.match(await page.locator('#image-status').innerText(),/4096×2048/);
  // Bounded sound still plays and exports from the higher quality raster.
  await page.selectOption('#paint-quantize','1');await page.selectOption('#paint-beats','4');await page.locator('#paint-bpm').fill('240');await page.locator('#paint-bpm').press('Tab');await page.locator('#loop').uncheck();await page.click('#paint-play');await page.waitForFunction(()=>document.querySelector('#paint-stop').disabled);
  await page.click('#export-video');await page.waitForFunction(()=>!document.querySelector('#video-download').hidden||document.querySelector('#video-status').classList.contains('error'),{},{timeout:25000});assert.equal(await page.locator('#video-download').isVisible(),true,await page.locator('#video-status').innerText());
  const video=page.waitForEvent('download');await page.click('#video-download');await(await video).saveAs('.qa/large-plan.mp4');await page.click('#video-close');
  const pcm=execFileSync('ffmpeg',['-v','error','-i','.qa/large-plan.mp4','-map','0:a:0','-ac','1','-f','f32le','-']);let peak=0;for(let i=0;i<pcm.length;i+=4)peak=Math.max(peak,Math.abs(pcm.readFloatLE(i)));assert.ok(peak>.001);
  // Cancelling while a large image is being prepared keeps the current plan.
  await page.setInputFiles('#image-file','.qa/large-plan.png');await page.locator('#image-dialog').waitFor({state:'visible'});await page.click('#image-dialog .dialog-x');await page.locator('#image-dialog').waitFor({state:'hidden'});assert.match(await page.locator('#image-status').innerText(),/4096×2048/);
  // Pixel bomb header is rejected before a decoder can allocate the huge raster.
  const header=Buffer.alloc(24);header.set([137,80,78,71,13,10,26,10]);header.writeUInt32BE(32000,16);header.writeUInt32BE(32000,20);
  await page.setInputFiles('#image-file',{name:'huge-dimensions.png',mimeType:'image/png',buffer:header});await page.waitForFunction(()=>document.querySelector('#image-import-status').textContent.includes('megapixel'));assert.equal(await page.locator('#apply-image').isEnabled(),false);await page.click('#image-dialog .dialog-x');
  assert.match(await page.locator('#image-status').innerText(),/4096×2048/);
  // Auto switches down on a constrained/mobile device; export/import stays valid.
  const mobile=await browser.newPage({viewport:{width:390,height:844}});await mobile.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{get:()=>2}));await mobile.goto('http://localhost:8000/paint.html',{waitUntil:'domcontentloaded'});await mobile.waitForFunction(()=>document.documentElement.dataset.ready==='true');await mobile.setInputFiles('#image-file','.qa/large-plan.png');await mobile.waitForFunction(()=>!document.querySelector('#apply-image').disabled,{},{timeout:90000});assert.match(await mobile.locator('#image-import-status').innerText(),/2048×1024 retained · balanced/);await mobile.screenshot({path:'.qa/large-image-mobile.png',fullPage:true});await mobile.click('#apply-image');await mobile.locator('#image-dialog').waitFor({state:'hidden'});assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // No-Worker fallback yields work and remains usable for normal drawings.
  const fallback=await browser.newPage();await fallback.addInitScript(()=>{window.Worker=undefined;});await fallback.goto('http://localhost:8000/paint.html',{waitUntil:'domcontentloaded'});await fallback.waitForFunction(()=>document.documentElement.dataset.ready==='true');await fallback.setInputFiles('#image-file','dist/downloads/singing-garden.png');await fallback.waitForFunction(()=>!document.querySelector('#apply-image').disabled);await fallback.click('#apply-image');await fallback.locator('#image-dialog').waitFor({state:'hidden'});assert.match(await fallback.locator('#image-status').innerText(),/ink anchors/);
  assert.deepEqual(errors,[]);
  await writeFile('.qa/image-quality-report.json',JSON.stringify({fileBytes,source:[4096,3072],retained:[image.info.width,image.info.height],analysis:[image.sampleWidth,image.sampleHeight],packedSoundChars:image.samples.length,previewInk,prepareMs,maxMainThreadGapMs:prepareGap,audioPeak:peak,mobileProfile:'balanced',fallback:'passed',pageErrors:errors},null,2));
  console.log('Large file, 4K raster, responsive worker, compact audio, persistence, video, cancel, dimension guard, mobile and fallback passed.');
}catch(e){if(page){console.log('import status',await page.locator('#image-import-status').textContent());await page.screenshot({path:'.qa/image-quality-failure.png',fullPage:true});}throw e;}finally{await browser?.close();server.kill();}
