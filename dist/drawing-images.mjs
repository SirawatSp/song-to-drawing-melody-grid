// Keep at most the current and next decoded plan. Thumbnails never use these
// full-resolution images, and a whole sequence is never decoded up front.
export class SectionImageCache{
  constructor(sections,makeImage=()=>new Image()){this.sections=sections;this.makeImage=makeImage;this.entries=new Map();this.disposed=false;}
  async prepare(index){
    if(this.disposed)return null;
    if(this.entries.has(index))return this.entries.get(index).promise;
    const entry={ready:false,image:null,error:null};this.entries.set(index,entry);
    const drawing=this.sections[index];
    if(!drawing?.image){entry.ready=true;entry.promise=Promise.resolve(null);return entry.promise;}
    const image=this.makeImage();entry.image=image;image.src=drawing.image.dataURL;
    entry.promise=image.decode().then(()=>{if(this.disposed||this.entries.get(index)!==entry){image.src='';return null;}entry.ready=true;return image;}).catch(e=>{entry.error=e;throw e;});
    return entry.promise;
  }
  async start(){try{await Promise.all([this.prepare(0),this.prepare(this.sections.length>1?1:0)]);return this;}catch(e){this.dispose();throw e;}}
  get(index){
    const entry=this.entries.get(index);
    if(!entry?.ready||entry.error)throw Error('The next plan was not ready in time. Use Balanced image quality or a slower tempo and try again.');
    return entry.image;
  }
  step(index){
    const image=this.get(index),next=(index+1)%this.sections.length;
    for(const [i,entry]of this.entries)if(i!==index&&i!==next){this.entries.delete(i);if(entry.image)entry.image.src='';}
    this.prepare(next).catch(()=>{});return image;
  }
  dispose(){this.disposed=true;for(const entry of this.entries.values())if(entry.image)entry.image.src='';this.entries.clear();}
}
export const createSectionImageCache=sections=>new SectionImageCache(sections).start();
