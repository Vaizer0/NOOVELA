'use strict';
const BUILT_IN_REPO_URL='https://raw.githubusercontent.com/HnDK0/external-sources/refs/heads/main/index.yaml';
let _extSearch='';
let _extIndexItems=[];
let _extIndexLoaded=false;
let _extIndexLoading=false;

async function initExtensions(){
  await renderExtensions();
  // Auto-load the built-in index when Extensions screen first opens
  if(!_extIndexLoaded&&!_extIndexLoading){
    _loadIndex();
  }
}

async function renderExtensions(){
  const container=document.getElementById('ext-list');
  if(!container)return;
  let installed=Plugins.getAll();
  if(_extSearch){const q=_extSearch.toLowerCase();installed=installed.filter(e=>(e.name||'').toLowerCase().includes(q)||(e.lang||'').toLowerCase().includes(q));}
  container.innerHTML='';
  if(!installed.length){
    const e=document.createElement('div');e.className='empty-state';
    const p=document.createElement('p');p.textContent='No extensions installed. Browse sources below.';
    e.appendChild(p);container.appendChild(e);
  }else{
    installed.forEach(ext=>{
      const div=document.createElement('div');div.className='ext-card';
      const info=document.createElement('div');info.className='ext-info';
      const name=document.createElement('div');name.className='ext-name';name.textContent=ext.name;
      const meta=document.createElement('div');meta.className='ext-meta';
      meta.textContent=(ext.lang||'')+(ext.version?' v'+ext.version:'')+(ext.sourceUrl?' — installed':'');
      info.appendChild(name);info.appendChild(meta);
      const btns=document.createElement('div');btns.className='ext-btns';
      const updateBtn=document.createElement('button');updateBtn.className='btn btn-ghost btn-sm';updateBtn.textContent='Update';
      updateBtn.addEventListener('click',async()=>{
        if(!ext.sourceUrl){showToast('No source URL for update','error');return;}
        updateBtn.disabled=true;updateBtn.textContent='...';
        try{await Plugins.installFromUrl(ext.sourceUrl);showToast('Updated: '+ext.name,'success');await renderExtensions();_extIndexLoaded=false;_loadIndex();}
        catch(e){showToast('Update failed: '+e.message,'error');updateBtn.textContent='Update';updateBtn.disabled=false;}
      });
      const unBtn=document.createElement('button');unBtn.className='btn btn-ghost btn-sm';unBtn.textContent='Uninstall';
      unBtn.addEventListener('click',async()=>{
        await Plugins.uninstall(ext.id);
        await renderExtensions();
        // Refresh index to show Install button again
        if(_extIndexLoaded)_renderIndexPanel(_extIndexItems);
        showToast('Uninstalled: '+ext.name,'info');
      });
      btns.appendChild(updateBtn);btns.appendChild(unBtn);
      div.appendChild(info);div.appendChild(btns);container.appendChild(div);
    });
  }
}

async function _loadIndex(forceRefresh){
  if(_extIndexLoading&&!forceRefresh)return;
  _extIndexLoading=true;
  const panel=document.getElementById('ext-index-panel');
  if(panel){
    panel.classList.add('show');
    panel.innerHTML='<div style="padding:12px;text-align:center;color:var(--text2);font-size:13px;">&#128230; Loading repository index...</div>';
  }
  try{
    const items=await Plugins.fetchIndex(BUILT_IN_REPO_URL);
    _extIndexItems=items;
    _extIndexLoaded=true;
    _renderIndexPanel(items);
  }catch(e){
    if(panel)panel.innerHTML='<div style="padding:12px;color:#f88;font-size:13px;">Failed to load index: '+e.message+'<br><br><button class="btn btn-ghost btn-sm" onclick="Ext.refreshIndex()">Retry</button></div>';
  }finally{_extIndexLoading=false;}
}

function _renderIndexPanel(items){
  const panel=document.getElementById('ext-index-panel');
  if(!panel)return;
  panel.classList.add('show');
  panel.innerHTML='';

  // Repo header row
  const hdr=document.createElement('div');
  hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border);gap:8px;';
  const lbl=document.createElement('div');
  lbl.style.cssText='font-size:11px;color:var(--accent);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  lbl.title=BUILT_IN_REPO_URL;
  lbl.textContent='\uD83D\uDCE6 HnDK0/external-sources ('+items.length+' sources)';
  const refreshBtn=document.createElement('button');
  refreshBtn.className='btn btn-ghost btn-sm';refreshBtn.textContent='\u21BA Refresh';
  refreshBtn.addEventListener('click',()=>Ext.refreshIndex());
  hdr.appendChild(lbl);hdr.appendChild(refreshBtn);
  panel.appendChild(hdr);

  if(!items.length){
    const p=document.createElement('p');p.style.cssText='color:var(--text2);font-size:13px;padding:8px;';
    p.textContent='No sources found in index.';panel.appendChild(p);return;
  }

  const installedSet=new Set(Plugins.getAll().map(p=>p.id));
  items.forEach(item=>{
    const row=document.createElement('div');row.className='ext-index-item';
    const info=document.createElement('div');info.style.cssText='flex:1;min-width:0;';
    const n=document.createElement('div');n.className='ext-name';
    n.textContent=item.name+(item.lang?' ['+item.lang+']':'')+(item.version?' v'+item.version:'');
    info.appendChild(n);
    if(item.description){
      const desc=document.createElement('div');
      desc.style.cssText='font-size:11px;color:var(--text2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      desc.textContent=item.description;info.appendChild(desc);
    }
    const btn=document.createElement('button');
    if(installedSet.has(item.id)){
      btn.className='btn btn-sm btn-ghost';btn.textContent='\u2713 Installed';btn.disabled=true;
    }else{
      btn.className='btn btn-sm btn-primary';btn.textContent='Install';
      btn.addEventListener('click',async()=>{
        btn.disabled=true;btn.textContent='...';
        try{
          if(item.sourceUrl)await Plugins.installFromUrl(item.sourceUrl);
          else throw new Error('No sourceUrl in index');
          btn.textContent='\u2713 Installed';btn.className='btn btn-sm btn-ghost';
          showToast('Installed: '+item.name,'success');
          await renderExtensions();
        }catch(e){
          btn.textContent='Failed';btn.className='btn btn-sm btn-ghost';btn.disabled=false;
          showToast('Install failed: '+e.message,'error');
        }
      });
    }
    row.appendChild(info);row.appendChild(btn);
    panel.appendChild(row);
  });
}

async function installExtFromUrl(){
  const url=window.prompt('Extension JS URL:','');if(!url||!url.trim())return;
  showLoading('Installing...');
  try{
    await Plugins.installFromUrl(url.trim());
    await renderExtensions();
    if(_extIndexLoaded)_renderIndexPanel(_extIndexItems);
    showToast('Installed!','success');
  }catch(e){showToast('Install failed: '+e.message,'error');}
  finally{hideLoading();}
}

async function browseExtIndex(){
  const panel=document.getElementById('ext-index-panel');
  if(!panel)return;
  if(panel.classList.contains('show')&&_extIndexLoaded){panel.classList.remove('show');return;}
  if(!_extIndexLoaded&&!_extIndexLoading)_loadIndex();
  else if(_extIndexLoaded){panel.classList.add('show');_renderIndexPanel(_extIndexItems);}
}

async function refreshIndex(){
  _extIndexLoaded=false;
  await _loadIndex(true);
}

function extSearchInit(){
  const inp=document.getElementById('ext-search');
  if(inp)inp.addEventListener('input',debounce(e=>{_extSearch=e.target.value;renderExtensions();},300));
}

window.Ext={initExtensions,renderExtensions,installExtFromUrl,browseExtIndex,refreshIndex,extSearchInit};
