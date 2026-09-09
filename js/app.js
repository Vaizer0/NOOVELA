'use strict';
const SCREENS=['library','finder','history','extensions','settings','reader','manga','bookinfo','search','migration'];
const App={
  currentScreen:'library',
  showScreen(name){
    SCREENS.forEach(id=>{const el=document.getElementById('screen-'+id);if(el)el.classList.toggle('active',id===name);});
    this.currentScreen=name;
    document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.screen===name));
    if(name==='history')renderHistory();
    // FIX: must call initExtensions (not renderExtensions) so the index is fetched on first open
    else if(name==='extensions')Ext.initExtensions();
    else if(name==='migration')Migration.initMigration();
    else if(name==='settings'&&Settings.renderSettings)Settings.renderSettings();
    else if(name==='finder')Catalog.openFinder();
  },
  navigate(path){window.location.hash='#'+path;},
};
async function boot(){
  try{
    await DB.open();
    await Settings.load();
    await Plugins.loadFromDB();
    i18n.setLanguage(Settings.get('language')||'en');
    await Library.initLibrary();
    Search.searchInit();
    if(Ext.extSearchInit)Ext.extSearchInit();
    const canvas=document.getElementById('bg-canvas');
    if(canvas&&typeof MiniGames!=='undefined')MiniGames.init(canvas);
  }catch(e){console.error('Boot error:',e);}
  window.addEventListener('hashchange',()=>_handleHash());
  document.querySelectorAll('.nav-item').forEach(item=>{
    item.addEventListener('click',()=>{const s=item.dataset.screen;if(s){App.showScreen(s);window.location.hash='#'+s;}});
  });
  document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>_handleAction(el.dataset.action,el)));
  document.querySelectorAll('[data-filter]').forEach(el=>el.addEventListener('click',()=>Library.libSetFilter&&Library.libSetFilter(el.dataset.filter)));
  document.querySelectorAll('[data-sort]').forEach(el=>el.addEventListener('click',()=>Library.libSetSort&&Library.libSetSort(el.dataset.sort)));
  const libSearch=document.getElementById('lib-search-inp');
  if(libSearch)libSearch.addEventListener('input',debounce(e=>Library.libSearch&&Library.libSearch(e.target.value),300));
  const finderSearch=document.getElementById('finder-search');
  if(finderSearch)finderSearch.addEventListener('input',debounce(e=>Catalog.finderSearch&&Catalog.finderSearch(e.target.value),400));
  window.addEventListener('error',e=>console.error('Unhandled error:',e.error));
  window.addEventListener('unhandledrejection',e=>console.error('Unhandled rejection:',e.reason));
  _handleHash();
  if(typeof Backup!=='undefined')Backup.scheduleAutoBackup();
}
function _handleHash(){
  const hash=window.location.hash.slice(1)||'library';
  const screen=hash.split('/')[0];
  App.showScreen(SCREENS.includes(screen)?screen:'library');
}
function _handleAction(action,el){
  const R=()=>typeof Reader!=='undefined'?Reader:{};
  const M=()=>typeof Manga!=='undefined'?Manga:{};
  const B=()=>typeof Backup!=='undefined'?Backup:{};
  switch(action){
    case 'tts-play':R().readerTTSPlay&&R().readerTTSPlay();break;
    case 'tts-pause':R().readerTTSPause&&R().readerTTSPause();break;
    case 'tts-stop':R().readerTTSStop&&R().readerTTSStop();break;
    case 'reader-prev':R().readerNavChapter&&R().readerNavChapter(-1);break;
    case 'reader-next':R().readerNavChapter&&R().readerNavChapter(1);break;
    case 'reader-translate':R().readerTranslate&&R().readerTranslate();break;
    case 'manga-next-page':M().mangaNextPage&&M().mangaNextPage();break;
    case 'manga-prev-page':M().mangaPrevPage&&M().mangaPrevPage();break;
    case 'manga-next-ch':M().mangaNextChapter&&M().mangaNextChapter();break;
    case 'manga-prev-ch':M().mangaPrevChapter&&M().mangaPrevChapter();break;
    case 'manga-toggle-mode':M().toggleMangaMode&&M().toggleMangaMode();break;
    case 'create-backup':B().createBackup&&B().createBackup();break;
    case 'restore-backup':B().triggerBackupRestore&&B().triggerBackupRestore();break;
    case 'import-epub':B().triggerEpubImport&&B().triggerEpubImport();break;
    case 'install-ext-url':Ext.installExtFromUrl&&Ext.installExtFromUrl();break;
    case 'browse-ext-index':Ext.browseExtIndex&&Ext.browseExtIndex();break;
    case 'open-migration':App.showScreen('migration');break;
    case 'lib-view-grid':Library.libSetView&&Library.libSetView('grid');break;
    case 'lib-view-list':Library.libSetView&&Library.libSetView('list');break;
    case 'go-back':window.history.back();break;
    case 'asteroid-mode':if(typeof MiniGames!=='undefined'){MiniGames.setMode('asteroid');const c=document.getElementById('bg-canvas');if(c)c.classList.add('interactive');}break;
    case 'stars-mode':if(typeof MiniGames!=='undefined'){MiniGames.setMode('stars');const c=document.getElementById('bg-canvas');if(c)c.classList.remove('interactive');}break;
    default:break;
  }
}
async function renderHistory(){
  const container=document.getElementById('history-list');if(!container)return;
  const items=await DB.getHistory(60);
  container.innerHTML='';
  if(!items.length){
    const e=document.createElement('div');e.className='empty-state';
    const p=document.createElement('p');p.textContent='No reading history yet.';e.appendChild(p);container.appendChild(e);return;
  }
  items.forEach(item=>{
    const div=document.createElement('div');div.className='history-item';
    const cov=document.createElement('div');cov.className='history-cover';
    if(item.coverUrl){const img=document.createElement('img');img.dataset.src=item.coverUrl;img.alt=item.bookTitle||'';img.onerror=function(){imgFallback(this);};cov.appendChild(img);}
    else{cov.textContent=(item.bookTitle||'?')[0].toUpperCase();cov.classList.add('book-cover-placeholder');}
    const info=document.createElement('div');info.className='history-info';
    const t=document.createElement('div');t.className='history-title';t.textContent=truncate(item.bookTitle||'',50);
    const ch=document.createElement('div');ch.className='history-chapter';ch.textContent=truncate(item.chapterTitle||'',60);
    const time=document.createElement('div');time.className='history-time';time.textContent=formatRelTime(item.readAt);
    info.appendChild(t);info.appendChild(ch);info.appendChild(time);div.appendChild(cov);div.appendChild(info);
    div.addEventListener('click',async()=>{
      const book=item.bookId?await DB.getBook(item.bookId).catch(()=>null):null;
      if(book){const chs=await DB.getBookChapters(book.id)||[];openReader(book,item.chapterUrl,chs);}
    });
    container.appendChild(div);
  });
  lazyLoad(container);
}
Settings.renderSettings=function(){
  const c=document.getElementById('settings-content');if(!c)return;c.innerHTML='';
  const sections=[
    {title:'Appearance',items:[{label:'Theme',key:'theme',type:'select',opts:[['default','Default'],['dark','Dark'],['light','Light'],['material-you','Material You'],['green-apple','Green Apple'],['lavender','Lavender'],['midnight-dusk','Midnight Dusk'],['strawberry','Strawberry'],['tako','Tako'],['teal','Teal'],['monochrome','Mono'],['catppuccin','Catppuccin'],['nord','Nord'],['matrix','Matrix'],['mocha','Mocha'],['sapphire','Sapphire'],['doom','Doom'],['tachiyomi','Tachiyomi'],['yin-yang','Yin-Yang']]},{label:'Language',key:'language',type:'select',opts:[['en','English'],['ru','Russian'],['zh','Chinese'],['ja','Japanese'],['ko','Korean'],['ar','Arabic'],['de','German'],['fr','French'],['es','Spanish'],['pt','Portuguese'],['hi','Hindi'],['th','Thai']]},{label:'Library Columns',key:'gridColumns',type:'select',opts:[['2','2'],['3','3'],['4','4'],['5','5']]},]},
    {title:'Reader',items:[{label:'Font Size',key:'fontSize',type:'range',min:12,max:28,step:1},{label:'Line Height',key:'lineHeight',type:'range',min:1.2,max:3,step:0.1},{label:'Paragraph Spacing',key:'paragraphSpacing',type:'range',min:0,max:40,step:2},{label:'Font Family',key:'fontFamily',type:'select',opts:[['Georgia,serif','Georgia'],['serif','Serif'],['sans-serif','Sans Serif'],['monospace','Monospace']]},{label:'Text Align',key:'textAlign',type:'select',opts:[['left','Left'],['justify','Justify'],['center','Center']]},]},
    {title:'TTS',items:[{label:'Speed',key:'ttsSpeed',type:'range',min:0.5,max:3,step:0.1},{label:'Pitch',key:'ttsPitch',type:'range',min:0.5,max:2,step:0.1},{label:'Auto Scroll',key:'ttsAutoScroll',type:'toggle'},]},
    {title:'Translation',items:[{label:'Provider',key:'translateProvider',type:'select',opts:[['google_simple','Google (Free)'],['gemini','Gemini'],['openai','OpenAI']]},{label:'Target Language',key:'translateTargetLang',type:'select',opts:[['en','English'],['ru','Russian'],['zh','Chinese'],['ja','Japanese'],['ko','Korean'],['de','German'],['fr','French'],['es','Spanish'],['ar','Arabic'],['hi','Hindi']]},{label:'API Key',key:'translateApiKey',type:'text',ph:'For Gemini or OpenAI'},{label:'Endpoint',key:'translateApiEndpoint',type:'text',ph:'Custom endpoint'},{label:'Model',key:'translateModelName',type:'text',ph:'gemini-pro / gpt-3.5-turbo'},]},
    {title:'Backup',items:[{label:'Auto Backup',key:'autoBackupEnabled',type:'toggle'},{label:'Create Backup',type:'action',action:'create-backup'},{label:'Restore Backup',type:'action',action:'restore-backup'},{label:'Import EPUB/FB2',type:'action',action:'import-epub'},]},
    {title:'Advanced',items:[{label:'Manga Default',key:'mangaDefaultMode',type:'select',opts:[['webtoon','Webtoon'],['pager','Pager']]},{label:'Mini-game: Asteroids',type:'action',action:'asteroid-mode'},{label:'Mini-game: Stars',type:'action',action:'stars-mode'},{label:'Migration',type:'action',action:'open-migration'},]},
  ];
  sections.forEach(sec=>{
    const secDiv=document.createElement('div');secDiv.className='settings-section';
    const title=document.createElement('div');title.className='settings-section-title';title.textContent=sec.title;
    secDiv.appendChild(title);
    sec.items.forEach(item=>{
      const row=document.createElement('div');row.className='settings-item';
      if(item.type==='action'){const btn=document.createElement('button');btn.className='btn btn-ghost btn-sm';btn.textContent=item.label;btn.addEventListener('click',()=>_handleAction(item.action,btn));row.appendChild(btn);secDiv.appendChild(row);return;}
      const lbl=document.createElement('div');const lt=document.createElement('div');lt.className='settings-label';lt.textContent=item.label;lbl.appendChild(lt);row.appendChild(lbl);
      if(item.type==='select'){const sel=document.createElement('select');sel.className='select';(item.opts||[]).forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;if(String(Settings.get(item.key))===v)o.selected=true;sel.appendChild(o);});sel.addEventListener('change',()=>{Settings.set(item.key,sel.value);Settings.apply();if(item.key==='language')i18n.setLanguage(sel.value);});row.appendChild(sel);}
      else if(item.type==='range'){const wrap=document.createElement('div');wrap.style.cssText='display:flex;align-items:center;gap:6px;';const inp=document.createElement('input');inp.type='range';inp.min=String(item.min);inp.max=String(item.max);inp.step=String(item.step);inp.value=String(Settings.get(item.key)||item.min);const val=document.createElement('span');val.textContent=inp.value;val.style.cssText='font-size:12px;color:var(--text2);min-width:30px;';inp.addEventListener('input',()=>{val.textContent=inp.value;Settings.set(item.key,Number(inp.value));Settings.apply();});wrap.appendChild(inp);wrap.appendChild(val);row.appendChild(wrap);}
      else if(item.type==='toggle'){const tog=document.createElement('div');tog.className='toggle'+(Settings.get(item.key)?' on':'');tog.addEventListener('click',()=>{const v=!Settings.get(item.key);Settings.set(item.key,v);tog.classList.toggle('on',v);Settings.apply();});row.appendChild(tog);}
      else if(item.type==='text'){const inp=document.createElement('input');inp.type='text';inp.value=Settings.get(item.key)||'';inp.placeholder=item.ph||'';inp.addEventListener('change',()=>Settings.set(item.key,inp.value));row.appendChild(inp);}
      secDiv.appendChild(row);
    });
    c.appendChild(secDiv);
  });
};
document.addEventListener('DOMContentLoaded',()=>boot());
window.App=App;window.renderHistory=renderHistory;
