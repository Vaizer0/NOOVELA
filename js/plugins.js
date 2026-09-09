'use strict';
const DEFAULT_INDEX_URL='https://raw.githubusercontent.com/HnDK0/external-sources/refs/heads/main/index.yaml';
const _store={};
const PluginManager={
  async loadFromDB(){try{const exts=await DB.getAllExtensions();for(const e of exts)this._compile(e);}catch(e){console.error('PluginManager.loadFromDB:',e);}},
  _compile(ext){
    const api=this._makeAPI(ext);const exports={};
    try{
      const methods=['fetchPopular','fetchLatest','fetchManga','search','fetchChapter','fetchMangaChapter','getBookInfo','getMangaPages'];
      let ac='';for(const m of methods)ac+='try{exports.'+m+'='+m+';}catch(_){}';
      const fn=new Function('API','exports',ext.code+';'+ac);
      fn(api,exports);ext.mod=exports;
    }catch(e){console.error('Plugin compile error',ext.id,e);ext.mod={};}
    _store[ext.id]=ext;
  },
  _makeAPI(ext){
    return{
      fetch:(u,o)=>Scraper.fetchProxy(u,o),
      fetchText:(u,o)=>Scraper.fetchText(u,o),
      fetchJson:(u,o)=>Scraper.fetchJson(u,o),
      parseHtml:html=>new DOMParser().parseFromString(html,'text/html'),
      absoluteUrl:(base,rel)=>{try{return new URL(rel,base).href;}catch(_){return rel;}},
      extractText:(el,sel)=>{
        if(typeof el==='string')el=new DOMParser().parseFromString(el,'text/html').body;
        if(sel)el=el.querySelector(sel);
        return el?el.textContent||'':'';
      },
      querySelectorAll:(el,sel)=>Array.from((typeof el==='string'?new DOMParser().parseFromString(el,'text/html').body:el).querySelectorAll(sel)),
      querySelector:(el,sel)=>(typeof el==='string'?new DOMParser().parseFromString(el,'text/html').body:el).querySelector(sel),
      attr:(el,a)=>el?el.getAttribute(a):null,
      text:(el)=>el?el.textContent.trim():'',
      log:(...a)=>console.log('['+ext.id+']',...a),
      error:(...a)=>console.error('['+ext.id+']',...a),
      PROXIES:['https://api.allorigins.win/raw?url=','https://corsproxy.io/?','https://thingproxy.freeboard.io/fetch/','https://api.codetabs.com/v1/proxy/?quest='],
    };
  },
  getAll(){return Object.values(_store);},
  getPlugin(id){return _store[id]||null;},
  async install(ext){this._compile(ext);await DB.saveExtension(ext);},
  async uninstall(id){delete _store[id];await DB.deleteExtension(id);},
  async installFromUrl(url){
    showLoading('Fetching extension...');
    try{
      const code=await Scraper.fetchText(url);
      if(!code||!code.trim())throw new Error('Empty response from: '+url);
      const meta=this._extractMeta(code,url);
      const ext=Object.assign({},meta,{code,sourceUrl:url,installedAt:Date.now()});
      await this.install(ext);
      return ext;
    }finally{hideLoading();}
  },
  _extractMeta(code,url){
    let name='',lang='',version='',id='',description='';
    const lines=code.split('\n');
    for(const line of lines){
      const t=line.trim();
      if(t.startsWith('// @name '))name=t.slice(9).trim();
      else if(t.startsWith('// @lang '))lang=t.slice(9).trim();
      else if(t.startsWith('// @version '))version=t.slice(12).trim();
      else if(t.startsWith('// @id '))id=t.slice(7).trim();
      else if(t.startsWith('// @description '))description=t.slice(16).trim();
    }
    if(!id){const p=url.split('/');id=p[p.length-1].replace('.js','');}
    if(!name)name=id;
    return{id,name,lang,version,description};
  },
  async fetchIndex(url){
    url=url||DEFAULT_INDEX_URL;
    try{
      const yaml=await Scraper.fetchText(url);
      if(!yaml)throw new Error('Empty index response');
      return this._parseYaml(yaml);
    }catch(e){
      console.error('fetchIndex:',url,e);
      throw e;
    }
  },
  _parseYaml(yaml){
    const items=[];let cur=null;
    for(const rawLine of yaml.split('\n')){
      const line=rawLine.replace(/[\r]+$/,'');
      if(line.startsWith('- ')||line.trim().startsWith('- '))cur={};
      if(!cur)continue;
      const t=line.trim();
      if(t.startsWith('name: '))cur.name=t.slice(6).replace(/^[\'\"]/,'').replace(/[\'\"]+$/,'').trim();
      else if(t.startsWith('id: '))cur.id=t.slice(4).trim();
      else if(t.startsWith('lang: '))cur.lang=t.slice(6).trim();
      else if(t.startsWith('version: '))cur.version=String(t.slice(9).trim());
      else if(t.startsWith('description: '))cur.description=t.slice(13).trim();
      else if(t.startsWith('sourceUrl: '))cur.sourceUrl=t.slice(11).trim();
      else if(t.startsWith('url: ')&&!cur.sourceUrl)cur.sourceUrl=t.slice(5).trim();
      // Flush when we have enough
      if(cur&&cur.id&&cur.sourceUrl&&(t.startsWith('sourceUrl:')||t.startsWith('url:'))){
        items.push(Object.assign({},cur));cur=null;
      }
    }
    // Flush last item if not yet added
    if(cur&&cur.id&&cur.sourceUrl)items.push(cur);
    return items;
  },
  async callPlugin(id,method,...args){
    const ext=_store[id];if(!ext||!ext.mod||!ext.mod[method])throw new Error(id+' has no method '+method);
    return ext.mod[method].apply(null,args);
  },
};
window.Plugins=PluginManager;
