import {prepareImage,analyzeImage} from './image-import-core.mjs';
import {importPolicy} from './image-data.mjs';
export const currentPolicy=choice=>importPolicy(choice,{memory:navigator.deviceMemory??8,mobile:matchMedia('(max-width: 760px)').matches});
const abortError=()=>new DOMException('Image import cancelled.','AbortError');
export class ImageImporter{
  constructor(){this.worker=null;this.next=0;this.queue=Promise.resolve();this.fallback=false;}
  run(type,payload,{signal,onProgress=()=>{}}={}){
    const execute=async()=>{
      signal?.throwIfAborted();
      if(!this.fallback&&typeof Worker==='function'){
        try{return await this.inWorker(type,payload,{signal,onProgress});}catch(e){if(!e.unsupported)throw e;this.fallback=true;}
      }
      // No worker available: yield during analysis and keep native resizing async.
      const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
      const toURL=async canvas=>{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not keep this image. Try Balanced quality.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});};
      const decode=async(file,fit,dimensions)=>{
        if(typeof createImageBitmap==='function')return createImageBitmap(file,{resizeWidth:fit.drawWidth,resizeHeight:fit.drawHeight,resizeQuality:'high'});
        if(dimensions.width*dimensions.height>12000000)throw Error('This browser cannot resize a large plan safely. Use a current browser or export a smaller image first.');
        const url=URL.createObjectURL(file),image=new Image();try{image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}
      };
      return type==='prepare'?prepareImage(payload.file,payload.policy,{makeCanvas,toURL,decode,progress:onProgress,signal,yieldControl:()=>new Promise(resolve=>setTimeout(resolve,0))}):analyzeImage(payload.pixels,payload.width,payload.height,{...payload.options,progress:onProgress,signal,yieldControl:()=>new Promise(resolve=>setTimeout(resolve,0))});
    };
    const result=this.queue.catch(()=>{}).then(execute);this.queue=result;return result;
  }
  inWorker(type,payload,{signal,onProgress}){
    return new Promise((resolve,reject)=>{
      const id=++this.next;
      const cleanup=()=>{clearTimeout(timeout);signal?.removeEventListener('abort',abort);if(this.worker)this.worker.onmessage=this.worker.onerror=null;};
      const finish=(error,result)=>{cleanup();if(error)reject(error);else resolve(result);};
      const destroy=()=>{this.worker?.terminate();this.worker=null;};
      const abort=()=>{destroy();finish(signal?.reason||abortError());};
      const timeout=setTimeout(()=>{destroy();finish(Error('Image processing took too long. Try Balanced quality or a smaller image.'));},90000);
      signal?.addEventListener('abort',abort,{once:true});
      try{
        if(!this.worker)this.worker=new Worker(new URL('./image-import-worker.mjs',import.meta.url),{type:'module'});
        this.worker.onmessage=({data})=>{
          if(data.id!==id)return;
          if(data.stage){onProgress(data.stage,data.value);return;}
          if(data.unsupported){destroy();const e=Error('Worker unavailable');e.unsupported=true;finish(e);}
          else if(data.error)finish(Error(data.error));else finish(null,data.result);
        };
        this.worker.onerror=()=>{destroy();const e=Error('Worker unavailable');e.unsupported=true;finish(e);};
        this.worker.postMessage({id,type,payload});
      }catch(e){destroy();e.unsupported=true;finish(e);}
    });
  }
  prepare(file,policy,options){return this.run('prepare',{file,policy},options);}
  analyze(prepared,options,control){return this.run('analyze',{pixels:prepared.pixels,width:prepared.sampleWidth,height:prepared.sampleHeight,options},control);}
}
