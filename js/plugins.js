'use strict';
// ─── Constants ───────────────────────────────────────────────────────────────
const LNREADER_INDEX_URL='https://raw.githubusercontent.com/Vaizer0/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json';
const EXT_INDEX_URL='https://raw.githubusercontent.com/HnDK0/external-sources/refs/heads/main/index.yaml';
const CORS_PROXIES=[
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?url=',
  'https://api.codetabs.com/v1/proxy/?quest=',
  'https://thingproxy.freeboard.io/fetch/',
];

// ─── CORS-aware fetch (returns real Response interface) ───────────────────────
async function _proxyFetchApi(url,init){
  init=init||{};
  const method=init.method||'GET';
  const body=init.body;
  // Try direct first then each proxy
  for(let i=-1;i<CORS_PROXIES.length;i++){
    const target=i<0?url:(CORS_PROXIES[i]+encodeURIComponent(url));
    try{
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),20000);
      const r=await fetch(target,{method,body,signal:ctrl.signal});
      clearTimeout(timer);
      if(r.ok){
        if(i<0)return r; // direct — real Response
        const text=await r.text();
        return new Response(text,{status:200,statusText:'OK',headers:{'content-type':r.headers.get('content-type')||'text/html; charset=utf-8'}});
      }
    }catch(e){
      if(i===CORS_PROXIES.length-1)throw new Error('All fetch attempts failed for: '+url+' ('+e.message+')');
    }
  }
  throw new Error('All fetch attempts failed for: '+url);
}
async function _proxyFetchText(url,init,encoding){
  const r=await _proxyFetchApi(url,init);
  if(encoding){
    const blob=await r.blob();
    return new Promise((res,rej)=>{const fr=new FileReader();fr.onloadend=()=>res(fr.result);fr.onerror=()=>rej();fr.readAsText(blob,encoding);});
  }
  return r.text();
}
const _fetchProto=async()=>({});

// ─── htmlparser2 shim (lnreader uses: new Parser(handlers); p.write(html); p.end()) ─
class _Parser{
  constructor(handlers){this.handlers=handlers;this.buf='';}
  write(html){this.buf+=String(html||'');return this;}
  end(){
    let doc;
    try{doc=new DOMParser().parseFromString(this.buf,'text/html');}catch(e){if(this.handlers.onend)this.handlers.onend();return this;}
    this._walk(doc.documentElement);
    if(this.handlers.onend)this.handlers.onend();
    this.buf='';
    return this;
  }
  _walk(node){
    if(!node)return;
    if(node.nodeType===1){
      const attrs={};
      try{for(const a of node.attributes)attrs[a.name]=a.value;}catch(e){}
      if(this.handlers.onopentag)this.handlers.onopentag(node.tagName.toLowerCase(),attrs);
      for(const c of Array.from(node.childNodes))this._walk(c);
      if(this.handlers.onclosetag)this.handlers.onclosetag(node.tagName.toLowerCase());
    }else if(node.nodeType===3){
      if(this.handlers.ontext&&node.nodeValue)this.handlers.ontext(node.nodeValue);
    }
  }
  isVoidElement(tag){return['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(String(tag).toLowerCase());}
  reset(){this.buf='';}
}
const _htmlparser2={Parser:_Parser};

// ─── cheerio shim (lnreader uses: const $=load(html); $('sel').text() etc.) ──
function _cheerioLoad(html){
  const doc=new DOMParser().parseFromString(String(html||''),'text/html');
  function _wrap(nodes){
    const arr=Array.isArray(nodes)?nodes:(nodes&&nodes.nodeType?[nodes]:[]);
    const $obj={
      _nodes:arr,length:arr.length,
      text(){return arr.map(n=>(n.textContent||'')).join('').trim();},
      html(){return arr.length?(arr[0].innerHTML||''):'';},
      attr(n,v){
        if(v!==undefined){arr.forEach(el=>el.setAttribute&&el.setAttribute(n,String(v)));return $obj;}
        return arr.length&&arr[0].getAttribute?arr[0].getAttribute(n):undefined;
      },
      removeAttr(n){arr.forEach(el=>el.removeAttribute&&el.removeAttribute(n));return $obj;},
      find(s){const f=[];for(const n of arr)if(n.querySelectorAll)f.push(...Array.from(n.querySelectorAll(s)));return _wrap(f);},
      children(s){const ch=[];for(const n of arr)if(n.children)ch.push(...Array.from(n.children));return s?_wrap(ch.filter(n=>n.matches&&n.matches(s))):_wrap(ch);},
      each(fn){arr.forEach((n,i)=>fn.call(n,i,n));return $obj;},
      map(fn){return arr.map((n,i)=>fn.call(n,i,n));},
      filter(s){return typeof s==='string'?_wrap(arr.filter(n=>{try{return n.matches&&n.matches(s);}catch(e){return false;}})):$obj;},
      first(){return _wrap(arr.slice(0,1));},
      last(){return _wrap(arr.slice(-1));},
      eq(i){return _wrap(arr[i]?[arr[i]]:[]);},
      get(i){return i===undefined?arr:arr[i];},
      toArray(){return arr;},
      is(s){try{return !!arr[0]&&arr[0].matches&&arr[0].matches(s);}catch(e){return false;}},
      closest(s){if(!arr.length)return _wrap([]);let n=arr[0];while(n&&n.parentElement){if(n.matches&&n.matches(s))return _wrap([n]);n=n.parentElement;}return _wrap([]);},
      parent(){return _wrap(arr.map(n=>n.parentElement).filter(Boolean));},
      parents(s){const res=[];arr.forEach(n=>{let p=n.parentElement;while(p){if(!s||(p.matches&&p.matches(s)))res.push(p);p=p.parentElement;}});return _wrap(res);},
      next(){return _wrap(arr.map(n=>n.nextElementSibling).filter(Boolean));},
      prev(){return _wrap(arr.map(n=>n.previousElementSibling).filter(Boolean));},
      remove(){arr.forEach(n=>n.parentNode&&n.parentNode.removeChild(n));return $obj;},
      append(html){arr.forEach(n=>{const t=doc.createElement('template');t.innerHTML=html;n.appendChild(t.content.cloneNode(true));});return $obj;},
      prepend(html){arr.forEach(n=>{const t=doc.createElement('template');t.innerHTML=html;n.insertBefore(t.content.cloneNode(true),n.firstChild);});return $obj;},
      [Symbol.iterator](){return arr[Symbol.iterator]();},
    };
    return $obj;
  }
  function $(sel){
    if(!sel)return _wrap([doc.documentElement]);
    if(typeof sel==='string'){try{return _wrap(Array.from(doc.querySelectorAll(sel)));}catch(e){return _wrap([]);}}
    if(sel&&sel.nodeType)return _wrap([sel]);
    return _wrap([]);
  }
  $.load=(h)=>_cheerioLoad(h);
  $.root=()=>_wrap([doc.documentElement]);
  $.text=(nodes)=>(nodes||[]).map(n=>(n.textContent||'')).join('');
  return $;
}
const _cheerio={load:_cheerioLoad};

// ─── dayjs shim ───────────────────────────────────────────────────────────────
function _dayjs(val){
  const d=val?new Date(val):new Date();
  const pad=(n,w=2)=>String(n).padStart(w,'0');
  const obj={
    format(fmt){
      return String(fmt||'')
        .replace(/YYYY/,d.getFullYear()).replace(/YY/,String(d.getFullYear()).slice(-2))
        .replace(/MM/,pad(d.getMonth()+1)).replace(/DD/,pad(d.getDate()))
        .replace(/HH/,pad(d.getHours())).replace(/hh/,pad(d.getHours()%12||12))
        .replace(/mm/,pad(d.getMinutes())).replace(/ss/,pad(d.getSeconds()))
        .replace(/A/,d.getHours()<12?'AM':'PM').replace(/a/,d.getHours()<12?'am':'pm');
    },
    unix(){return Math.floor(d.getTime()/1000);},
    valueOf(){return d.getTime();},
    isValid(){return !isNaN(d.getTime());},
    toDate(){return d;},
    toString(){return d.toISOString();},
    fromNow(){const diff=Date.now()-d.getTime();const s=Math.floor(diff/1000);if(s<60)return s+'s ago';const m=Math.floor(s/60);if(m<60)return m+'m ago';const h=Math.floor(m/60);if(h<24)return h+'h ago';return Math.floor(h/24)+'d ago';},
    diff(other,unit){
      const od=other&&other.toDate?other.toDate():(other?new Date(other):new Date());
      const ms=d-od;
      if(unit==='day'||unit==='days')return Math.floor(ms/86400000);
      if(unit==='hour'||unit==='hours')return Math.floor(ms/3600000);
      if(unit==='minute'||unit==='minutes')return Math.floor(ms/60000);
      return ms;
    },
    add(n,unit){return _dayjs(new Date(d.getTime()+n*_unitMs(unit)));},
    subtract(n,unit){return _dayjs(new Date(d.getTime()-n*_unitMs(unit)));},
    isBefore(other){const od=other&&other.toDate?other.toDate():(other?new Date(other):new Date());return d<od;},
    isAfter(other){const od=other&&other.toDate?other.toDate():(other?new Date(other):new Date());return d>od;},
    startOf(unit){
      const nd=new Date(d);
      if(unit==='day'){nd.setHours(0,0,0,0);}else if(unit==='month'){nd.setDate(1);nd.setHours(0,0,0,0);}
      return _dayjs(nd);
    },
    get(unit){
      if(unit==='year')return d.getFullYear();
      if(unit==='month')return d.getMonth();
      if(unit==='date'||unit==='day')return d.getDate();
      return 0;
    },
  };
  return obj;
}
function _unitMs(unit){
  if(unit==='year'||unit==='years')return 365*86400000;
  if(unit==='month'||unit==='months')return 30*86400000;
  if(unit==='week'||unit==='weeks')return 7*86400000;
  if(unit==='day'||unit==='days')return 86400000;
  if(unit==='hour'||unit==='hours')return 3600000;
  if(unit==='minute'||unit==='minutes')return 60000;
  return 1000;
}
_dayjs.unix=(ts)=>_dayjs(new Date(ts*1000));
_dayjs.utc=(val)=>_dayjs(val);
_dayjs.now=()=>Date.now();
_dayjs.isDayjs=(v)=>!!(v&&typeof v.format==='function'&&typeof v.unix==='function');

// ─── Storage shims (localStorage-backed) ─────────────────────────────────────
class _PluginStorage{
  constructor(id){this._id=id;}
  _k(k){return '__ps_'+this._id+'_'+k;}
  set(key,value,expires){
    const exp=expires instanceof Date?expires.getTime():(typeof expires==='number'?Date.now()+expires:undefined);
    try{localStorage.setItem(this._k(key),JSON.stringify({value,created:Date.now(),expires:exp}));}catch(e){}
  }
  get(key){
    try{
      const raw=localStorage.getItem(this._k(key));if(!raw)return undefined;
      const item=JSON.parse(raw);
      if(item.expires&&Date.now()>item.expires){this.delete(key);return undefined;}
      return item.value;
    }catch(e){return undefined;}
  }
  delete(key){try{localStorage.removeItem(this._k(key));}catch(e){}}
  clearAll(){try{Object.keys(localStorage).filter(k=>k.startsWith('__ps_'+this._id+'_')).forEach(k=>localStorage.removeItem(k));}catch(e){}}
  getAllKeys(){try{const p='__ps_'+this._id+'_';return Object.keys(localStorage).filter(k=>k.startsWith(p)).map(k=>k.slice(p.length));}catch(e){return [];}}
}
class _LocalStorage{
  constructor(id){this._id=id;}
  get(){try{const v=localStorage.getItem('__pls_'+this._id);return v?JSON.parse(v):undefined;}catch(e){return undefined;}}
}
class _SessionStorage{
  constructor(id){this._id=id;}
  get(){try{const v=sessionStorage.getItem('__pss_'+this._id);return v?JSON.parse(v):undefined;}catch(e){return undefined;}}
}

// ─── require() factory (one per plugin, per lnreader pluginManager.ts) ────────
function _makeRequire(pluginId){
  const pkgs={
    // lnreader uses require('htmlparser2') and require('cheerio') with no @libs/ prefix
    'htmlparser2':_htmlparser2,
    'cheerio':_cheerio,
    'dayjs':_dayjs,
    'urlencode':{encode:encodeURIComponent,decode:decodeURIComponent},
    // @libs/ namespaced packages
    '@libs/novelStatus':{
      NovelStatus:{
        Unknown:'Unknown',Ongoing:'Ongoing',Completed:'Completed',
        Licensed:'Licensed',PublishingFinished:'Publishing Finished',
        Cancelled:'Cancelled',OnHiatus:'On Hiatus',
      }
    },
    '@libs/fetch':{fetchApi:_proxyFetchApi,fetchText:_proxyFetchText,fetchProto:_fetchProto},
    '@libs/isAbsoluteUrl':{isUrlAbsolute:(url)=>/^https?:\/\//.test(String(url||''))},
    '@libs/filterInputs':{
      FilterTypes:{
        TextInput:'TextInput',CheckboxGroup:'CheckboxGroup',
        ExcludableCheckboxGroup:'ExcludableCheckboxGroup',
        Picker:'Picker',Switch:'Switch',
      },
      ChapterSortOrder:{Asc:'ASC',Desc:'DESC'},
    },
    '@libs/defaultCover':{defaultCover:''},
    '@libs/aes':{gcm:()=>({encrypt:(k,d)=>d,decrypt:(k,d)=>d})},
    '@libs/utils':{
      utf8ToBytes:(s)=>new TextEncoder().encode(s),
      bytesToUtf8:(b)=>new TextDecoder().decode(b),
    },
  };
  return (pkg)=>{
    if(pkg==='@libs/storage')return{
      storage:new _PluginStorage(pluginId),
      localStorage:new _LocalStorage(pluginId),
      sessionStorage:new _SessionStorage(pluginId),
    };
    const m=pkgs[pkg];
    if(m!==undefined)return m;
    console.warn('[Plugin require] Unknown package:',pkg,'in plugin:',pluginId);
    return {};
  };
}

// ─── Plugin store ─────────────────────────────────────────────────────────────
const _store={};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _absUrl(base,path){
  if(!path)return '';
  if(/^https?:\/\//.test(path))return path;
  try{return new URL(path,base).href;}catch(e){return(base||'').replace(/\/$/,'')+'/'+path.replace(/^\/+/,'');}
}

// Normalize lnreader NovelItem[] → NOOVELA format
function _normalizeNovels(novels,ext){
  const site=ext&&ext.plugin&&ext.plugin.site?ext.plugin.site:(ext&&ext.site?ext.site:'');
  const sourceId=ext&&ext.id?ext.id:'';
  return (novels||[]).map(n=>({
    title:n.name||n.title||'',
    coverUrl:n.cover||n.coverUrl||n.thumbnail||'',
    url:n.path?_absUrl(site,n.path):(n.url||''),
    path:n.path||'',
    author:n.author||'',
    genres:Array.isArray(n.genres)?n.genres.join(', '):(n.genres||n.genre||''),
    description:n.summary||n.description||'',
    status:n.status||'',
    sourceId,
    type:'novel',
  }));
}

// Normalize lnreader ChapterItem[] → NOOVELA format
function _normalizeChapters(chapters,ext){
  const site=ext&&ext.plugin&&ext.plugin.site?ext.plugin.site:(ext&&ext.site?ext.site:'');
  return (chapters||[]).map((ch,idx)=>({
    title:ch.name||ch.title||('Chapter '+(idx+1)),
    url:ch.path?_absUrl(site,ch.path):(ch.url||''),
    path:ch.path||'',
    chapterNumber:ch.chapterNumber||(idx+1),
    releaseTime:ch.releaseTime||ch.updatedAt||'',
    read:false,
  }));
}

// ─── Compile a plugin from raw CJS code (exact lnreader pattern) ──────────────
function _compile(ext){
  if(!ext||!ext.code){ext.type='error';ext.plugin=null;return ext;}
  const pluginId=ext.id||'unknown_'+Date.now();
  const req=_makeRequire(pluginId);
  try{
    // This is the EXACT pattern from lnreader/src/plugins/pluginManager.ts:
    // Function('require','module', `const exports = module.exports = {};\n${rawCode};\nreturn exports.default`)(_require, {})
    const plugin=Function(
      'require',
      'module',
      `const exports = module.exports = {};\n${ext.code};\nreturn exports.default`
    )(req,{});

    if(plugin&&typeof plugin==='object'&&(
      typeof plugin.popularNovels==='function'||
      typeof plugin.searchNovels==='function'||
      typeof plugin.parseNovel==='function'||
      typeof plugin.parseChapter==='function'
    )){
      ext.plugin=plugin;
      ext.type='lnreader';
      // Sync metadata from compiled plugin instance
      if(!ext.name&&plugin.name)ext.name=plugin.name;
      if(!ext.site&&plugin.site)ext.site=plugin.site;
      if(!ext.version&&plugin.version)ext.version=plugin.version;
      if(!ext.lang&&plugin.lang)ext.lang=plugin.lang;
      if(!ext.id&&plugin.id){ext.id=plugin.id;}
      if(!ext.iconUrl&&plugin.icon)ext.iconUrl=plugin.icon;
    }else{
      // Legacy NOOVELA plugin
      ext.type='legacy';
      ext.plugin=null;
      ext.mod=plugin||{};
    }
  }catch(e){
    console.error('[Plugin compile error]',pluginId,e.message,e.stack);
    ext.type='error';
    ext.plugin=null;
    ext.mod={};
  }
  _store[ext.id||pluginId]=ext;
  return ext;
}

// ─── PluginManager (window.Plugins) ──────────────────────────────────────────
const PluginManager={

  async loadFromDB(){
    try{
      const exts=await DB.getAllExtensions().catch(()=>[]);
      for(const e of(exts||[]))_compile(e);
    }catch(e){console.error('PluginManager.loadFromDB:',e);}
  },

  getAll(){return Object.values(_store);},
  getPlugin(id){return _store[id]||null;},

  // ─── Install from URL (downloads JS code, compiles, saves to DB) ──────────
  async installFromUrl(url,meta){
    showLoading('Installing…');
    try{
      const code=await Scraper.fetchText(url);
      if(!code||code.length<10)throw new Error('Empty or invalid plugin code from: '+url);
      const id=(meta&&meta.id)||url.split('/').pop().replace(/\.js$/,'');
      const ext=Object.assign(
        {name:id,lang:'',version:'',iconUrl:'',site:''},
        meta||{},{id,code,sourceUrl:url}
      );
      _compile(ext);
      await DB.saveExtension(ext);
      showToast('Installed: '+(ext.name||id),'success');
      return ext;
    }finally{hideLoading();}
  },

  async uninstall(id){
    delete _store[id];
    await DB.deleteExtension(id);
  },

  // ─── getPopular: returns NOOVELA-format novel array ───────────────────────
  async getPopular(id,page){
    const ext=_store[id];
    if(!ext)throw new Error('Plugin not found: '+id);
    if(ext.type==='lnreader'&&ext.plugin&&typeof ext.plugin.popularNovels==='function'){
      // popularNovels returns NovelItem[] directly
      const novels=await ext.plugin.popularNovels(page||1,{showLatestNovels:false,filters:{}});
      return _normalizeNovels(Array.isArray(novels)?novels:[],ext);
    }
    if(ext.mod&&typeof ext.mod.fetchPopular==='function'){
      const res=await ext.mod.fetchPopular(page||1);
      return Array.isArray(res)?res:[];
    }
    if(ext.mod&&typeof ext.mod.fetchLatest==='function'){
      const res=await ext.mod.fetchLatest(page||1);
      return Array.isArray(res)?res:[];
    }
    throw new Error('No popularNovels method in plugin: '+id);
  },

  // ─── searchNovels: returns NOOVELA-format novel array ─────────────────────
  async searchNovels(id,term,page){
    const ext=_store[id];
    if(!ext)throw new Error('Plugin not found: '+id);
    if(ext.type==='lnreader'&&ext.plugin&&typeof ext.plugin.searchNovels==='function'){
      // searchNovels returns NovelItem[] directly
      const novels=await ext.plugin.searchNovels(term,page||1);
      return _normalizeNovels(Array.isArray(novels)?novels:[],ext);
    }
    if(ext.mod&&typeof ext.mod.search==='function'){
      const res=await ext.mod.search(term,page||1);
      return Array.isArray(res)?res:[];
    }
    throw new Error('No searchNovels method in plugin: '+id);
  },

  // ─── getNovelDetails: returns normalized book object with chapters ─────────
  async getNovelDetails(id,url){
    const ext=_store[id];
    if(!ext)throw new Error('Plugin not found: '+id);
    const site=ext.plugin&&ext.plugin.site?ext.plugin.site:(ext.site||'');
    // Convert absolute URL → relative path (plugin's internal format)
    let path=url;
    if(site&&url&&url.startsWith(site))path=url.slice(site.length)||'/';
    if(!path||path===url&&/^https?:\/\//.test(url)&&site&&!url.startsWith(site))path=url;
    if(ext.type==='lnreader'&&ext.plugin&&typeof ext.plugin.parseNovel==='function'){
      const res=await ext.plugin.parseNovel(path);
      const chapters=_normalizeChapters(res.chapters||[],ext);
      return{
        title:res.name||res.title||'',
        coverUrl:res.cover||res.coverUrl||'',
        author:res.author||'',
        artist:res.artist||'',
        status:typeof res.status==='string'?res.status:'',
        genres:Array.isArray(res.genres)?res.genres.join(', '):(res.genres||''),
        description:res.summary||res.description||'',
        chapters,
        sourceId:id,
        type:'novel',
        url,
      };
    }
    if(ext.mod&&typeof ext.mod.getBookInfo==='function'){
      return await ext.mod.getBookInfo(url);
    }
    throw new Error('No parseNovel method in plugin: '+id);
  },

  // ─── getChapterContent: returns string of chapter HTML/text ───────────────
  async getChapterContent(id,chapterUrl){
    const ext=_store[id];
    if(!ext)throw new Error('Plugin not found: '+id);
    const site=ext.plugin&&ext.plugin.site?ext.plugin.site:(ext.site||'');
    let path=chapterUrl;
    if(site&&chapterUrl&&chapterUrl.startsWith(site))path=chapterUrl.slice(site.length)||'/';
    if(ext.type==='lnreader'&&ext.plugin&&typeof ext.plugin.parseChapter==='function'){
      // parseChapter returns string directly (per lnreader types/index.ts)
      const res=await ext.plugin.parseChapter(path);
      if(typeof res==='string')return res;
      // Fallback in case a plugin returns an object
      return res&&(res.chapterText||res.text||res.html||res.content)||'';
    }
    if(ext.mod&&typeof ext.mod.fetchChapter==='function'){
      return await ext.mod.fetchChapter(chapterUrl);
    }
    throw new Error('No parseChapter method in plugin: '+id);
  },

  // ─── Fetch 290+ lnreader-plugins JSON index ───────────────────────────────
  async fetchLnReaderIndex(customUrl){
    const url=customUrl||LNREADER_INDEX_URL;
    try{
      const json=await Scraper.fetchText(url);
      const arr=JSON.parse(json);
      return arr.map(item=>({
        id:String(item.id||''),
        name:String(item.name||''),
        lang:String(item.lang||''),
        version:String(item.version||''),
        sourceUrl:String(item.url||''),   // item.url = plugin JS URL
        iconUrl:String(item.iconUrl||''),
        site:String(item.site||''),
      }));
    }catch(e){console.error('fetchLnReaderIndex:',e);return [];}
  },

  // ─── Fetch HnDK0 YAML index ───────────────────────────────────────────────
  async fetchIndex(customUrl){
    const url=customUrl||EXT_INDEX_URL;
    try{
      const yaml=await Scraper.fetchText(url);
      return this._parseYaml(yaml);
    }catch(e){console.error('fetchIndex:',e);return [];}
  },
  _parseYaml(yaml){
    const items=[];let cur=null;
    for(const rawLine of(yaml||'').split('\n')){
      const line=rawLine.replace(/[\r]+$/,'');
      if(line.match(/^- |-^ {2}-\s/))cur={};
      if(!cur)continue;
      const t=line.trim();
      if(t.startsWith('name: '))cur.name=t.slice(6).trim();
      else if(t.startsWith('id: '))cur.id=t.slice(4).trim();
      else if(t.startsWith('lang: '))cur.lang=t.slice(6).trim();
      else if(t.startsWith('version: '))cur.version=t.slice(9).trim();
      else if(t.startsWith('sourceUrl: '))cur.sourceUrl=t.slice(11).trim();
      else if(t.startsWith('url: ')&&!cur.sourceUrl)cur.sourceUrl=t.slice(5).trim();
      else if(t.startsWith('description: '))cur.description=t.slice(13).trim();
      if(cur&&cur.name&&cur.sourceUrl){items.push(Object.assign({id:cur.name},cur));cur=null;}
    }
    return items;
  },
};

window.Plugins=PluginManager;
window.LNREADER_INDEX_URL=LNREADER_INDEX_URL;
window.EXT_INDEX_URL=EXT_INDEX_URL;
