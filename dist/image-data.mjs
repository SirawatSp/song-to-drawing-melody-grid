export const MAX_IMAGE_BYTES=100000000;
export const MAX_IMAGE_DATA_CHARS=48000000;
export const MAX_PROJECT_IMAGE_CHARS=256000000;
export const MAX_PROJECT_FILE_BYTES=384000000;
export const MAX_SAMPLES=131072;
export const PROFILES={
  balanced:{width:2048,height:1024,analysisWidth:512,analysisHeight:256},
  detailed:{width:4096,height:2048,analysisWidth:1024,analysisHeight:512}
};
export function importPolicy(choice='auto',{memory=8,mobile=false}={}){
  const constrained=memory<=4||mobile;
  const profile=choice==='detailed'?'detailed':choice==='balanced'?'balanced':constrained?'balanced':'detailed';
  return {...PROFILES[profile],profile,maxSourcePixels:constrained?32000000:80000000};
}
export function fitImport(width,height,policy){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>32768||height>32768||width*height>policy.maxSourcePixels)
    throw Error(`This image exceeds this device’s ${policy.maxSourcePixels/1000000} megapixel decoding budget. Export a smaller raster from your drawing app first.`);
  const scale=Math.min(1,policy.width/width,policy.height/height),drawWidth=Math.max(1,Math.round(width*scale)),drawHeight=Math.max(1,Math.round(height*scale));
  const planeWidth=Math.min(policy.width,Math.ceil(Math.max(drawWidth,drawHeight*2)/2)*2),planeHeight=planeWidth/2;
  return {width:planeWidth,height:planeHeight,drawWidth,drawHeight,analysisWidth:Math.min(policy.analysisWidth,planeWidth),analysisHeight:Math.min(policy.analysisHeight,planeHeight)};
}
export function validBase64(text,maxLength){
  if(typeof text!=='string'||text.length>maxLength||text.length%4!==0)return false;
  for(let i=0;i<text.length;i+=65536)if(!/^[A-Za-z0-9+/=]*$/.test(text.slice(i,i+65536)))return false;
  return !/=/.test(text.slice(0,-2));
}
export function validImageURL(url){return typeof url==='string'&&url.startsWith('data:image/png;base64,')&&url.length<=MAX_IMAGE_DATA_CHARS&&validBase64(url.slice(22),MAX_IMAGE_DATA_CHARS);}
export function encodeSamples(codes){
  const bytes=new Uint8Array(codes.length*4),view=new DataView(bytes.buffer);codes.forEach((code,i)=>view.setUint32(i*4,code,true));
  let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);
}
const decoded=new WeakMap();
export function sampleCodes(image){
  if(decoded.has(image))return decoded.get(image);
  const binary=atob(image.samples);if(binary.length%4)throw Error('Invalid packed sound data.');const view=new DataView(new ArrayBuffer(binary.length));for(let i=0;i<binary.length;i++)view.setUint8(i,binary.charCodeAt(i));
  const codes=new Uint32Array(binary.length/4);for(let i=0;i<codes.length;i++)codes[i]=view.getUint32(i*4,true);decoded.set(image,codes);return codes;
}
export function validateSamples(image){
  if(!Number.isInteger(image.sampleWidth)||image.sampleWidth<1||image.sampleWidth>1024||!Number.isInteger(image.sampleHeight)||image.sampleHeight<1||image.sampleHeight>512||!validBase64(image.samples,Math.ceil(MAX_SAMPLES*4/3)*4))return false;
  let codes;try{codes=sampleCodes(image);}catch{return false;}if(codes.length>MAX_SAMPLES)return false;
  return codes.every(code=>(code>>>23)===0&&(code&1023)<image.sampleWidth&&((code>>>10)&511)<image.sampleHeight&&((code>>>19)&15)<9);
}
export const imageSampleCount=image=>image?.samples!==undefined?(image.samples.length*3/4-(image.samples.endsWith('==')?2:image.samples.endsWith('=')?1:0))/4:image?.points?.length||0;
export function imageDimensions(bytes){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),str=(at,n)=>String.fromCharCode(...bytes.subarray(at,at+n));
  if(bytes.length>=24&&str(1,3)==='PNG'&&bytes[0]===137)return {width:v.getUint32(16),height:v.getUint32(20),format:'PNG'};
  if(bytes.length>=30&&str(0,4)==='RIFF'&&str(8,4)==='WEBP'){
    const kind=str(12,4),u24=at=>bytes[at]|bytes[at+1]<<8|bytes[at+2]<<16;
    if(kind==='VP8X')return {width:1+u24(24),height:1+u24(27),format:'WebP'};
    if(kind==='VP8L'&&bytes[20]===47){const bits=v.getUint32(21,true);return {width:1+(bits&16383),height:1+((bits>>>14)&16383),format:'WebP'};}
    if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return {width:v.getUint16(26,true)&16383,height:v.getUint16(28,true)&16383,format:'WebP'};
  }
  if(bytes[0]===255&&bytes[1]===216){
    let i=2,orientation=1;
    while(i+4<=bytes.length){
      if(bytes[i++]!==255)break;while(bytes[i]===255)i++;const marker=bytes[i++];
      if(marker===217||marker===218)break;if(marker===216||marker>=208&&marker<=215)continue;
      const length=v.getUint16(i);if(length<2||i+length>bytes.length)break;
      if(marker===225&&str(i+2,6)==='Exif\0\0'){
        try{const t=i+8,little=str(t,2)==='II',offset=t+v.getUint32(t+4,little),count=v.getUint16(offset,little);for(let n=0;n<Math.min(count,128);n++){const entry=offset+2+n*12;if(v.getUint16(entry,little)===274){orientation=v.getUint16(entry+8,little);break;}}}catch{}
      }
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
        const width=v.getUint16(i+5),height=v.getUint16(i+3);return orientation>=5&&orientation<=8?{width:height,height:width,format:'JPEG'}:{width,height,format:'JPEG'};
      }i+=length;
    }
  }
  throw Error('The image header could not be read. Choose a valid PNG, JPEG or WebP, or re-export it without extra metadata.');
}
