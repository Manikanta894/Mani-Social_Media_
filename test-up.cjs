const fs=require('fs');const raw=fs.readFileSync('D:/Portfolio/Ishaan Social Forage/.env.local','utf8');const lines=raw.split(/\r?\n/);let i=0;while(i<lines.length){let l=lines[i].trim();i++;if(!l||l.startsWith('#'))continue;let m=l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);if(!m)continue;let v=m[2];if(v.startsWith('"')){let b=v;while(!b.endsWith('"')&&i<lines.length){b+='\n'+lines[i];i++};v=b.slice(1,b.endsWith('"')?-1:b.length)}else v=v.replace(/^'|'$/g,'');process.env[m[1]]=v}
;(async()=>{
const gs=require('D:/Portfolio/Ishaan Social Forage/lib/gsheets.js')
try{
  const buf=await gs.driveDownload('1NIqISJkw1OoC1N5XYEVdelX41K1CcxkU')
  const up=await gs.driveUpload('test-upload.png','image/png',buf,null)
  console.log('Upload OK:',JSON.stringify(up).slice(0,200))
  await gs.driveDelete(up.id).catch(()=>{})
  console.log('cleanup done')
}catch(e){console.log('FAIL:',e.message)}
})().catch(e=>console.log('FATAL',e.message))