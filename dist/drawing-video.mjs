import {renderAudioBuffer} from './drawing-audio.mjs';

// Prefer H.264/AAC, then H.264/Opus, then the browser's native MP4 choice.
// Never disguise a WebM recording by changing its extension.
export function mp4MimeType(Recorder=globalThis.MediaRecorder){
  if(typeof Recorder?.isTypeSupported!=='function')return null;
  return [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1,opus',
    'video/mp4'
  ].find(type=>Recorder.isTypeSupported(type))||null;
}

export async function isMp4(blob){
  return blob.size>=16&&new TextDecoder().decode(await blob.slice(4,8).arrayBuffer())==='ftyp';
}

export async function renderMp4({canvas,events,settings,volume=.65,signal,onProgress=()=>{}}){
  const mimeType=mp4MimeType();
  if(!mimeType||typeof canvas.captureStream!=='function'||!globalThis.AudioContext)
    throw Error('MP4 export is unavailable in this browser. Try a current Chrome, Edge or Safari browser. PNG and WAV export are still available.');
  if(!events.length)throw Error('Draw something musical first, or make your imported image sing.');
  if(events.length>1500)throw Error('Choose a coarser Snap or fewer marks before exporting this dense drawing.');
  signal?.throwIfAborted();
  if(document.hidden)throw Error('Keep this tab visible while exporting the video.');
  const ctx=new AudioContext();
  let stream,destination,recorder,source,tick,finishTimer,watchdog,fail=()=>{};
  const abort=()=>fail(signal.reason||new DOMException('Video export cancelled.','AbortError'));
  const hidden=()=>{if(document.hidden)fail(Error('Video export was interrupted. Keep this tab visible and try again.'));};
  try{
    // Resume during the export button's user gesture, before offline rendering.
    await ctx.resume();
    if(ctx.state!=='running')throw Error('Tap Video MP4 again to allow audio in this browser.');
    onProgress(0,'Preparing sound…');
    const audio=await renderAudioBuffer(events,settings,volume);
    signal?.throwIfAborted();
    if(document.hidden)throw Error('Video export was interrupted. Keep this tab visible and try again.');
    if(ctx.state!=='running')throw Error('Audio was interrupted. Keep this tab active and try exporting again.');
    destination=ctx.createMediaStreamDestination();
    source=ctx.createBufferSource();source.buffer=audio;source.connect(destination);
    stream=canvas.captureStream(30);
    for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
    recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:4000000,audioBitsPerSecond:128000});
    const chunks=[];
    const blob=await new Promise((resolve,reject)=>{
      let completed=false;
      fail=reject;
      signal?.addEventListener('abort',abort,{once:true});
      document.addEventListener('visibilitychange',hidden);
      ctx.onstatechange=()=>{if(ctx.state!=='running')reject(Error('Audio was interrupted. Keep this tab active and try exporting again.'));};
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>reject(Error('This browser could not encode the MP4. Try another browser, or export PNG and WAV.'));
      recorder.onstop=()=>completed?resolve(new Blob(chunks,{type:'video/mp4'})):reject(Error('Video recording stopped before it finished. Please try again.'));
      for(const track of stream.getTracks())track.onended=()=>reject(Error('Video export was interrupted. Please try again.'));
      recorder.onstart=()=>{
        try{
        const start=ctx.currentTime+.1;
        source.onended=()=>{
          onProgress(1,'Finishing video…');
          finishTimer=setTimeout(()=>{completed=true;if(recorder.state!=='inactive')recorder.stop();},100);
        };
        source.start(start);
        const g=canvas.getContext('2d');
        tick=setInterval(()=>{
          // Static artwork still needs frames on browsers that capture changes.
          g.drawImage(canvas,0,0);
          onProgress(Math.max(0,Math.min(1,(ctx.currentTime-start)/audio.duration)),'Recording video…');
        },1000/30);
        }catch(e){reject(e);}
      };
      watchdog=setTimeout(()=>reject(Error('Video export timed out. Keep this tab active and try again.')),(audio.duration+8)*1000);
      recorder.start();
    });
    signal?.throwIfAborted();
    if(!await isMp4(blob))throw Error('The browser did not produce a valid MP4 file. Try another browser, or export PNG and WAV.');
    return blob;
  }finally{
    clearInterval(tick);clearTimeout(finishTimer);clearTimeout(watchdog);
    signal?.removeEventListener('abort',abort);document.removeEventListener('visibilitychange',hidden);
    ctx.onstatechange=null;
    if(recorder){recorder.onstart=recorder.onstop=recorder.onerror=recorder.ondataavailable=null;if(recorder.state!=='inactive')try{recorder.stop();}catch{}}
    if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();}
    for(const track of stream?.getTracks()||[]){track.onended=null;track.stop();}
    for(const track of destination?.stream.getAudioTracks()||[])track.stop();
    await ctx.close().catch(()=>{});
  }
}
