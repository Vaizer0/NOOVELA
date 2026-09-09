'use strict';
let _extSearch='';
async function initExtensions(){await renderExtensions();}
async function renderExtensions(){
  const container=document.getElementById('ext-list');if(!container)return;
  let installed=Plugins.getAll();
  if(_extSearch){const q=_extSearch.toLowerCase();installed=installed.filter(e=>(e.name||'').toLowerCase().includes(q)||(e.lang||'').toLowerCase().includes(q));}
  container.innerHTML='';
  if(!installed.length){
    const e=document.createElement('div');e.className='empty-state';
    const p=document.createElement('p');p.textContent='No extensions installed. Use the Browse or Install URL button above.';
    e.appendChild(p);container.appendChild(e);return;
  }
  installed.forEach(ext=>{
    const div=document.createElement('div');div.className='ext-card';
    const info=document.createElement('div');info.className='ext-info';
    const name=document.createElement('div');name.className='ext-name';name.textContent=ext.name;
    const meta=document.createElement('div');meta.className='ext-meta';meta.textContent=(ext.lang||'')+(ext.version?' v'+ext.version:'');
    info.appendChild(name);info.appendChild(meta);
    const btns=document.createElement('div');btns.className='ext-btns';
    const btn=document.createElement('button');btn.className='btn btn-ghost btn-sm';btn.textContent='Uninstall';
    btn.addEventListener('click',async()=>{await Plugins.uninstall(ext.id);await renderExtensions();showToast('Uninstalled: '+ext.name,'info');});
    btns.appendChild(btn);div.appendChild(info);div.appendChild(btns);container.appendChild(div);
  });
}
async function installExtFromUrl(){
  const url=window.prompt('Extension URL:','');if(!url||!url.trim())return;
  showLoading('Installing...');
  try{await Plugins.installFromUrl(url.trim());await renderExtensions();showToast('Installed!','success');}
  catch(e){showToast('Install failed: '+e.message,'error');}
  finally{hideLoading();}
}
async function browseExtIndex(){
  const panel=document.getElementById('ext-index-panel');if(!panel)return;
  panel.classList.toggle('show');
  if(panel.classList.contains('show')&&!panel.hasAttribute('data-loaded')){
    panel.setAttribute('data-loaded','1');panel.innerHTML='';
    const list=document.createElement('div');list.className='ext-index-list';list.textContent='Loading index...';panel.appendChild(list);
    try{
      const items=await Plugins.fetchIndex();
      list.innerHTML='';
      if(!items.length){list.textContent='No extensions in index';return;}
      items.forEach(item=>{
        const row=document.createElement('div');row.className='ext-index-item';
        const n=document.createElement('span');n.className='ext-name';n.textContent=item.name+(item.lang?' ['+item.lang+']':'');
        const btn=document.createElement('button');btn.className='btn btn-sm btn-primary';btn.textContent='Install';
        btn.addEventListener('click',async()=>{
          btn.disabled=true;btn.textContent='...';
          try{if(item.sourceUrl)await Plugins.installFromUrl(item.sourceUrl);await renderExtensions();btn.textContent='Done';}
          catch(e){btn.textContent='Error';btn.disabled=false;showToast('Failed: '+e.message,'error');}
        });
        row.appendChild(n);row.appendChild(btn);list.appendChild(row);
      });
    }catch(e){list.textContent='Failed to load index';}
  }
}
function extSearchInit(){const inp=document.getElementById('ext-search');if(inp)inp.addEventListener('input',debounce(e=>{_extSearch=e.target.value;renderExtensions();},300));}
window.Ext={initExtensions,renderExtensions,installExtFromUrl,browseExtIndex,extSearchInit};
