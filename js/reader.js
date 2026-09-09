'use strict';
let _rdrBook=null,_rdrChapters=[],_rdrIdx=0;
async function openReader(book,chapterUrl,chapters){
  _rdrBook=book;_rdrChapters=chapters||[];
  _rdrIdx=_rdrChapters.findIndex(c=>c.url===chapterUrl);
  if(_rdrIdx<0)_rdrIdx=0;
  TTS.stop();
  App.showScreen('reader');showLoading('Loading...');
  try{
    let content=await DB.getChapterContent(chapterUrl);
    if(!content){content=await _rdrFetch(chapterUrl,book);if(content)await DB.saveChapterContent(chapterUrl,content);}
    content=content||'(No content available)';
    const ch=_rdrChapters[_rdrIdx]||{};
    await DB.addHistory({bookId:book.id,bookTitle:book.title,chapterUrl,chapterTitle:ch.title||'',coverUrl:book.coverUrl||'',readAt:Date.now()});
    const prog=(await DB.getProgress(book.id))||{};
    prog.lastChapterUrl=chapterUrl;prog.lastReadAt=Date.now();
    await DB.saveProgress(book.id,prog);
    _renderReaderContent(content);
    _rdrUpdateNav();_rdrUpdateTitle();_applyReaderSettings();
  }catch(e){showToast('Load error: '+e.message,'error');}
  finally{hideLoading();}
}
async function _rdrFetch(url,book){
  const plugin=book&&book.sourceId?Plugins.getPlugin(book.sourceId):null;
  if(plugin&&plugin.mod&&plugin.mod.fetchChapter){try{return await plugin.mod.fetchChapter(url);}catch(e){console.warn('Plugin fetchChapter failed:',e);}}
  const dom=await Scraper.fetchDom(url);
  return dom?Scraper.extractText(dom):'';
}
function _renderReaderContent(text){
  const container=document.getElementById('reader-content');
  if(!container)return;
  container.innerHTML='';
  const rules=(typeof Settings!=='undefined'?Settings.get('regexRules'):null)||[];
  for(const rule of rules){try{text=text.replace(new RegExp(rule.regex,rule.flags||'g'),rule.replacement);}catch(_){}}
  const paras=text.split('\n\n').filter(p=>p.trim());
  if(!paras.length)paras.push(text.trim());
  paras.forEach(p=>{const div=document.createElement('div');div.className='reader-para';div.textContent=p.trim();container.appendChild(div);});
  TTS.prepareContainer(container);
}
function _applyReaderSettings(){
  const rs=document.getElementById('screen-reader');if(!rs)return;
  rs.style.setProperty('--rd-size',(Settings.get('fontSize')||16)+'px');
  rs.style.setProperty('--rd-font',Settings.get('fontFamily')||'Georgia,serif');
  rs.style.setProperty('--rd-lh',String(Settings.get('lineHeight')||1.8));
  rs.style.setProperty('--rd-ps',(Settings.get('paragraphSpacing')||12)+'px');
  rs.style.setProperty('--rd-ta',Settings.get('textAlign')||'left');
  const bg=Settings.get('readerBg');if(bg&&bg!=='default')rs.style.setProperty('--reader-bg',bg);
}
function _rdrUpdateNav(){
  const prev=document.getElementById('reader-prev-btn'),next=document.getElementById('reader-next-btn');
  if(prev)prev.disabled=(_rdrIdx<=0);if(next)next.disabled=(_rdrIdx>=_rdrChapters.length-1);
}
function _rdrUpdateTitle(){
  const el=document.getElementById('reader-chapter-title'),ch=_rdrChapters[_rdrIdx];
  if(el)el.textContent=ch?ch.title:(_rdrBook?_rdrBook.title:'');
}
function readerNavChapter(dir){
  const idx=_rdrIdx+dir;
  if(idx<0||idx>=_rdrChapters.length){showToast('No more chapters','info');return;}
  openReader(_rdrBook,_rdrChapters[idx].url,_rdrChapters);
}
async function readerTranslate(){
  const container=document.getElementById('reader-content');if(!container)return;
  const paras=Array.from(container.querySelectorAll('.reader-para'));if(!paras.length)return;
  showLoading('Translating...');
  try{
    const texts=paras.map(p=>p.textContent||'');
    const translated=await Translation.translateBatch(texts);
    const mode=Settings.get('translateDisplayMode')||'replace';
    if(mode==='replace'){paras.forEach((p,i)=>{p.textContent=translated[i]||p.textContent;});}
    else{paras.forEach((p,i)=>{const tr=document.createElement('div');tr.className='reader-para-trans';tr.textContent=translated[i]||'';p.insertAdjacentElement('afterend',tr);});}
    TTS.prepareContainer(container);
  }catch(e){showToast('Translation error: '+e.message,'error');}
  finally{hideLoading();}
}
function readerTTSPlay(){if(TTS.isPaused){TTS.resume();_updateTTSUI(true);return;}const container=document.getElementById('reader-content');if(!container)return;TTS.speed=Number(Settings.get('ttsSpeed'))||1;TTS.pitch=Number(Settings.get('ttsPitch'))||1;TTS.onend=()=>_updateTTSUI(false);TTS.onplay=()=>_updateTTSUI(true);TTS.onpause=()=>_updateTTSUI(false);TTS.speak(container,0);_updateTTSUI(true);}
function readerTTSPause(){if(TTS.isPlaying)TTS.pause();else if(TTS.isPaused)TTS.resume();}
function readerTTSStop(){TTS.stop();_updateTTSUI(false);}
function _updateTTSUI(playing){const playBtn=document.getElementById('tts-play-btn'),pauseBtn=document.getElementById('tts-pause-btn');if(playBtn)playBtn.style.display=playing?'none':'';if(pauseBtn)pauseBtn.style.display=playing?'':'none';}
window.Reader={openReader,readerNavChapter,readerTranslate,readerTTSPlay,readerTTSPause,readerTTSStop};
window.openReader=openReader;
