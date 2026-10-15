// Nine original synthesized timbres; no copied sound engine or sample downloads.
const PATCHES = {
  keys:{type:'sine',partials:[[1,.8],[2,.19],[3,.07]],attack:.006,decay:.75,release:.18,level:.13},
  pluck:{type:'triangle',partials:[[1,.8],[2.003,.17]],attack:.003,decay:.24,release:.1,level:.12},
  bell:{type:'sine',partials:[[1,.65],[2.756,.23],[5.404,.08]],attack:.004,decay:.85,release:.4,level:.13},
  marimba:{type:'sine',partials:[[1,.8],[4,.22]],attack:.003,decay:.14,release:.08,level:.16},
  flute:{type:'sine',partials:[[1,.85],[2,.1]],attack:.055,decay:0,release:.12,level:.13,vibrato:2},
  strings:{type:'sawtooth',partials:[[.999,.42],[1.001,.42]],attack:.12,decay:0,release:.2,level:.085,filter:1800},
  chime:{type:'sine',partials:[[1,.7],[2.01,.2],[3.97,.1]],attack:.005,decay:1.1,release:.4,level:.12},
  bass:{type:'triangle',partials:[[1,.9],[2,.08]],attack:.015,decay:0,release:.08,level:.15,filter:700},
  '8bit':{type:'square',partials:[[1,1]],attack:.004,decay:0,release:.03,level:.055,filter:5000}
};
export function scheduleNote(ctx,destination,event,when,secondsPerBeat) {
  const p=PATCHES[event.voice]||PATCHES.keys,start=when+event.start*secondsPerBeat,duration=Math.max(.03,event.duration*secondsPerBeat);
  const end=start+duration,release=p.release,amp=ctx.createGain();
  amp.gain.setValueAtTime(.00001,start);
  const attack=Math.min(p.attack,duration*.35);
  amp.gain.exponentialRampToValueAtTime(p.level,start+Math.max(.002,attack));
  if(p.decay)amp.gain.exponentialRampToValueAtTime(Math.max(.0001,p.level*Math.exp(-duration/p.decay)),end);
  else amp.gain.setValueAtTime(p.level,end);
  amp.gain.exponentialRampToValueAtTime(.00001,end+release);
  if(p.filter){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=p.filter;f.Q.value=.5;amp.connect(f);f.connect(destination);}else amp.connect(destination);
  const nodes=[];const hz=440*2**((event.pitch-69)/12);
  for(const[ratio,level]of p.partials){
    if(hz*ratio>=ctx.sampleRate*.45)continue;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=p.type;o.frequency.value=hz*ratio;g.gain.value=level;o.connect(g);g.connect(amp);
    if(p.vibrato){const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=5.3;depth.gain.value=p.vibrato;lfo.connect(depth);depth.connect(o.frequency);lfo.start(start);lfo.stop(end+release);nodes.push(lfo);}
    o.start(start);o.stop(end+release+.01);nodes.push(o);
  }
  return nodes;
}
export function makeOutput(ctx,volume=.65) {
  const master=ctx.createGain(),compressor=ctx.createDynamicsCompressor();master.gain.value=volume;
  compressor.threshold.value=-18;compressor.knee.value=16;compressor.ratio.value=5;compressor.attack.value=.003;compressor.release.value=.18;
  master.connect(compressor);compressor.connect(ctx.destination);return master;
}
export class DrawingPlayer {
  constructor(onFrame,onFinish){this.onFrame=onFrame;this.onFinish=onFinish;this.ctx=null;this.nodes=[];this.frame=0;this.playing=false;this.volume=.65;}
  async ready(){if(!this.ctx)this.ctx=new AudioContext();await this.ctx.resume();if(this.ctx.state!=='running')throw Error('Tap Play again to allow audio in this browser.');if(!this.output)this.output=makeOutput(this.ctx,this.volume);}
  setVolume(v){this.volume=v;if(this.output)this.output.gain.setTargetAtTime(v,this.ctx.currentTime,.025);}
  async preview(pitch,voice){await this.ready();for(const n of this.previewNodes||[])try{n.stop();}catch{}this.previewNodes=scheduleNote(this.ctx,this.output,{pitch,voice,start:0,duration:.2},this.ctx.currentTime,.5);}
  stop(){this.playing=false;cancelAnimationFrame(this.frame);for(const n of [...this.nodes,...this.nextNodes||[],...this.tailNodes||[],...this.previewNodes||[]])try{n.stop();}catch{}this.nodes=[];this.nextNodes=null;this.tailNodes=[];this.previewNodes=[];this.onFrame?.(null);this.onFinish?.();}
  async play(events,settings,{loop=false}={}){
    this.stop();await this.ready();this.playing=true;this.events=events;this.settings=settings;this.loop=loop;
    this.seconds=settings.beats*60/settings.bpm;this.anchor=this.ctx.currentTime+.06;this.scheduleCycle(this.anchor);
    const tick=()=>{
      if(!this.playing)return;
      const elapsed=this.ctx.currentTime-this.anchor;
      if(elapsed>=this.seconds){
        if(!this.loop){this.playing=false;this.onFrame?.(1);this.frame=requestAnimationFrame(()=>this.onFinish?.());return;}
        this.anchor+=this.seconds;this.tailNodes=this.nodes;this.nodes=this.nextNodes||[];this.nextNodes=null;
      }
      const progress=Math.max(0,(this.ctx.currentTime-this.anchor)/this.seconds);this.onFrame?.(Math.min(1,progress));
      if(this.loop&&!this.nextNodes&&progress>.75)this.nextNodes=this.scheduleCycle(this.anchor+this.seconds,false);
      this.frame=requestAnimationFrame(tick);
    };
    this.frame=requestAnimationFrame(tick);
  }
  scheduleCycle(at,keep=true){const nodes=[];for(const e of this.events)nodes.push(...scheduleNote(this.ctx,this.output,e,at,60/this.settings.bpm));if(keep)this.nodes.push(...nodes);return nodes;}
}
export function encodeWav(channels,sampleRate){
  const frames=channels[0].length,count=channels.length,buffer=new ArrayBuffer(44+frames*count*2),v=new DataView(buffer);
  const word=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
  word(0,'RIFF');v.setUint32(4,36+frames*count*2,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,count,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*count*2,true);v.setUint16(32,count*2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,frames*count*2,true);
  for(let i=0,at=44;i<frames;i++)for(const ch of channels){const n=Math.max(-1,Math.min(1,ch[i]));v.setInt16(at,n<0?n*32768:n*32767,true);at+=2;}
  return buffer;
}
export async function renderWav(events,settings,volume=.65){
  const rate=44100,length=Math.ceil((settings.beats*60/settings.bpm+.5)*rate),ctx=new OfflineAudioContext(1,length,rate),out=makeOutput(ctx,volume);
  for(const e of events)scheduleNote(ctx,out,e,0,60/settings.bpm);
  const audio=await ctx.startRendering();return encodeWav([audio.getChannelData(0)],rate);
}
