'use strict';
let _libBooks=[],_libSort='updatedAt',_libFilter='all',_libSearch='',_libView='grid',_libSelected=new Set();
async function initLibrary(){await refreshLibrary();}
async function refreshLibrary(){_libBooks=await DB.getAllBooks();renderLibrary();}
function renderLibrary(){
  const container=document.getElementById('lib-grid');if(!container)return;
  let books=[..._libBooks];
  if(_libSearch){const q=_libSearch.toLowerCase();books=books.filter(b=>(b.title||'').toLowerCase().includes(q)||(b.author||'').toLowerCase().includes(q));}
  if(_libFilter==='downloaded')books=books.filter(b=>b.downloaded);
  else if(_libFilter==='unread')books=books.filter(b=>!b.lastReadAt);
  else if(_libFilter&&_libFilter.startsWith('cat:'))books=books.filter(b=>b.categoryId===_libFilter.slice(4));
  books.sort((a,b)=>{
    if(_libSort==='title')return(a.title||'').localeCompare(b.title||'');
    if(_libSort==='titleDesc')return(b.title||'').localeCompare(a.title||'');
    if(_libSort==='addedAt')return(b.addedAt||0)-(a.addedAt||0);
    return(b.updatedAt||0)-(a.updatedAt||0);
  });
  container.innerHTML='';
  container.className='lib-container '+(_libView==='list'?'lib-list':'lib-grid-wrap');
  if(!books.length){
    const empty=document.createElement('div');empty.className='empty-state';
    const p=document.createElement('p');p.textContent='Library is empty. Add books from the Find tab!';
    empty.appendChild(p);container.appendChild(empty);return;
  }
  books.forEach(book=>{const card=_libView==='list'?_bookCardList(book):_bookCardGrid(book);container.appendChild(card);});
  lazyLoad(container);
}
function _bookCardGrid(book){
  const div=document.createElement('div');div.className='book-card'+(_libSelected.has(book.id)?' selected':'');
  const cover=document.createElement('div');cover.className='book-cover';
  if(book.coverUrl){const img=document.createElement('img');img.dataset.src=book.coverUrl;img.alt=book.title||'';img.onerror=function(){imgFallback(this);};cover.appendChild(img);}
  else{cover.textContent=(book.title||'?')[0].toUpperCase();cover.classList.add('book-cover-placeholder');}
  const info=document.createElement('div');info.className='book-card-info';
  const titleEl=document.createElement('div');titleEl.className='book-card-title';titleEl.textContent=truncate(book.title||'',50);
  const authorEl=document.createElement('div');authorEl.className='book-card-author';authorEl.textContent=truncate(book.author||'',40);
  info.appendChild(titleEl);info.appendChild(authorEl);
  div.appendChild(cover);div.appendChild(info);
  div.addEventListener('click',()=>Catalog.openBookInfo(book.id,null,null));
  if(typeof longPressInit!=='undefined')longPressInit(div,()=>{if(_libSelected.has(book.id))_libSelected.delete(book.id);else _libSelected.add(book.id);renderLibrary();});
  return div;
}
function _bookCardList(book){
  const div=document.createElement('div');div.className='book-list-item'+(_libSelected.has(book.id)?' selected':'');
  if(book.coverUrl){const img=document.createElement('img');img.className='book-list-cover';img.dataset.src=book.coverUrl;img.alt=book.title||'';img.onerror=function(){imgFallback(this);};div.appendChild(img);}
  const info=document.createElement('div');info.className='book-list-info';
  const titleEl=document.createElement('div');titleEl.className='book-title';titleEl.textContent=truncate(book.title||'',60);
  const authorEl=document.createElement('div');authorEl.className='book-author';authorEl.textContent=truncate(book.author||'',50);
  info.appendChild(titleEl);info.appendChild(authorEl);div.appendChild(info);
  div.addEventListener('click',()=>Catalog.openBookInfo(book.id,null,null));
  return div;
}
function libSetSort(s){_libSort=s;renderLibrary();}
function libSetFilter(f){_libFilter=f;renderLibrary();}
function libSetView(v){_libView=v;renderLibrary();}
function libSearch(q){_libSearch=q;renderLibrary();}
async function libDeleteSelected(){
  if(!_libSelected.size)return;
  if(!confirm('Delete '+_libSelected.size+' book(s)?'))return;
  for(const id of _libSelected)await DB.deleteBook(id);
  _libSelected.clear();await refreshLibrary();
}
window.Library={initLibrary,refreshLibrary,renderLibrary,libSetSort,libSetFilter,libSetView,libSearch,libDeleteSelected};
