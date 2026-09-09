'use strict';
// Catalog: Book Info screen + Finder/Browse screen
let _biBook=null,_biSourceId=null;
async function openBookInfo(bookId,bookData,sourceId){
  App.showScreen('bookinfo');
  _biSourceId=sourceId;
  showLoading('Loading...');
  try{
    let book=bookData;
    if(!book&&bookId)book=await DB.getBook(bookId);
    if(!book){showToast('Book not found','error');hideLoading();return;}
    _biBook=book;
    _renderBookInfo(book);
    // Fetch chapters from plugin if not cached
    let chapters=await DB.getChapters(book.id||'').catch(()=>[]);
    if(!chapters.length&&sourceId){
      const plugin=Plugins.getPlugin(sourceId);
      if(plugin&&plugin.mod&&plugin.mod.getBookInfo){
        try{
          const info=await plugin.mod.getBookInfo(book.url||book.id||'');
          if(info){Object.assign(book,info);_renderBookInfo(book);}
          if(info&&info.chapters)chapters=info.chapters;
        }catch(e){console.warn('getBookInfo:',e);}
      }
    }
    if(!chapters.length&&book.chapters)chapters=book.chapters;
    _renderChapters(book,chapters,sourceId);
    // Add/remove library button
    const addBtn=document.getElementById('bi-add-btn');
    if(addBtn){
      const inLib=book.id?!!(await DB.getBook(book.id).catch(()=>null)):false;
      addBtn.textContent=inLib?'Remove from Library':'Add to Library';
      addBtn.onclick=async()=>{
        if(inLib){
          if(book.id)await DB.deleteBook(book.id);
          addBtn.textContent='Add to Library';
          showToast('Removed from library','info');
        }else{
          const saved=await DB.saveBook(Object.assign({},book,{addedAt:Date.now(),updatedAt:Date.now(),sourceId:sourceId||book.sourceId}));
          _biBook=saved;
          if(chapters.length)await DB.saveChapters(saved.id,chapters);
          addBtn.textContent='Remove from Library';
          showToast('Added to library','success');
        }
        await Library.refreshLibrary();
      };
    }
  }catch(e){showToast('Error: '+e.message,'error');}
  finally{hideLoading();}
}
function _renderBookInfo(book){
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val||'';};
  const cover=document.getElementById('bi-cover');
  if(cover){cover.src=book.coverUrl||book.thumbnail||'';cover.onerror=function(){imgFallback(this);};}
  set('bi-title',book.title);
  set('bi-author',book.author);
  set('bi-status',book.status);
  set('bi-genres',Array.isArray(book.genres)?book.genres.join(', '):(book.genres||''));
  set('bi-desc',book.description||book.desc||book.synopsis||'');
}
function _renderChapters(book,chapters,sourceId){
  const container=document.getElementById('bi-chapters');if(!container)return;
  container.innerHTML='';
  if(!chapters||!chapters.length){
    const p=document.createElement('p');p.style.cssText='color:var(--text2);padding:12px;';p.textContent='No chapters found.';
    container.appendChild(p);return;
  }
  chapters.forEach((ch,idx)=>{
    const div=document.createElement('div');div.className='chapter-item'+(ch.read?' read':'');
    div.textContent=ch.title||('Chapter '+(idx+1));
    div.addEventListener('click',async()=>{
      // Ensure book is saved to library before opening reader
      let bookRef=_biBook||book;
      if(bookRef&&!await DB.getBook(bookRef.id||'').catch(()=>null)){
        bookRef=await DB.saveBook(Object.assign({},bookRef,{addedAt:Date.now(),updatedAt:Date.now(),sourceId:sourceId||bookRef.sourceId}));
        await DB.saveChapters(bookRef.id,chapters);
      }
      const allCh=await DB.getChapters(bookRef.id||'').catch(()=>[]);
      const useChapters=allCh.length?allCh:chapters;
      const isManga=bookRef.type==='manga';
      if(isManga)Manga.openManga(bookRef,ch.url,useChapters);
      else Reader.openReader(bookRef,ch.url,useChapters);
    });
    container.appendChild(div);
  });
}
// Finder screen
let _finderPlugin=null;
function openFinder(){
  const sourcesEl=document.getElementById('finder-sources');
  const resultsEl=document.getElementById('finder-results');
  if(!sourcesEl)return;
  sourcesEl.innerHTML='';if(resultsEl)resultsEl.innerHTML='';
  sourcesEl.style.display='';
  const plugins=Plugins.getAll();
  if(!plugins.length){
    const p=document.createElement('div');p.className='empty-state';
    const t=document.createElement('p');t.textContent='No extensions installed. Go to Extensions to add one.';
    p.appendChild(t);sourcesEl.appendChild(p);return;
  }
  plugins.forEach(ext=>{
    const card=document.createElement('div');card.className='source-card';
    const name=document.createElement('div');name.className='source-name';name.textContent=ext.name;
    const meta=document.createElement('div');meta.className='source-meta';meta.textContent=(ext.lang||'')+(ext.version?' v'+ext.version:'');
    card.appendChild(name);card.appendChild(meta);
    card.addEventListener('click',()=>{
      _finderPlugin=ext;
      const title=document.getElementById('finder-title');if(title)title.textContent=ext.name;
      sourcesEl.style.display='none';
      _loadFinderPopular();
    });
    sourcesEl.appendChild(card);
  });
}
async function _loadFinderPopular(){
  const resultsEl=document.getElementById('finder-results');if(!resultsEl||!_finderPlugin)return;
  resultsEl.innerHTML='<div class="loading-state">Loading...</div>';
  try{
    const plugin=_finderPlugin;let results=[];
    if(plugin.mod&&plugin.mod.fetchPopular)results=await plugin.mod.fetchPopular(1);
    else if(plugin.mod&&plugin.mod.fetchLatest)results=await plugin.mod.fetchLatest(1);
    _renderFinderResults(Array.isArray(results)?results:[]);
  }catch(e){if(resultsEl)resultsEl.innerHTML='<div class="error-state">Error: '+e.message+'</div>';}
}
async function finderSearch(query){
  if(!_finderPlugin){openFinder();return;}
  const resultsEl=document.getElementById('finder-results');if(!resultsEl)return;
  if(!query){_loadFinderPopular();return;}
  resultsEl.innerHTML='<div class="loading-state">Searching...</div>';
  try{
    let results=[];
    if(_finderPlugin.mod&&_finderPlugin.mod.search)results=await _finderPlugin.mod.search(query);
    _renderFinderResults(Array.isArray(results)?results:[]);
  }catch(e){resultsEl.innerHTML='<div class="error-state">Error: '+e.message+'</div>';}
}
function _renderFinderResults(results){
  const container=document.getElementById('finder-results');if(!container)return;container.innerHTML='';
  if(!results.length){
    const e=document.createElement('div');e.className='empty-state';
    const p=document.createElement('p');p.textContent='No results found.';e.appendChild(p);container.appendChild(e);return;
  }
  results.forEach(book=>{
    const div=document.createElement('div');div.className='search-result-item';
    if(book.coverUrl||book.thumbnail){const img=document.createElement('img');img.className='search-result-cover';img.dataset.src=book.coverUrl||book.thumbnail;img.alt=book.title||'';img.onerror=function(){imgFallback(this);};div.appendChild(img);}
    const info=document.createElement('div');info.className='search-result-info';
    const t=document.createElement('div');t.className='search-result-title';t.textContent=truncate(book.title||'',60);
    const a=document.createElement('div');a.className='book-author';a.textContent=truncate(book.author||'',50);
    info.appendChild(t);info.appendChild(a);div.appendChild(info);
    div.addEventListener('click',()=>openBookInfo(null,book,_finderPlugin?_finderPlugin.id:null));
    container.appendChild(div);
  });
  lazyLoad(container);
}
// Long-press helper (for library card selection)
function longPressInit(el,callback,delay){
  delay=delay||600;let timer=null;
  el.addEventListener('touchstart',e=>{timer=setTimeout(()=>{callback(e);timer=null;},delay);},{passive:true});
  el.addEventListener('touchend',()=>{if(timer){clearTimeout(timer);timer=null;}});
  el.addEventListener('touchmove',()=>{if(timer){clearTimeout(timer);timer=null;}},{passive:true});
  el.addEventListener('contextmenu',e=>{e.preventDefault();callback(e);});
}
window.longPressInit=longPressInit;
window.Catalog={openBookInfo,openFinder,finderSearch};
window.openBookInfo=function(bookId,bookData,sourceId){return openBookInfo(bookId,bookData,sourceId);};
