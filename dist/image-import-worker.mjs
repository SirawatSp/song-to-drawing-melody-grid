import {prepareImage,analyzeImage} from './image-import-core.mjs';
const makeCanvas=(w,h)=>new OffscreenCanvas(w,h);
const toURL=async canvas=>new FileReaderSync().readAsDataURL(await canvas.convertToBlob({type:'image/png'}));
self.onmessage=async({data})=>{
  const {id,type,payload}=data,progress=(stage,value)=>self.postMessage({id,stage,value});
  if(typeof OffscreenCanvas!=='function'||typeof createImageBitmap!=='function'||typeof FileReaderSync!=='function'){self.postMessage({id,unsupported:true});return;}
  try{
    const result=type==='prepare'?await prepareImage(payload.file,payload.policy,{makeCanvas,toURL,decode:(file,fit)=>createImageBitmap(file,{resizeWidth:fit.drawWidth,resizeHeight:fit.drawHeight,resizeQuality:'high'}),progress}):await analyzeImage(payload.pixels,payload.width,payload.height,{...payload.options,progress});
    self.postMessage({id,result},result.pixels?[result.pixels.buffer]:[]);
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};
