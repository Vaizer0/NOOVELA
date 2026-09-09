'use strict';
let _mgBook=null,_mgChapters=[],_mgIdx=0,_mgPages=[],_mgPageIdx=0,_mgMode='webtoon';
async function openManga(book,chapterUrl,chapters){
  _mgBook=book;_mgChapters=chapters||[];
  _mgIdx=_mgChapters.findIndex(c=>c.url===chapterUrl);if(_mgIdx<0)_mgIdx=0;
  App.showScreen('manga');showLoading('Loading manga...');
  try{
    const cacheKey=chapterUrl+':mgpages';
    let pagesData=await DB.getChapterContent(cacheKey);
    if(!pagesData){const pages=await _mgFetchPages(chapterUrl,book);pagesData=JSON.stringify(pages);await DB.saveChapterContent(cacheKey,pagesData);}
    _mgPages=JSON.parse(pagesData)||[];_mgPageIdx=0;
    _mgMode=Settings.get('mangaDefaultMode')||'webtoon';
    _renderManga();_mgUpdateNav();
    const ch=_mgChapters[_mgIdx]||{};
    await DB.addHistory({bookId:book.id,bookTitle:book.title,chapterUrl,chapterTitle:ch.title||'',coverUrl:book.coverUrl||'',readAt:Date.now(),isManga:true});
  }catch(e){showToast('Manga load error: '+e.message,'error');}
  finally{hideLoading();}
}
async function _mgFetchPages(url,book){
  const plugin=book&&book.sourceId?Plugins.getPlugin(book.sourceId):null;
  if(plugin&&plugin.mod){const fn=plugin.mod.getMangaPages||plugin.mod.fetchMangaChapter||plugin.mod.fetchManga;if(fn){try{const r=await fn(url);return Array.isArray(r)?r:[];}catch(e){console.warn('Plugin manga:',e);}}}
  const dom=await Scraper.fetchDom(url);if(!dom)return[];
  return Array.from(dom.querySelectorAll('img')).map(i=>i.src||i.dataset.src||'').filter(u=>u&&u.length>10);
}
function _renderManga(){
  const container=document.getElementById('manga-content');if(!container)return;container.innerHTML='';
  if(_mgMode==='webtoon'){
    _mgPages.forEach((pageUrl,idx)=>{const wrap=document.createElement('div');wrap.className='manga-img-wrap';const img=document.createElement('img');img.className='manga-page';img.alt='Page '+(idx+1);img.dataset.src=pageUrl;img.onerror=function(){imgFallback(this);};wrap.appendChild(img);container.appendChild(wrap);});
    lazyLoad(container);
    const info=document.getElementById('manga-page-info');if(info)info.textContent=_mgPages.length+' pages';
  }else{_renderMangaPagerPage();}
}
function _renderMangaPagerPage(){
  const container=document.getElementById('manga-content');if(!container||!_mgPages.length)return;container.innerHTML='';
  const wrap=document.createElement('div');wrap.className='manga-img-wrap';
  const img=document.createElement('img');img.className='manga-page manga-page-single';img.alt='Page '+(_mgPageIdx+1);img.src=_mgPages[_mgPageIdx]||'';img.onerror=function(){imgFallback(this);};
  wrap.appendChild(img);container.appendChild(wrap);
  const info=document.getElementById('manga-page-info');if(info)info.textContent=(_mgPageIdx+1)+' / '+_mgPages.length;
}
function _mgUpdateNav(){const prev=document.getElementById('manga-prev-ch'),next=document.getElementById('manga-next-ch');if(prev)prev.disabled=(_mgIdx<=0);if(next)next.disabled=(_mgIdx>=_mgChapters.length-1);}
function mangaNextPage(){if(_mgMode!=='pager')return;if(_mgPageIdx<_mgPages.length-1){_mgPageIdx++;_renderMangaPagerPage();}else mangaNextChapter();}
function mangaPrevPage(){if(_mgMode!=='pager')return;if(_mgPageIdx>0){_mgPageIdx--;_renderMangaPagerPage();}else mangaPrevChapter();}
function mangaNextChapter(){const idx=_mgIdx+1;if(idx>=_mgChapters.length){showToast('No more chapters','info');return;}openManga(_mgBook,_mgChapters[idx].url,_mgChapters);}
function mangaPrevChapter(){const idx=_mgIdx-1;if(idx<0){showToast('No more chapters','info');return;}openManga(_mgBook,_mgChapters[idx].url,_mgChapters);}
function toggleMangaMode(){_mgMode=(_mgMode==='webtoon')?'pager':'webtoon';Settings.set('mangaDefaultMode',_mgMode);_renderManga();}
let _mgTouchX=0;
function mangaTouchStart(e){if(e.touches[0])_mgTouchX=e.touches[0].clientX;}
function mangaTouchEnd(e){if(_mgMode!=='pager')return;if(!e.changedTouches[0])return;const dx=e.changedTouches[0].clientX-_mgTouchX;if(Math.abs(dx)>50){if(dx<0)mangaNextPage();else mangaPrevPage();}}
window.Manga={openManga,mangaNextPage,mangaPrevPage,mangaNextChapter,mangaPrevChapter,toggleMangaMode,mangaTouchStart,mangaTouchEnd};
window.openManga=openManga;
