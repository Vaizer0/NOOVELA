'use strict';
const LANG_NAMES={en:'English',ru:'Russian',zh:'Chinese (Simplified)',ja:'Japanese',ko:'Korean',ar:'Arabic',de:'German',fr:'French',es:'Spanish',pt:'Portuguese',it:'Italian',pl:'Polish',hi:'Hindi',th:'Thai',id:'Indonesian',ms:'Malay',tr:'Turkish',vi:'Vietnamese',nl:'Dutch',sv:'Swedish',uk:'Ukrainian',cs:'Czech',ro:'Romanian',hu:'Hungarian',el:'Greek',he:'Hebrew',fa:'Persian',bn:'Bengali',fil:'Filipino'};
const TRANS_CACHE=new Map();
class TranslationEngine{
  async translate(text,opts){
    if(!text||!text.trim())return text;
    opts=opts||{};
    const provider=opts.provider||(typeof Settings!=='undefined'?Settings.get('translateProvider'):'google_simple');
    const tl=opts.targetLang||(typeof Settings!=='undefined'?Settings.get('translateTargetLang'):'en');
    const sl=opts.sourceLang||(typeof Settings!=='undefined'?Settings.get('translateSourceLang'):'auto');
    const apiKey=opts.apiKey||(typeof Settings!=='undefined'?Settings.get('translateApiKey'):'');
    const endpoint=opts.endpoint||(typeof Settings!=='undefined'?Settings.get('translateApiEndpoint'):'');
    const model=opts.model||(typeof Settings!=='undefined'?Settings.get('translateModelName'):'');
    const ck=provider+':'+sl+':'+tl+':'+text.slice(0,80);
    if(TRANS_CACHE.has(ck))return TRANS_CACHE.get(ck);
    let result=text;
    try{
      if(provider==='gemini')result=await this._gemini(text,tl,apiKey,model||'gemini-pro');
      else if(provider==='openai')result=await this._openai(text,tl,apiKey,endpoint,model||'gpt-3.5-turbo');
      else result=await this._googleSimple(text,tl,sl);
    }catch(e){console.error('Translation error:',e);}
    TRANS_CACHE.set(ck,result);return result;
  }
  async translateBatch(texts,opts){
    if(!texts||!texts.length)return texts;
    const batchSize=(typeof Settings!=='undefined'?Settings.get('translateBatchSize'):60)||60;
    const SEP='<|SEP|>';const results=[];
    for(let i=0;i<texts.length;i+=batchSize){
      const batch=texts.slice(i,i+batchSize);
      const joined=batch.join('\n'+SEP+'\n');
      const translated=await this.translate(joined,opts);
      const parts=translated.split(SEP);
      for(let j=0;j<batch.length;j++)results.push(parts[j]?parts[j].trim():batch[j]);
    }
    return results;
  }
  async _googleSimple(text,tl,sl){
    sl=sl||'auto';
    const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl='+encodeURIComponent(sl)+'&tl='+encodeURIComponent(tl)+'&dt=t&q='+encodeURIComponent(text);
    let r;
    try{const resp=await fetch(url);r=await resp.json();}catch(e){const proxy='https://api.allorigins.win/raw?url='+encodeURIComponent(url);const resp=await fetch(proxy);r=await resp.json();}
    if(!r||!r[0])throw new Error('Empty translation response');
    return r[0].map(s=>s[0]||'').join('');
  }
  async _gemini(text,tl,apiKey,model){
    if(!apiKey)throw new Error('Gemini API key required');
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+(model||'gemini-pro')+':generateContent?key='+encodeURIComponent(apiKey);
    const prompt='Translate to '+(LANG_NAMES[tl]||tl)+'. Preserve all formatting. Return ONLY the translation:\n\n'+text;
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
    if(!resp.ok)throw new Error('Gemini HTTP '+resp.status);
    const d=await resp.json();
    const t=d&&d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts&&d.candidates[0].content.parts[0]&&d.candidates[0].content.parts[0].text;
    if(!t)throw new Error('No Gemini result');return t.trim();
  }
  async _openai(text,tl,apiKey,endpoint,model){
    if(!apiKey)throw new Error('API key required');
    let base=(endpoint||'https://api.openai.com/v1').replace(/\/+$/,'');
    const resp=await fetch(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify({model:model||'gpt-3.5-turbo',messages:[{role:'system',content:'Translate to '+(LANG_NAMES[tl]||tl)+'. Preserve formatting. Return ONLY the translation.'},{role:'user',content:text}],max_tokens:4096})});
    if(!resp.ok)throw new Error('OpenAI HTTP '+resp.status);
    const d=await resp.json();
    const t=d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
    if(!t)throw new Error('No OpenAI result');return t.trim();
  }
  clearCache(){TRANS_CACHE.clear();}
  getCacheSize(){return TRANS_CACHE.size;}
  getLangs(){return LANG_NAMES;}
  getLangName(code){return LANG_NAMES[code]||code;}
}
window.Translation=new TranslationEngine();
