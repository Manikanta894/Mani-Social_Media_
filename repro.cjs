const KEY='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'
;(async()=>{
// Mimic the generation prompt (large, JSON output)
const prompt=`You are a world-class social media content strategist. Generate a complete content package for EVERY platform listed below.

TOPIC: Visual storytelling and creative content
TONE: professional

Generate ALL of the following fields as a single JSON object:
1. "PLATFORM_CAPTIONS": Must include ALL 5 platforms: linkedin, instagram, facebook, threads, twitter
2. "CAPTION_VARIATIONS"
3. "HOOKS": Array of exactly 5
4. "CTA"
5. "HASHTAGS": { "ten": [...], "twenty": [...], "trending": [...], "niche": [...] }
6. "CAROUSEL_CONTENT": Array of exactly 5
7. "STORY_CAPTION"
8. "REEL_CAPTION"
9. "POLL"
10. "FAQ": Array of exactly 5
11. "FIRST_COMMENT"
12. "ALT_TEXT"
13. "SEO_KEYWORDS"
Respond with valid JSON only. No markdown fences.`
try{
  const t0=Date.now()
  const r=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY},body:JSON.stringify({model:'meta/llama-3.3-70b-instruct',messages:[{role:'user',content:prompt}],max_tokens:2000})})
  const txt=await r.text()
  console.log('status:',r.status,'in',(Date.now()-t0)/1000+'s')
  console.log('body:',txt.slice(0,400))
}catch(e){console.log('fetch error:',e.message,e.cause?e.cause.message:'')}
})().catch(e=>console.log('FATAL',e.message))