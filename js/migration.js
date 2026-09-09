'use strict';
let _migBooks=[],_migSource=null,_migTarget=null;
async function initMigration(){
  const container=document.getElementById('mig-content');if(!container)return;
  const plugins=Plugins.getAll();
  _migBooks=await DB.getAllBooks();
  container.innerHTML='';
  if(plugins.length<2){
    const e=document.createElement('div');e.className='empty-state';
    const p=document.createElement('p');p.textContent='Install at least 2 extensions to use migration.';
    e.appendChild(p);container.appendChild(e);return;
  }
  const mkSelect=(label,onchange)=>{
    const div=document.createElement('div');div.className='mig-section';
    const h=document.createElement('h3');h.textContent=label;div.appendChild(h);
    const sel=document.createElement('select');sel.className='select';
    const opt0=document.createElement('option');opt0.value='';opt0.textContent='Select...';sel.appendChild(opt0);
    plugins.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;sel.appendChild(o);});
    sel.addEventListener('change',e=>onchange(e.target.value));
    div.appendChild(sel);return div;
  };
  container.appendChild(mkSelect('Source Extension',v=>{_migSource=v;_renderMigBooks();}));
  container.appendChild(mkSelect('Target Extension',v=>_migTarget=v));
  const bookList=document.createElement('div');bookList.id='mig-book-list';bookList.className='mig-book-list';container.appendChild(bookList);
  const btn=document.createElement('button');btn.className='btn btn-primary mig-btn';btn.textContent='Start Migration';
  btn.addEventListener('click',()=>startMigration());
  container.appendChild(btn);
}
function _renderMigBooks(){
  const list=document.getElementById('mig-book-list');if(!list)return;list.innerHTML='';
  const books=_migBooks.filter(b=>b.sourceId===_migSource);
  if(!books.length){const p=document.createElement('p');p.textContent='No books from this source.';list.appendChild(p);return;}
  books.forEach(book=>{
    const div=document.createElement('div');div.className='mig-book-item';
    const cb=document.createElement('input');cb.type='checkbox';cb.id='mig-'+book.id;cb.value=book.id;
    const label=document.createElement('label');label.htmlFor='mig-'+book.id;label.textContent=book.title;
    div.appendChild(cb);div.appendChild(label);list.appendChild(div);
  });
}
async function startMigration(){
  if(!_migSource||!_migTarget){showToast('Select source and target','error');return;}
  if(_migSource===_migTarget){showToast('Source and target must be different','error');return;}
  const checks=Array.from(document.querySelectorAll('#mig-book-list input:checked'));
  if(!checks.length){showToast('Select at least one book','error');return;}
  showLoading('Migrating...');let migrated=0,errors=0;
  for(const c of checks){
    try{
      const book=await DB.getBook(c.value);if(!book)continue;
      const nb=Object.assign({},book,{sourceId:_migTarget,addedAt:Date.now(),updatedAt:Date.now()});
      delete nb.id;await DB.saveBook(nb);migrated++;
    }catch(e){errors++;console.error('Migration error:',e);}
  }
  hideLoading();
  showToast('Migrated '+migrated+' books'+(errors?' ('+errors+' errors)':''),'success');
  await Library.refreshLibrary();
}
window.Migration={initMigration,startMigration};
