'use strict';
const LNREADER_REPO_URL='https://raw.githubusercontent.com/Vaizer0/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json';

let _extSearch='';
let _idxSearch='';
let _idxItems=[];
let _idxLoaded=false;
let _idxLoading=false;
let _filterLang='all';

const LANG_SHORT={
  'English':'EN','Français':'FR','Español':'ES','Português':'PT',
  'Русский':'RU','Bahasa Indonesia':'ID','中文, 汉语, 漢語':'ZH',
  '日本語':'JP','조선말, 한국어':'KO','Türkçe':'TR','ไทย':'TH',
  'Tiếng Việt':'VI','Українська':'UK','Polski':'PL','Multi':'Multi'
};
function _short(lang){return LANG_SHORT[lang]||(lang?lang.replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase()||'?':'?');}

async function initExtensions(){
  extSearchInit();
  await renderExtensions();
  if(!_idxLoaded&&!_idxLoading)_loadIndex();
}

async function renderExtensions(){
  const container=document.getElementById('ext-list');if(!container)return;
  let installed=Plugins.getAll();
  if(_extSearch){
    const q=_extSearch.toLowerCase();
    installed=installed.filter(e=>(e.name||'').toLowerCase().includes(q)||(e.lang||'').toLowerCase().includes(q)||(e.site||'').toLowerCase().includes(q));
  }
  container.innerHTML='';
  if(!installed.length){
    const d=document.createElement('div');d.className='empty-state';
    const p=document.createElement('p');p.textContent='No extensions installed. Browse 290+ sources in the catalog below.';
    d.appendChild(p);container.appendChild(d);
  }else{
    installed.forEach(ext=>{
      const div=document.createElement('div');div.className='ext-card';
      div.style.display='flex';div.style.alignItems='center';div.style.gap='10px';
      if(ext.iconUrl){
        const img=document.createElement('img');img.src=ext.iconUrl;
        img.style.cssText='width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0;';
        img.onerror=()=>{img.style.display='none';};div.appendChild(img);
      }
      const info=document.createElement('div');info.className='ext-info';info.style.flex='1;min-width:0';
      const name=document.createElement('div');name.className='ext-name';name.textContent=ext.name;
      const meta=document.createElement('div');meta.className='ext-meta';
      const parts=[];
      if(ext.lang)parts.push(_short(ext.lang));
      if(ext.version)parts.push('v'+ext.version);
      if(ext.site)parts.push(ext.site);
      meta.textContent=parts.join(' · ');
      info.appendChild(name);info.appendChild(meta);
      const btns=document.createElement('div');btns.className='ext-btns';
      const updateBtn=document.createElement('button');updateBtn.className='btn btn-ghost btn-sm';updateBtn.textContent='Update';
      updateBtn.onclick=async()=>{
        if(!ext.sourceUrl){showToast('No source URL','error');return;}
        try{
          const m={name:ext.name,lang:ext.lang,version:ext.version,iconUrl:ext.iconUrl||'',site:ext.site||'',description:ext.description||''};
          await Plugins.installFromUrl(ext.sourceUrl,m);
          await renderExtensions();
          if(_idxLoaded)_renderIndexPanel(_idxItems);
        }catch(e){showToast('Update failed: '+e.message,'error');}
      };
      const unBtn=document.createElement('button');unBtn.className='btn btn-ghost btn-sm';unBtn.textContent='Uninstall';
      unBtn.onclick=async()=>{
        await Plugins.uninstall(ext.id);
        await renderExtensions();
        if(_idxLoaded)_renderIndexPanel(_idxItems);
        showToast('Uninstalled: '+ext.name,'info');
      };
      btns.appendChild(updateBtn);btns.appendChild(unBtn);
      div.appendChild(info);div.appendChild(btns);
      container.appendChild(div);
    });
  }
}

async function _loadIndex(force){
  if(_idxLoading)return;
  _idxLoading=true;
  const panel=document.getElementById('ext-index-panel');
  if(panel){
    panel.classList.add('show');
    panel.innerHTML='<div style="padding:18px 16px;color:var(--text2);font-size:13px;">Loading 290+ sources…</div>';
  }
  try{
    const items=await Plugins.fetchLnReaderIndex(LNREADER_REPO_URL);
    _idxItems=items;
    _idxLoaded=true;
    _filterLang='all';
    _idxSearch='';
    _renderIndexPanel(items);
  }catch(e){
    if(panel)panel.innerHTML='<div style="padding:14px;color:#f88;font-size:13px;">Failed to load catalog: '+e.message+'<br><br><button class="btn btn-ghost btn-sm" onclick="Ext.refreshIndex()">Retry</button></div>';
  }finally{_idxLoading=false;}
}

function _renderIndexPanel(allItems){
  const panel=document.getElementById('ext-index-panel');if(!panel)return;
  panel.classList.add('show');panel.innerHTML='';

  const hdr=document.createElement('div');
  hdr.style.cssText='display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);gap:8px;flex-wrap:wrap;';
  const left=document.createElement('div');
  const t1=document.createElement('div');t1.style.cssText='font-size:14px;font-weight:700;color:var(--text);';
  t1.textContent='📚 lnreader-plugins v3.0.0';
  const t2=document.createElement('div');t2.style.cssText='font-size:11px;color:var(--text2);margin-top:2px;';
  const langCount=[...new Set(allItems.map(i=>i.lang).filter(Boolean))].length;
  t2.textContent=allItems.length+' sources · '+langCount+' languages';
  left.appendChild(t1);left.appendChild(t2);
  const refreshBtn=document.createElement('button');refreshBtn.className='btn btn-ghost btn-sm';
  refreshBtn.textContent='↺ Refresh';
  refreshBtn.onclick=()=>{_idxLoaded=false;_loadIndex(true);};
  hdr.appendChild(left);hdr.appendChild(refreshBtn);
  panel.appendChild(hdr);

  const srchWrap=document.createElement('div');srchWrap.style.marginBottom='10px';
  const srchInp=document.createElement('input');srchInp.type='text';
  srchInp.placeholder='Search by name or site…';srchInp.value=_idxSearch;
  srchInp.style.cssText='width:100%;box-sizing:border-box;padding:7px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;outline:none;';
  srchInp.addEventListener('input',debounce(e=>{_idxSearch=e.target.value;_applyFilters(allItems);},180));
  srchWrap.appendChild(srchInp);panel.appendChild(srchWrap);

  const langs=[...new Set(allItems.map(i=>i.lang).filter(Boolean))].sort((a,b)=>{
    if(a==='English')return -1;if(b==='English')return 1;
    return a.localeCompare(b);
  });
  const bar=document.createElement('div');
  bar.id='ext-lang-bar';
  bar.style.cssText='display:flex;gap:4px;overflow-x:auto;margin-bottom:12px;padding-bottom:4px;scrollbar-width:thin;flex-wrap:nowrap;';
  const allBtn=_mkLangBtn('All ('+allItems.length+')',true,'all',allItems,bar);
  bar.appendChild(allBtn);
  langs.forEach(lang=>{
    const cnt=allItems.filter(i=>i.lang===lang).length;
    const lb=_mkLangBtn(_short(lang)+' ('+cnt+')',false,lang,allItems,bar);
    lb.title=lang;
    bar.appendChild(lb);
  });
  panel.appendChild(bar);

  const list=document.createElement('div');list.id='ext-index-list';
  panel.appendChild(list);

  const footer=document.createElement('div');footer.id='ext-index-footer';
  footer.style.cssText='font-size:11px;color:var(--text2);text-align:center;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);';
  panel.appendChild(footer);

  _applyFilters(allItems);
}

function _mkLangBtn(label,active,lang,allItems,bar){
  const btn=document.createElement('button');
  btn.className=active?'btn btn-primary btn-sm':'btn btn-ghost btn-sm';
  btn.style.whiteSpace='nowrap';btn.style.flexShrink='0';
  btn.textContent=label;btn.dataset.lang=lang;
  btn.onclick=()=>{
    _filterLang=lang;
    _applyFilters(allItems);
    if(bar)bar.querySelectorAll('button').forEach(b=>{
      b.className=b.dataset.lang===lang?'btn btn-primary btn-sm':'btn btn-ghost btn-sm';
      b.style.whiteSpace='nowrap';b.style.flexShrink='0';
    });
  };
  return btn;
}

function _getFiltered(items){
  let f=items;
  if(_filterLang&&_filterLang!=='all')f=f.filter(i=>i.lang===_filterLang);
  if(_idxSearch){const q=_idxSearch.toLowerCase();f=f.filter(i=>(i.name||'').toLowerCase().includes(q)||(i.site||'').toLowerCase().includes(q)||(i.id||'').toLowerCase().includes(q));}
  return f;
}

function _applyFilters(allItems){
  const list=document.getElementById('ext-index-list');if(!list)return;
  const footer=document.getElementById('ext-index-footer');
  const installed=new Set(Plugins.getAll().map(p=>p.id));
  const filtered=_getFiltered(allItems);
  list.innerHTML='';
  filtered.forEach(item=>_appendIndexRow(list,item,installed));
  if(footer)footer.textContent='Showing '+filtered.length+' of '+allItems.length+' sources';
}

function _appendIndexRow(list,item,installed){
  const row=document.createElement('div');
  row.style.cssText='display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);';

  if(item.iconUrl){
    const img=document.createElement('img');img.src=item.iconUrl;
    img.style.cssText='width:28px;height:28px;border-radius:6px;object-fit:cover;flex-shrink:0;';
    img.onerror=()=>{img.style.display='none';};row.appendChild(img);
  }else{
    const ico=document.createElement('div');
    ico.style.cssText='width:28px;height:28px;border-radius:6px;background:var(--bg2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--text2);';
    ico.textContent=(item.name||'?').slice(0,1).toUpperCase();
    row.appendChild(ico);
  }

  const info=document.createElement('div');info.style.cssText='flex:1;min-width:0;overflow:hidden;';
  const nameEl=document.createElement('div');
  nameEl.style.cssText='font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  nameEl.textContent=item.name||item.id;info.appendChild(nameEl);
  const sub=document.createElement('div');sub.style.cssText='font-size:11px;color:var(--text2);margin-top:1px;display:flex;gap:5px;flex-wrap:wrap;align-items:center;';
  if(item.lang){
    const badge=document.createElement('span');
    badge.style.cssText='background:var(--accent,#7c5cfc);color:#fff;border-radius:3px;padding:1px 5px;font-size:10px;font-weight:600;letter-spacing:.3px;white-space:nowrap;';
    badge.textContent=_short(item.lang);sub.appendChild(badge);
  }
  if(item.version){
    const v=document.createElement('span');v.style.color='var(--text2)';v.textContent='v'+item.version;sub.appendChild(v);
  }
  if(item.site){
    const s=document.createElement('span');
    s.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;color:var(--text2);';
    s.textContent=item.site;s.title=item.site;sub.appendChild(s);
  }
  info.appendChild(sub);row.appendChild(info);

  const btn=document.createElement('button');btn.style.flexShrink='0';
  if(installed.has(item.id)){
    btn.className='btn btn-sm btn-ghost';btn.textContent='✓';btn.title='Installed';btn.disabled=true;
  }else if(!item.sourceUrl){
    btn.className='btn btn-sm btn-ghost';btn.textContent='N/A';btn.disabled=true;
  }else{
    btn.className='btn btn-sm btn-primary';btn.textContent='Install';
    btn.onclick=async()=>{
      btn.disabled=true;btn.textContent='…';
      try{
        const meta={
          name:item.name,lang:item.lang,version:item.version,
          iconUrl:item.iconUrl||'',site:item.site||'',description:item.site||'',
          id:item.id
        };
        await Plugins.installFromUrl(item.sourceUrl,meta);
        btn.textContent='✓';btn.className='btn btn-sm btn-ghost';
        btn.title='Installed';btn.disabled=true;
        installed.add(item.id);
        await renderExtensions();
      }catch(e){
        btn.textContent='Retry';btn.disabled=false;
        showToast('Install failed: '+e.message,'error');
      }
    };
  }
  row.appendChild(btn);list.appendChild(row);
}

async function installExtFromUrl(){
  const url=window.prompt('Extension JS URL:','');if(!url||!url.trim())return;
  try{
    await Plugins.installFromUrl(url.trim());
    await renderExtensions();
    if(_idxLoaded)_renderIndexPanel(_idxItems);
  }catch(e){showToast('Install failed: '+e.message,'error');}
}

async function browseExtIndex(){
  const panel=document.getElementById('ext-index-panel');if(!panel)return;
  if(panel.classList.contains('show')&&_idxLoaded){panel.classList.remove('show');return;}
  if(!_idxLoaded)_loadIndex();
  else panel.classList.toggle('show');
}

async function refreshIndex(){_idxLoaded=false;await _loadIndex(true);}

function extSearchInit(){
  const inp=document.getElementById('ext-search');
  if(inp&&!inp.dataset.init){
    inp.dataset.init='1';
    inp.addEventListener('input',debounce(e=>{_extSearch=e.target.value;renderExtensions();},300));
  }
}

window.Ext={initExtensions,renderExtensions,installExtFromUrl,browseExtIndex,refreshIndex,extSearchInit};
