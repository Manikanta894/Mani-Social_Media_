const fs=require('fs');const crypto=require('crypto')
function loadEnv(file){if(!fs.existsSync(file))return;const raw=fs.readFileSync(file,'utf8');const lines=raw.split(/\r?\n/);let i=0;while(i<lines.length){let l=lines[i].trim();i++;if(!l||l.startsWith('#'))continue;let m=l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);if(!m)continue;let v=m[2];if(v.startsWith('"')){let b=v;while(!b.endsWith('"')&&i<lines.length){b+='\n'+lines[i];i++};v=b.slice(1,b.endsWith('"')?-1:b.length)}else v=v.replace(/^'|'$/g,'');process.env[m[1]]=v}}
loadEnv('D:/Portfolio/Ishaan Social Forage/.env.local');loadEnv('D:/Portfolio/Ishaan Social Forage/.env')
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
const uuid=()=>crypto.randomUUID()
;(async()=>{
const gs=require('D:/Portfolio/Ishaan Social Forage/lib/gsheets.js')
const token=process.env.TELEGRAM_BOT_TOKEN;const chatId=process.env.TELEGRAM_ADMIN_CHAT_ID
if(!token||!chatId){console.log('No tg config');return}

// Reset stuck processing item  
const pq=await gs.readValues('Publishing Queue','A1:V50')
for(let r=1;r<pq.length;r++){if(pq[r]&&pq[r][3]==='processing'){await gs.writeValues('Publishing Queue',[[pq[r][0],pq[r][1],pq[r][2],'queued','','',pq[r][6],pq[r][7],pq[r][8],'','','','','','','','','0','3','','']],'A'+(r+1));console.log('Reset processing -> queued:',pq[r][2])}}

// Process all queued files
let count=0
for(let r=1;r<pq.length;r++){
  const row=pq[r];if(!row||!row[0]||row[3]!=='queued')continue
  const fileId=row[1];const fileName=row[2]||'image.png'
  try{
    // Download from Drive
    const buf=await gs.driveDownload(fileId)
    // Upload to public media (root of Drive - accessible via /api/media/:id)
    const mediaFolder=process.env.GOOGLE_DRIVE_MEDIA_FOLDER_ID||null
    const upFile=await gs.driveUpload('pub_'+fileName,'image/png',buf,mediaFolder)
    const pubUrl=`https://social.manikantar.in/api/media/${upFile.id}`

    // Create content job in Posts sheet
    const jobId=uuid();const now=new Date().toISOString()
    const posts=JSON.stringify({
      linkedin:{caption:`New post: ${fileName} — generated content pending. Approve to publish.`,hashtags:['#SocialForge','#Content']},
      instagram:{caption:`✨ ${fileName}`,hashtags:['#SocialForge','#Instagram']},
      facebook:{caption:`${fileName} — check it out!`,hashtags:['#SocialForge']},
      threads:{caption:`${fileName}`,hashtags:['#SocialForge']}})
    await gs.appendValues('Posts',[[jobId,'ai_intake',`Processing ${fileName}`,'','',pubUrl,'','','',posts,'[]','pending_approval','','','','','','',now,now]])

    // Send Telegram photo card
    const text=`🎨 <b>New Content Ready</b>\n\n<b>File:</b> ${esc(fileName)}\n<b>Status:</b> Pending Approval\n\nApprove to publish to all platforms.`
    const kb={inline_keyboard:[[
      {text:'✅ Approve',callback_data:`appv:${jobId}`},
      {text:'🚀 Publish Now',callback_data:`pubn:${jobId}`},
      {text:'❌ Reject',callback_data:`rejt:${jobId}`}
    ]]}
    try{
      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,photo:pubUrl,caption:text,parse_mode:'HTML',reply_markup:kb})})
    }catch(e){}
    count++
    console.log(`Sent: ${fileName}`)
  }catch(e){console.log(`FAIL ${fileName}: ${e.message}`)}
}
console.log(`Done — ${count} cards sent to Telegram`)
})().catch(e=>console.log('FATAL',e.message))