'use strict';
async function createBackup(){
  try{
    showLoading('Creating backup...');
    const data=await DB.exportAll();
    const json=JSON.stringify(data,null,2);
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;
    a.download='novela-backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup created!','success');
  }catch(e){showToast('Backup failed: '+e.message,'error');}
  finally{hideLoading();}
}
async function restoreBackup(file){
  if(!file)return;
  try{
    showLoading('Restoring backup...');
    const text=await file.text();
    const data=JSON.parse(text);
    await DB.importAll(data);
    await Settings.load();
    showToast('Backup restored! Reloading...','success');
    setTimeout(()=>window.location.reload(),1200);
  }catch(e){showToast('Restore failed: '+e.message,'error');}
  finally{hideLoading();}
}
function triggerBackupRestore(){const inp=document.createElement('input');inp.type='file';inp.accept='.json';inp.onchange=e=>restoreBackup(e.target.files[0]);inp.click();}
async function triggerEpubImport(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.epub,.fb2';inp.multiple=true;
  inp.onchange=async e=>{
    const files=Array.from(e.target.files);
    for(const f of files){
      showLoading('Importing '+f.name+'...');
      try{await Epub.importFile(f);showToast('Imported: '+f.name,'success');}
      catch(err){showToast('Failed: '+f.name+' - '+err.message,'error');}
      finally{hideLoading();}
    }
    await Library.refreshLibrary();
  };
  inp.click();
}
async function scheduleAutoBackup(){
  const enabled=Settings.get('autoBackupEnabled');if(!enabled)return;
  const interval=(Settings.get('autoBackupInterval')||1440)*60000;
  const last=await DB.getSetting('lastAutoBackup')||0;
  if(Date.now()-last>=interval){await DB.setSetting('lastAutoBackup',Date.now());await createBackup();}
}
window.Backup={createBackup,restoreBackup,triggerBackupRestore,triggerEpubImport,scheduleAutoBackup};
