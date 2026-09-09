'use strict';
const Epub={
  async importFile(file){
    const name=file.name.toLowerCase();
    const di=file.name.lastIndexOf('.');let title=di>0?file.name.slice(0,di):file.name,author='',text='';
    if(name.endsWith('.fb2')){
      const xml=await file.text();
      const doc=new DOMParser().parseFromString(xml,'application/xml');
      const te=doc.getElementsByTagName('book-title')[0];if(te)title=te.textContent.trim();
      const ae=doc.getElementsByTagName('first-name')[0];const le=doc.getElementsByTagName('last-name')[0];
      if(ae||le)author=((ae?ae.textContent:'')+' '+(le?le.textContent:'')).trim();
      text=Array.from(doc.querySelectorAll('body section p,body p')).map(p=>p.textContent.trim()).join('\n\n');
    }else if(name.endsWith('.epub')){
      if(typeof JSZip==='undefined')await this._loadJSZip();
      const zip=await JSZip.loadAsync(await file.arrayBuffer());
      const opfPath=await this._findOpf(zip);const texts=[];
      if(opfPath){
        const opf=await zip.file(opfPath).async('text');
        const doc=new DOMParser().parseFromString(opf,'application/xml');
        const mt=doc.getElementsByTagName('dc:title')[0]||doc.getElementsByTagName('title')[0];if(mt)title=mt.textContent.trim();
        const ma=doc.getElementsByTagName('dc:creator')[0]||doc.getElementsByTagName('creator')[0];if(ma)author=ma.textContent.trim();
        const base=opfPath.includes('/')?opfPath.slice(0,opfPath.lastIndexOf('/')+1):'';
        for(const item of Array.from(doc.querySelectorAll('manifest item')).slice(0,50)){
          const mt2=item.getAttribute('media-type')||'';const href=item.getAttribute('href')||'';
          if(mt2==='application/xhtml+xml'||href.endsWith('.html')||href.endsWith('.xhtml')){
            const fp=base+href;const f=zip.file(fp)||zip.file(decodeURIComponent(fp));
            if(f){const html=await f.async('text');const d=new DOMParser().parseFromString(html,'text/html');texts.push(d.body?d.body.innerText||d.body.textContent||'':'');}
          }
        }
      }else{
        for(const n of Object.keys(zip.files).filter(n=>n.endsWith('.html')||n.endsWith('.xhtml')||n.endsWith('.htm')).slice(0,50)){
          const html=await zip.files[n].async('text');const d=new DOMParser().parseFromString(html,'text/html');texts.push(d.body?d.body.textContent||'':'');
        }
      }
      text=texts.join('\n\n');
    }else{text=await file.text();}
    if(!text.trim())throw new Error('Could not extract text from '+file.name);
    const book={title,author,type:'novel',source:'local',addedAt:Date.now(),updatedAt:Date.now()};
    const saved=await DB.saveBook(book);
    const chUrl='local:'+saved.id+':ch1';
    await DB.saveChapterContent(chUrl,text);
    await DB.saveChapters(saved.id,[{url:chUrl,title,index:0}]);
    return saved;
  },
  async _findOpf(zip){
    const c=zip.file('META-INF/container.xml');
    if(c){const xml=await c.async('text');const d=new DOMParser().parseFromString(xml,'application/xml');const rf=d.querySelector('rootfile');if(rf)return rf.getAttribute('full-path');}
    return Object.keys(zip.files).find(n=>n.endsWith('.opf'))||null;
  },
  async _loadJSZip(){return new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});},
};
window.Epub=Epub;
