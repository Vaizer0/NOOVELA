'use strict';
async function globalSearch(query){
  if(!query||!query.trim())return;
  const container=document.getElementById('search-results');
  if(container){container.innerHTML='';const l=document.createElement('div');l.className='loading-state';l.textContent='Searching...';container.appendChild(l);}
  const dbResults=await _searchDB(query);
  const plugins=Plugins.getAll().filter(p=>p.mod&&p.mod.search);
  const pr=await Promise.allSettled(plugins.map(async p=>{const r=await p.mod.search(query);return{plugin:p,results:Array.isArray(r)?r:[]};} ));
  const all=[...dbResults];
  pr.forEach(r=>{if(r.status==='fulfilled')r.value.results.forEach(b=>all.push(Object.assign({},b,{sourceId:r.value.plugin.id,sourceName:r.value.plugin.name,fromPlugin:true})));});
  _renderSearchResults(all,query,container);
}
async function _searchDB(query){
  const q=query.toLowerCase();
  return(await DB.getAllBooks()).filter(b=>(b.title||'').toLowerCase().includes(q)||(b.author||'').toLowerCase().includes(q));
}
function _renderSearchResults(results,query,container){
  if(!container)container=document.getElementById('search-results');
  if(!container)return;container.innerHTML='';
  if(!results.length){
    const e=document.createElement('div');e.className='empty-state';
    const p=document.createElement('p');p.textContent='No results for: '+truncate(query,50);
    e.appendChild(p);container.appendChild(e);return;
  }
  results.forEach(book=>{
    const div=document.createElement('div');div.className='search-result-item';
    if(book.coverUrl||book.thumbnail){const img=document.createElement('img');img.className='search-result-cover';img.dataset.src=book.coverUrl||book.thumbnail;img.alt=book.title||'';img.onerror=function(){imgFallback(this);};div.appendChild(img);}
    const info=document.createElement('div');info.className='search-result-info';
    const tr=document.createElement('div');tr.className='search-result-title';tr.textContent=truncate(book.title||'',60);
    if(book.sourceName){const badge=document.createElement('span');badge.className='source-badge';badge.textContent=book.sourceName;tr.appendChild(badge);}
    const auth=document.createElement('div');auth.className='book-author';auth.textContent=truncate(book.author||'',50);
    info.appendChild(tr);info.appendChild(auth);div.appendChild(info);
    div.addEventListener('click',()=>openBookInfo(book.fromPlugin?null:book.id,book.fromPlugin?book:null,book.sourceId));
    container.appendChild(div);
  });
  lazyLoad(container);
}
function searchInit(){const inp=document.getElementById('global-search-inp');if(inp)inp.addEventListener('input',debounce(e=>globalSearch(e.target.value.trim()),400));}
window.Search={globalSearch,searchInit};
