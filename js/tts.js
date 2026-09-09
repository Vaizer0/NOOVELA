// NoveLA Web - TTS Engine with accurate boundary-event word highlighting
'use strict';
class TTSEngine{
  constructor(){
    this.synth=window.speechSynthesis;
    this.utterance=null;this.isPlaying=false;this.isPaused=false;
    this.paragraphs=[];this.currentParaIndex=0;
    this.speed=1.0;this.pitch=1.0;this.voiceId='';
    this.highlightEnabled=true;this.highlightColor='#FF6D00';
    this._listeners={};this._voices=[];this._voicesLoaded=false;
    this._timer=null;this._timerStart=null;this._timerTotal=0;
    this._loadVoices();
  }
  _loadVoices(){
    const load=()=>{this._voices=this.synth.getVoices();this._voicesLoaded=true;this._emit('voices',this._voices);};
    if(this.synth.getVoices().length>0)load();
    else this.synth.addEventListener('voiceschanged',load);
  }
  getVoices(){return this._voices;}
  getVoiceByLang(lang){return this._voices.filter(v=>v.lang.startsWith(lang));}
  loadFromElements(paragraphEls){
    this.paragraphs=Array.from(paragraphEls).map(el=>({element:el,text:el.textContent.trim(),origHTML:el.innerHTML})).filter(p=>p.text);
    this.currentParaIndex=0;
  }
  loadFromText(paragraphs){
    this.paragraphs=paragraphs.filter(t=>t&&t.trim()).map(text=>({element:null,text:text.trim()}));
    this.currentParaIndex=0;
  }
  // Called by reader.js to wire up DOM paragraphs
  prepareContainer(container){
    const paras=Array.from(container.querySelectorAll('.reader-para'));
    this.loadFromElements(paras);
  }
  start(fromIndex){
    fromIndex=fromIndex||0;
    if(this.isPlaying)this.stop();
    this.currentParaIndex=fromIndex;
    this.isPlaying=true;this.isPaused=false;
    this._startTimer();this._speakNext();
    this._emit('start',{index:fromIndex});
  }
  _speakNext(){
    if(!this.isPlaying||this.isPaused)return;
    if(this.currentParaIndex>=this.paragraphs.length){this.stop();this._emit('finished');return;}
    this._speakParagraph(this.paragraphs[this.currentParaIndex]);
  }
  _speakParagraph(para){
    const utt=new SpeechSynthesisUtterance(para.text);
    this.utterance=utt;
    utt.rate=this.speed;utt.pitch=this.pitch;
    if(this.voiceId){const v=this._voices.find(v=>v.voiceURI===this.voiceId||v.name===this.voiceId);if(v)utt.voice=v;}
    // Accurate word highlighting via boundary events
    utt.addEventListener('boundary',e=>{
      if(e.name==='word'){
        const ci=e.charIndex,cl=e.charLength||1;
        this._emit('boundary',{word:para.text.slice(ci,ci+cl),charIndex:ci,charLength:cl,paraIndex:this.currentParaIndex,paraElement:para.element});
        if(this.highlightEnabled&&para.element)this._highlightWord(para.element,para.text,ci,cl);
      }
    });
    utt.addEventListener('end',()=>{
      if(para.element)this._clearHighlight(para.element,para.text);
      this.currentParaIndex++;
      if(this.isPlaying&&!this.isPaused){
        const next=this.paragraphs[this.currentParaIndex];
        if(next&&next.element)next.element.scrollIntoView({behavior:'smooth',block:'center'});
        this._speakNext();
      }
      this._emit('paraEnd',{index:this.currentParaIndex-1});
    });
    utt.addEventListener('error',e=>{
      console.error('TTS error:',e.error);
      this._emit('error',e.error);
      if(e.error!=='interrupted'){this.currentParaIndex++;this._speakNext();}
    });
    if(para.element){
      this.paragraphs.forEach((p,i)=>{if(p.element)p.element.classList.toggle('tts-active-para',i===this.currentParaIndex);});
    }
    this._emit('paraStart',{index:this.currentParaIndex,text:para.text,element:para.element});
    this.synth.speak(utt);
  }
  _esc(str){return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  _highlightWord(el,text,ci,cl){
    el.innerHTML=this._esc(text.slice(0,ci))+'<mark class="tts-word-highlight" style="background:'+this.highlightColor+';color:#000;border-radius:3px;">'+this._esc(text.slice(ci,ci+cl))+'</mark>'+this._esc(text.slice(ci+cl));
  }
  _clearHighlight(el,text){el.textContent=text;el.classList.remove('tts-active-para');}
  pause(){if(!this.isPlaying||this.isPaused)return;this.synth.pause();this.isPaused=true;this._stopTimer();this._emit('pause');}
  resume(){if(!this.isPlaying||!this.isPaused)return;this.synth.resume();this.isPaused=false;this._startTimer();this._emit('resume');}
  stop(){
    this.synth.cancel();this.isPlaying=false;this.isPaused=false;this._stopTimer();
    this.paragraphs.forEach(p=>{if(p.element){p.element.classList.remove('tts-active-para');if(p.text)p.element.textContent=p.text;}});
    this._emit('stop');
  }
  setSpeed(rate){this.speed=Math.max(0.1,Math.min(10,rate));if(this.isPlaying){const i=this.currentParaIndex;this.stop();this.start(i);}}
  setPitch(pitch){this.pitch=Math.max(0,Math.min(2,pitch));if(this.isPlaying){const i=this.currentParaIndex;this.stop();this.start(i);}}
  setVoice(id){this.voiceId=id;if(this.isPlaying){const i=this.currentParaIndex;this.stop();this.start(i);}}
  setRate(r){this.setSpeed(r);}
  setHighlight(enabled,color){this.highlightEnabled=enabled;if(color)this.highlightColor=color;}
  skipForward(){const n=Math.min(this.currentParaIndex+1,this.paragraphs.length-1);this.stop();this.start(n);}
  skipBackward(){const p=Math.max(this.currentParaIndex-1,0);this.stop();this.start(p);}
  // Backwards-compat speak() method used by reader.js
  speak(container,fromIndex){
    fromIndex=fromIndex||0;
    if(container){
      const paras=Array.from(container.querySelectorAll('.reader-para'));
      this.loadFromElements(paras);
    }
    this.start(fromIndex);
  }
  _startTimer(){this._timerStart=Date.now();this._timer=setInterval(()=>this._emit('timer',{elapsed:this._timerTotal+(Date.now()-this._timerStart)}),1000);}
  _stopTimer(){if(this._timerStart){this._timerTotal+=Date.now()-this._timerStart;this._timerStart=null;}if(this._timer){clearInterval(this._timer);this._timer=null;}}
  getReadingTime(){return this._timerTotal;}
  on(event,fn){if(!this._listeners[event])this._listeners[event]=[];this._listeners[event].push(fn);return()=>{this._listeners[event]=this._listeners[event].filter(f=>f!==fn);};}
  _emit(event,data){(this._listeners[event]||[]).forEach(fn=>fn(data));}
  savePreset(name,preset){const p=JSON.parse(localStorage.getItem('tts_presets')||'[]');const i=p.findIndex(x=>x.name===name);if(i>=0)p[i]={name,...preset};else p.push({name,...preset});localStorage.setItem('tts_presets',JSON.stringify(p));}
  getPresets(){return JSON.parse(localStorage.getItem('tts_presets')||'[]');}
}
const TTS=new TTSEngine();
window.TTS=TTS;window.ttsEngine=TTS;
