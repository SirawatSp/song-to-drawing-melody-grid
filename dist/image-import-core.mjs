import {MAX_IMAGE_BYTES,MAX_IMAGE_DATA_CHARS,imageDimensions,fitImport,encodeSamples} from './image-data.mjs';
import {nearestVoice} from './drawing-model.mjs';
export async function prepareImage(file,policy,{makeCanvas,decode,toURL,progress=()=>{},signal,yieldControl=async()=>{}}={}){
  signal?.throwIfAborted();
  if(!file||file.size>MAX_IMAGE_BYTES)throw Error('Choose an image up to 100 MB.');
  if(!file.size)throw Error('This image file is empty.');
  progress('Reading image size',.05);
  const dimensions=imageDimensions(new Uint8Array(await file.slice(0,2097152).arrayBuffer())),fit=fitImport(dimensions.width,dimensions.height,policy);
  signal?.throwIfAborted();progress('Resizing your plan',.2);
  let bitmap,visual,analysis,thumbnail;
  try{
    bitmap=await decode(file,fit,dimensions);signal?.throwIfAborted();
    visual=makeCanvas(fit.width,fit.height);const g=visual.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.drawImage(bitmap,(fit.width-fit.drawWidth)/2,(fit.height-fit.drawHeight)/2,fit.drawWidth,fit.drawHeight);bitmap.close?.();bitmap=null;
    const full=g.getImageData(0,0,visual.width,visual.height).data;
    progress('Preserving fine plan lines',.4);
    const pixels=await poolInkPixels(full,visual.width,visual.height,fit.analysisWidth,fit.analysisHeight,{signal,yieldControl});
    thumbnail=makeCanvas(Math.min(384,fit.width),Math.min(192,fit.height));thumbnail.getContext('2d').drawImage(visual,0,0,thumbnail.width,thumbnail.height);
    progress('Keeping image detail',.65);
    const dataURL=await toURL(visual),preview=await toURL(thumbnail);
    if(dataURL.length>MAX_IMAGE_DATA_CHARS)throw Error('This plan needs too much memory at this quality. Choose Balanced and try again.');
    signal?.throwIfAborted();progress('Image ready',1);
    return {dataURL,thumbnail:preview,pixels,sampleWidth:fit.analysisWidth,sampleHeight:fit.analysisHeight,info:{width:fit.width,height:fit.height,sourceWidth:dimensions.width,sourceHeight:dimensions.height,fileBytes:file.size,profile:policy.profile}};
  }finally{bitmap?.close?.();for(const canvas of [visual,analysis,thumbnail])if(canvas){canvas.width=1;canvas.height=1;}}
}
// Contrast-preserving reduction: thin black/colored lines survive instead of
// being averaged together with their white surroundings.
export async function poolInkPixels(source,sw,sh,width,height,{signal,yieldControl=async()=>{}}={}){
  const out=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++){
    if(y%16===0){signal?.throwIfAborted();await yieldControl();}
    const top=Math.floor(y*sh/height),bottom=Math.max(top+1,Math.floor((y+1)*sh/height));
    for(let x=0;x<width;x++){
      const left=Math.floor(x*sw/width),right=Math.max(left+1,Math.floor((x+1)*sw/width));let best=(top*sw+left)*4,score=-1;
      for(let py=top;py<bottom;py++)for(let px=left;px<right;px++){
        const at=(py*sw+px)*4,contrast=(255-(source[at]+source[at+1]+source[at+2])/3)*source[at+3]/255;
        if(contrast>score){score=contrast;best=at;}
      }
      out.set(source.subarray(best,best+4),(y*width+x)*4);
    }
  }return out;
}
// Read the strongest qualifying ink pixel in each 2×2 group. Unlike averaging
// the group into a gray dot, this retains a fine line that would become faint.
export async function analyzeImage(pixels,width,height,{voice=null,sensitivity=35,progress=()=>{},yieldControl=async()=>{},signal}={}){
  const codes=[];
  for(let y=0;y<height;y+=2){
    if(y%32===0){signal?.throwIfAborted();progress('Reading fine lines',y/height);await yieldControl();}
    for(let x=0;x<width;x+=2){
      let best=-1,bestScore=-1;
      for(let dy=0;dy<2&&y+dy<height;dy++)for(let dx=0;dx<2&&x+dx<width;dx++){
        const at=((y+dy)*width+x+dx)*4,r=pixels[at],g=pixels[at+1],b=pixels[at+2],alpha=pixels[at+3],light=(r+g+b)/3,chroma=Math.max(r,g,b)-Math.min(r,g,b);
        if(alpha<80||light>255-sensitivity||(chroma<18&&light>160))continue;
        const score=(255-light)*alpha/255;
        if(score>bestScore){bestScore=score;best=at;}
      }
      if(best<0)continue;const pixel=best/4,px=pixel%width,py=Math.floor(pixel/width),v=voice===null?nearestVoice(pixels[best],pixels[best+1],pixels[best+2]):voice;
      codes.push(px|(py<<10)|(v<<19));
    }
  }
  signal?.throwIfAborted();progress('Sound map ready',1);return {samples:encodeSamples(codes),sampleWidth:width,sampleHeight:height,sampleCount:codes.length};
}
