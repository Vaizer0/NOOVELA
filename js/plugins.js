'use strict';
const LNREADER_INDEX_URL='https://raw.githubusercontent.com/Vaizer0/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json';
const EXT_INDEX_URL='https://raw.githubusercontent.com/HnDK0/external-sources/refs/heads/main/index.yaml';
const CORS_PROXIES=['https://api.allorigins.win/raw?url=','https://corsproxy.io/?url=','https://api.codetabs.com/v1/proxy/?quest=','https://thingproxy.freeboard.io/fetch/'];
const _store={};

// htmlparser2-compatible shim backed by DOMParser
const _htmlparser2={
  Parser:class{
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
};

function _makeFetchLib(){
  const _fetch=async(url,opts)=>{
    const headers=(opts&&typeof opts==='object'&&!Array.isArray(opts))?(opts.headers||{}):(typeof opts==='object'?opts:{});
    for(const px of CORS_PROXIES){
      try{
        const r=await fetch(px+encodeURIComponent(url),{headers:typeof headers==='object'?headers:{}});
        if(r.ok){const txt=await r.text();return{ok:true,status:r.status,text:()=>Promise.resolve(txt),json:()=>Promise.resolve(JSON.parse(txt))};}
      }catch(e){}
    }
    try{
      const r=await fetch(url);
      if(r.ok){const txt=await r.text();return{ok:true,status:r.status,text:()=>Promise.resolve(txt),json:()=>Promise.resolve(JSON.parse(txt))};}
    }catch(e){}
    throw new Error('All proxies failed: '+url);
  };
  return{fetchApi:_fetch,fetch:_fetch};
}

function _makeCheerioLib(){
  return{
    load:(html)=>{
      const doc=new DOMParser().parseFromString(String(html||''),'text/html');
      function _wrap(nodes){
        const obj={
          _n:nodes,length:nodes.length,
          text(){return nodes.map(n=>n.textContent||'').join('').trim();},
          html(){return nodes.length?nodes[0].innerHTML||'':'';},
          attr(n){return nodes.length&&nodes[0].getAttribute?nodes[0].getAttribute(n):undefined;},
          find(s){const f=[];for(const n of nodes)if(n.querySelectorAll)f.push(...Array.from(n.querySelectorAll(s)));return _wrap(f);},
          each(fn){nodes.forEach((n,i)=>fn(i,n));return obj;},
          map(fn){return nodes.map((n,i)=>fn(i,n));},
          first(){return _wrap(nodes.slice(0,1));},
          last(){return _wrap(nodes.slice(-1));},
          eq(i){return _wrap(nodes[i]?[nodes[i]]:[]);},
          get(i){return i===undefined?nodes:nodes[i];},
          toArray(){return nodes;},
          is(s){try{return!!nodes[0]&&nodes[0].matches(s);}catch(e){return false;}},
          filter(s){return typeof s==='string'?_wrap(nodes.filter(n=>n.matches&&n.matches(s))):obj;},
          closest(s){if(!nodes.length)return _wrap([]);let n=nodes[0];while(n&&n.parentElement){if(n.matches&&n.matches(s))return _wrap([n]);n=n.parentElement;}return _wrap([]);},
          parent(){return _wrap(nodes.map(n=>n.parentElement).filter(Boolean));},
          children(s){const ch=[];for(const n of nodes)if(n.children)ch.push(...Array.from(n.children));return s?_wrap([...ch]).filter(s):_wrap([...ch]);},
          next(){return _wrap(nodes.map(n=>n.nextElementSibling).filter(Boolean));},
          prev(){return _wrap(nodes.map(n=>n.previousElementSibling).filter(Boolean));},
          [Symbol.iterator](){return nodes[Symbol.iterator]();}
        };
        return obj;
      }
      function $(sel){
        if(!sel)return _wrap([doc.documentElement]);
        try{return _wrap(Array.from(doc.querySelectorAll(sel)));}catch(e){return _wrap([]);}
      }
      $.load=(h)=>_makeCheerioLib().load(h);
      return $;
    }
  };
}

function _makeRequire(){
  const libs={
    'htmlparser2':_htmlparser2,
    '@libs/fetch':_makeFetchLib(),
    '@libs/novelStatus':{NovelStatus:{Ongoing:'Ongoing',Completed:'Completed',Unknown:'Unknown',OnHiatus:'Hiatus'}},
    '@libs/filterInputs':{FilterTypes:{TextInput:'TextInput',CheckboxGroup:'CheckboxGroup',ExcludableCheckboxGroup:'ExcludableCheckboxGroup',Picker:'Picker',Switch:'Switch'},ChapterSortOrder:{Asc:'ASC',Desc:'DESC'}},
    '@libs/isAbsoluteUrl':{isUrlAbsolute:(url)=>/^https?:\/\//.test(String(url||''))},
    '@libs/storage':{storage:{get:(k)=>{try{return localStorage.getItem(k);}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,String(v));}catch(e){}},delete:(k)=>{try{localStorage.removeItem(k);}catch(e){}}}},
    '@libs/cheerio':_makeCheerioLib(),
  };
  return(m)=>libs[m]!==undefined?libs[m]:{};
}

const PluginManager={
  async loadFromDB(){
    try{const exts=await DB.getAllExtensions();for(const e of exts)this._compile(e);}
    catch(e){console.error('PluginManager.loadFromDB:',e);}
  },
  _compile(ext){
    const req=_makeRequire();
    const mod={exports:{}};
    try{
      const fn=new Function('require','module','exports','console','fetch','URL','DOMParser','setTimeout','clearTimeout','Promise',ext.code);
      fn(req,mod,mod.exports,window.console,window.fetch.bind(window),URL,DOMParser,setTimeout,clearTimeout,Promise);
      const raw=mod.exports;
      const ex=(raw&&raw.default&&typeof raw.default==='object')?raw.default:raw;
      if(ex&&(ex.popularNovels||ex.searchNovels||ex.fetchChapterContent||ex.parseChapter||ex.parseNovel)){
        ext.mod=ex;ext.type='lnreader';
      }else{
        const legacy={};
        const methods=['fetchPopular','fetchLatest','fetchManga','search','fetchChapter','fetchMangaChapter','getBookInfo','getMangaPages'];
        const API={fetch:(u,o)=>Scraper.fetchProxy(u,o),fetchText:(u,o)=>Scraper.fetchText(u,o),fetchJson:(u,o)=>Scraper.fetchJson(u,o),parseHtml:html=>new DOMParser().parseFromString(html,'text/html'),absoluteUrl:(base,rel)=>{try{return new URL(rel,base).href;}catch(_){return rel;}},extractText:el=>el?el.textContent||'':'',log:(...a)=>console.log('['+ext.id+']',...a),error:(...a)=>console.error('['+ext.id+']',...a)};
        let ac='';for(const m of methods)ac+='try{legacy.'+m+'='+m+';}catch(_){}';
        try{const fn2=new Function('API','legacy',ext.code+';'+ac);fn2(API,legacy);}catch(e){}
        ext.mod=Object.keys(legacy).length?legacy:(ex||{});
        ext.type='legacy';
      }
    }catch(e){console.error('Plugin compile error ['+ext.id+']:',e.message);ext.mod={};ext.type='error';}
    _store[ext.id]=ext;
  },
  getAll(){return Object.values(_store);},
  getPlugin(id){return _store[id]||null;},
  async install(ext){this._compile(ext);await DB.saveExtension(ext);},
  async uninstall(id){delete _store[id];await DB.deleteExtension(id);},
  async installFromUrl(url,meta){
    showLoading('Installing…');
    try{
      const code=await Scraper.fetchText(url);
      if(!code||code.length<10)throw new Error('Empty or invalid source');
      const extracted=this._extractMeta(code,url);
      const ext=Object.assign({},extracted,meta||{},{code,sourceUrl:url});
      if(!ext.id)ext.id=url.split('/').pop().replace(/\.js$/,'');
      if(!ext.name)ext.name=ext.id;
      await this.install(ext);
      showToast('Installed: '+ext.name,'success');
      return ext;
    }finally{hideLoading();}
  },
  _extractMeta(code,url){
    let name='',lang='',version='',id='',description='';
    for(const line of (code||'').split('\n')){
      const t=line.trim();
      if(t.startsWith('// @name '))name=name||t.slice(9).trim();
      else if(t.startsWith('// @lang '))lang=lang||t.slice(9).trim();
      else if(t.startsWith('// @version '))version=version||t.slice(12).trim();
      else if(t.startsWith('// @id '))id=id||t.slice(7).trim();
      else if(t.startsWith('// @description '))description=description||t.slice(16).trim();
    }
    const idM=code.match(/this\.id\s*=\s*["']([^"']+)["']/);
    if(idM&&!id)id=idM[1];
    const nmM=code.match(/this\.name\s*=\s*["']([^"']+)["']/);
    if(nmM&&!name)name=nmM[1];
    const vM=code.match(/this\.version\s*=\s*["']([^"']+)["']/);
    if(vM&&!version)version=vM[1];
    const lM=code.match(/this\.lang\s*=\s*["']([^"']+)["']/);
    if(lM&&!lang)lang=lM[1];
    const sM=code.match(/this\.site\s*=\s*["']([^"']+)["']/);
    if(sM&&!description)description=sM[1];
    if(!id){const p=url.split('/');id=p[p.length-1].replace(/\.js$/,'');}
    if(!name)name=id;
    return{id,name,lang,version,description};
  },
  async fetchLnReaderIndex(customUrl){
    const url=customUrl||LNREADER_INDEX_URL;
    try{
      const json=await Scraper.fetchText(url);
      const arr=JSON.parse(json);
      return arr.map(item=>({
        id:String(item.id||''),name:String(item.name||''),lang:String(item.lang||''),
        version:String(item.version||''),sourceUrl:String(item.url||''),
        iconUrl:String(item.iconUrl||''),site:String(item.site||''),
        description:String(item.site||''),customCSS:String(item.customCSS||''),
      }));
    }catch(e){console.error('fetchLnReaderIndex:',e);return[];}
  },
  async fetchIndex(customUrl){
    const url=customUrl||EXT_INDEX_URL;
    try{const yaml=await Scraper.fetchText(url);return this._parseYaml(yaml);}
    catch(e){console.error('fetchIndex:',e);return[];}
  },
  _parseYaml(yaml){
    const items=[];let cur=null;
    for(const rawLine of (yaml||'').split('\n')){
      const line=rawLine.replace(/[\r]+$/,'');
      if(line.startsWith('- '))cur={};
      if(!cur)continue;
      const t=line.trim();
      if(t.startsWith('name: '))cur.name=t.slice(6).trim();
      else if(t.startsWith('id: '))cur.id=t.slice(4).trim();
      else if(t.startsWith('lang: '))cur.lang=t.slice(6).trim();
      else if(t.startsWith('version: '))cur.version=t.slice(9).trim();
      else if(t.startsWith('sourceUrl: '))cur.sourceUrl=t.slice(11).trim();
      else if(t.startsWith('url: '))cur.sourceUrl=cur.sourceUrl||t.slice(5).trim();
      else if(t.startsWith('description: '))cur.description=t.slice(13).trim();
      if(cur&&cur.id&&cur.sourceUrl){items.push(Object.assign({},cur));cur=null;}
    }
    return items;
  },
  async callPlugin(id,method,...args){
    const ext=_store[id];
    if(!ext||!ext.mod||typeof ext.mod[method]!=='function')throw new Error(id+' has no method: '+method);
    return ext.mod[method].apply(ext.mod,args);
  },
  async getPopular(id,page){
    const ext=_store[id];if(!ext||!ext.mod)throw new Error('Plugin not found: '+id);
    if(ext.type==='lnreader'&&typeof ext.mod.popularNovels==='function')return ext.mod.popularNovels(page||1,{showLatestNovels:false,filters:{}});
    if(typeof ext.mod.fetchPopular==='function')return ext.mod.fetchPopular(page||1);
    throw new Error('No popularNovels method in '+id);
  },
  async searchNovels(id,term,page){
    const ext=_store[id];if(!ext||!ext.mod)throw new Error('Plugin not found: '+id);
    if(ext.type==='lnreader'&&typeof ext.mod.searchNovels==='function')return ext.mod.searchNovels(term,page||1);
    if(typeof ext.mod.search==='function')return ext.mod.search(term,page||1);
    throw new Error('No searchNovels method in '+id);
  },
  async getNovelDetails(id,path){
    const ext=_store[id];if(!ext||!ext.mod)throw new Error('Plugin not found: '+id);
    if(ext.type==='lnreader'&&typeof ext.mod.parseNovel==='function')return ext.mod.parseNovel(path);
    if(typeof ext.mod.getBookInfo==='function')return ext.mod.getBookInfo(path);
    throw new Error('No parseNovel method in '+id);
  },
  async getChapterContent(id,path){
    const ext=_store[id];if(!ext||!ext.mod)throw new Error('Plugin not found: '+id);
    if(ext.type==='lnreader'&&typeof ext.mod.parseChapter==='function')return ext.mod.parseChapter(path);
    if(typeof ext.mod.fetchChapter==='function')return ext.mod.fetchChapter(path);
    throw new Error('No parseChapter method in '+id);
  },
};
window.Plugins=PluginManager;
window.LNREADER_INDEX_URL=LNREADER_INDEX_URL;
window.EXT_INDEX_URL=EXT_INDEX_URL;
