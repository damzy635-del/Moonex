import { fitConversationContext } from './context-budget.js';
import { providerHealth } from './provider-health.js';

export const DEFAULT_MOONEX_MODEL_ID = 'moonex-lite-1.5';
export const AUTO_MODEL_ID = 'auto';
export const MOONEX_MODELS = [
  { id: 'moonex-lite-1.5', name: 'Moonex Lite 1.5', description: 'Fast everyday conversations using cost-efficient production models.', temperature: .35, maxTokens: 2048, preferredKeywords: ['gpt-5.6-luna','gemini-3.5-flash-lite','gemini-3.1-flash-lite','mistral-small-latest','openai/gpt-oss-20b','llama-3.1-8b-instant'], fallbackIndex: 0 },
  { id: 'moonex-fast-1.5', name: 'Moonex Fast 1.5', description: 'Low-latency answers using fast production models.', temperature: .3, maxTokens: 2048, preferredKeywords: ['gpt-5.6-luna','gemini-3.6-flash','gemini-3.5-flash','mistral-small-latest','openai/gpt-oss-20b'], fallbackIndex: 1 },
  { id: 'moonex-pro-1.5', name: 'Moonex Pro 1.5', description: 'Balanced quality and speed using current frontier-class models.', temperature: .45, maxTokens: 4096, preferredKeywords: ['gpt-5.6-terra','gemini-3.6-flash','gemini-3.7-flash','mistral-medium-latest','mistral-large-latest','openai/gpt-oss-120b'], fallbackIndex: 2 },
  { id: 'moonex-pro-max-1.5', name: 'Moonex Pro Max 1.5', description: 'Higher-quality general reasoning with long-context frontier models.', temperature: .4, maxTokens: 8192, preferredKeywords: ['gpt-5.6-sol','gpt-5.6-terra','gemini-3.1-pro-preview','gemini-2.5-pro','mistral-medium-latest','mistral-large-latest','openai/gpt-oss-120b'], fallbackIndex: 3, requiredCapabilities: ['reasoning'] },
  { id: 'moonex-ultra-1.5', name: 'Moonex Ultra 1.5', description: 'Maximum available general capability from the curated provider pool.', temperature: .35, maxTokens: 12288, preferredKeywords: ['gpt-5.6-sol','gpt-5.6-terra','gemini-3.1-pro-preview','gemini-3.7-flash','mistral-large-latest','mistral-medium-latest','openai/gpt-oss-120b'], fallbackIndex: 4, requiredCapabilities: ['reasoning'] },
  { id: 'moonex-reasoning-1.5', name: 'Moonex Reasoning 1.5', description: 'Deeper reasoning for difficult problems and technical analysis.', temperature: .25, maxTokens: 12288, preferredKeywords: ['gpt-5.6-sol','gpt-5.6-terra','gemini-3.1-pro-preview','gemini-3.7-flash','mistral-medium-latest','openai/gpt-oss-120b'], fallbackIndex: 5, requiredCapabilities: ['reasoning'] },
  { id: 'moonex-code-1.5', name: 'Moonex Code 1.5', description: 'Optimized for programming, debugging, and technical work.', temperature: .2, maxTokens: 8192, preferredKeywords: ['gpt-5.6-sol','gpt-5.6-terra','gemini-3.7-flash','mistral-medium-latest','codestral-latest','openai/gpt-oss-120b'], fallbackIndex: 6, requiredCapabilities: ['tools'] },
  { id: 'moonex-vision-1.5', name: 'Moonex Vision 1.5', description: 'Multimodal tasks and image understanding.', temperature: .35, maxTokens: 4096, preferredKeywords: ['gemini-3.7-flash','gemini-3.6-flash','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','mistral-medium-latest'], fallbackIndex: 7, requiredCapabilities: ['vision'] },
  { id: 'moonex-research-1.5', name: 'Moonex Research 1.5', description: 'Long-form analysis and current-information research using grounded web search.', temperature: .3, maxTokens: 12288, preferredKeywords: ['gemini-3.7-flash','gemini-3.6-flash','gemini-2.5-pro','gemini-2.5-flash'], fallbackIndex: 8, requiredCapabilities: ['search'] },
];

const CAP = {
  reasoning: [/^gpt-5\.6-/,/^gemini-3\.1-pro-preview$/,/^gemini-2\.5-pro$/, /^mistral-(medium|large)-latest$/, /^openai\/gpt-oss-120b$/],
  tools: [/^gpt-5\.6-/,/^gemini-3\.7-flash$/, /^mistral-(medium|large)-latest$/,/^codestral-latest$/, /^openai\/gpt-oss-(20b|120b)$/],
  vision: [/^gpt-5\.6-/,/^gemini-(3\.7-flash|3\.6-flash|3\.5-flash|3\.5-flash-lite|3\.1-flash-lite|2\.5-(flash|flash-lite|pro))$/],
  search: [/^gemini-(3\.7-flash|3\.6-flash|2\.5-(flash|pro))$/],
};
const supports = (p,c) => (CAP[c] || []).some(r => r.test(String(p?.id || '').toLowerCase()));
const supportsRequired = (profile,p) => (profile.requiredCapabilities || []).every(c => p.capabilities && typeof p.capabilities === 'object' ? p.capabilities[c] === true : supports(p,c));

export function isMoonexModelId(value) { if (typeof value !== 'string') return false; const v=value.trim().toLowerCase(); return v===AUTO_MODEL_ID || MOONEX_MODELS.some(m=>m.id===v); }
export function normalizeMoonexModelId(value,fallback=DEFAULT_MOONEX_MODEL_ID) { if(typeof value!=='string') return fallback; const v=value.trim().toLowerCase(); return isMoonexModelId(v)?v:fallback; }
export function findMoonexModel(id) { const v=normalizeMoonexModelId(id); return MOONEX_MODELS.find(m=>m.id===v) || MOONEX_MODELS[0]; }

export function rankProviderModels(profile,providers) {
  if(!Array.isArray(providers)||!providers.length) return [];
  const eligible=providers.filter(p=>supportsRequired(profile,p));
  const pool=eligible.length?eligible:(profile.requiredCapabilities?.length?[]:providers);
  if(!pool.length) return [];
  return pool.map((provider,index)=>{
    const id=String(provider.id||'').toLowerCase();
    const hay=`${id} ${provider.name||''}`.toLowerCase();
    let quality=0;
    for(const [i,k] of profile.preferredKeywords.entries()){ const q=k.toLowerCase(), pref=profile.preferredKeywords.length-i; if(id===q) quality+=100+pref; else if(id.includes(q)) quality+=50+pref; else if(hay.includes(q)) quality+=20+pref; }
    const context=Number(provider.context_length??provider.contextLength??0); if(Number.isFinite(context)&&context>0) quality+=Math.min(10,context/32000);
    const health=providerHealth(provider.provider||provider.provider_name||provider.providerName||provider.owned_by||provider.id);
    return {provider,score:Math.min(100,quality)*.5+health.score*.3+(Number(provider.latency_ms??provider.latencyMs)>0?Math.max(0,Math.min(100,100-Number(provider.latency_ms??provider.latencyMs)/100)):50)*.2,health:health.score,index};
  }).sort((a,b)=>b.score-a.score||b.health-a.health||a.index-b.index).map(x=>x.provider);
}
export function resolveProviderModel(profile,providers){ return rankProviderModels(profile,providers)[0]||null; }

const textOf = c => (c.messages||[]).filter(m=>m.role!=='system').map(m=>typeof m.content==='string'?m.content:'').join('\n').slice(-12000).toLowerCase();
const image = c => (c.messages||[]).some(m=>(m.files||[]).some(f=>String(f.mimeType||'').toLowerCase().startsWith('image/')||f.type==='image'));
const codeFile = c => (c.messages||[]).some(m=>(m.files||[]).some(f=>f?.type==='code'||/\.(ts|tsx|js|jsx|py|json|md|html|css|sql|sh|txt|csv)$/i.test(String(f.name||''))));
const required = c => { const r=[]; if(image(c))r.push('vision'); if(c.enableWebSearch===true)r.push('search'); if(typeof c.thinkingLevel==='string'&&c.thinkingLevel!=='none')r.push('reasoning'); if(codeFile(c))r.push('tools'); return [...new Set(r)]; };
const matches=(t,r,p)=>{const m=t.match(r);return m?Math.min(m.length,5)*p:0;};

// Deterministic fast path for elementary calculations. It runs before general
// complexity scoring so simple expressions cannot be promoted to Pro by heuristics.
const arithmeticIntent = text => {
  const t = String(text || '').replace(/[,$]/g, '').trim();
  const operand = '(?:\\d+(?:\\.\\d+)?)';
  const operator = '(?:[+\\-*/×÷]|plus|minus|times|multiplied by|divided by)';
  const expression = new RegExp(`(?:${operand}\\s*${operator}\\s*${operand})(?:\\s*(?:=|\\?)?)`, 'i');
  return expression.test(t) ||
    /\\b(?:what(?:'s| is)?|calculate|compute)\\s+\\d+(?:\\.\\d+)?\\s*(?:%|percent|percentage)\\s+of\\s+\\d+(?:\\.\\d+)?\\b/i.test(t);
};

export function decideMoonexRoute(context={}) {
  const text=textOf(context), words=text?text.split(/\s+/).filter(Boolean).length:0, complexity=Math.min(1,text.length/1800*.55+words/260*.45), req=required(context);
  if(image(context))return{profile:findMoonexModel('moonex-vision-1.5'),confidence:.99,reason:'multimodal input requires vision capability',mode:'auto'};
  if(context.enableWebSearch===true||/\b(latest|current|today|yesterday|tomorrow|this week|this month|news|research|sources?|citations?|look up|web search|recent|2026)\b/.test(text))return{profile:findMoonexModel('moonex-research-1.5'),confidence:.99,reason:'current-information or research intent detected',mode:'auto'};
  if(arithmeticIntent(text))return{profile:findMoonexModel('moonex-lite-1.5'),confidence:.99,reason:'straightforward arithmetic task detected',mode:'auto'};
  const code=matches(text,/\b(write|build|create|implement|refactor|debug|fix|code|coding|program|function|api|react|typescript|javascript|python|sql|authentication|auth|component|app|website|regex|css|html|git|github|bug|error|compile|deploy)\b/g,5);
  const reasoning=matches(text,/\b(algorithm|algorithms|prove|proof|derive|architecture|trade-?offs?|analy[sz]e|complex|difficult|deeply|reason|logic|evaluate|critique|compare|optimize|optimization|mathematical)\b/g,5);
  const creative=matches(text,/\b(story|poem|creative|brainstorm|character|script|fiction|imagine|slogan|caption|rewrite|draft)\b/g,4);
  const simple=matches(text,/\b(what is|define|meaning|translate|summarize|quick|simple|calculate|convert|explain)\b/g,3);
  const scores=new Map(MOONEX_MODELS.map(m=>[m.id,0]));
  scores.set('moonex-code-1.5',code*2.1); scores.set('moonex-reasoning-1.5',reasoning*2.2); scores.set('moonex-ultra-1.5',reasoning+complexity*8); scores.set('moonex-pro-max-1.5',reasoning*.8+complexity*6); scores.set('moonex-pro-1.5',complexity*7+creative); scores.set('moonex-fast-1.5',simple+(complexity<.25?3:0)); scores.set('moonex-lite-1.5',simple*1.2+(words<=24?3:0));
  if(context.thinkingLevel==='high'){scores.set('moonex-reasoning-1.5',(scores.get('moonex-reasoning-1.5')||0)+8);scores.set('moonex-ultra-1.5',(scores.get('moonex-ultra-1.5')||0)+5);}
  const ranked=[...scores.entries()].map(([id,score])=>({id,score,profile:findMoonexModel(id)})).filter(x=>!req.length||(x.profile.requiredCapabilities||[]).every(c=>req.includes(c))).sort((a,b)=>b.score-a.score||a.profile.fallbackIndex-b.profile.fallbackIndex);
  if(!ranked.length)return{profile:findMoonexModel(DEFAULT_MOONEX_MODEL_ID),confidence:.5,reason:'no specialized profile satisfied the detected capabilities',mode:'auto'};
  const [winner,runner]=ranked, margin=Math.max(0,winner.score-(runner?.score||0)), confidence=Math.max(.5,Math.min(.97,.54+margin/22+complexity*.1));
  const low=confidence<.68, simpleWinner=winner.profile.id==='moonex-lite-1.5'||winner.profile.id==='moonex-fast-1.5';
  const profile=low&&!simpleWinner&&complexity<.45&&code<6&&reasoning<6?findMoonexModel('moonex-pro-1.5'):winner.profile;
  const reason=low&&!simpleWinner?'ambiguous prompt; selected balanced profile to avoid over-routing':profile.id==='moonex-code-1.5'?'software or technical intent detected':['moonex-reasoning-1.5','moonex-ultra-1.5','moonex-pro-max-1.5'].includes(profile.id)?'deep reasoning or complex analysis detected':profile.id==='moonex-pro-1.5'?'moderate complexity or creative/general work detected':profile.id==='moonex-lite-1.5'?'short or straightforward task detected':'fast general task detected';
  return{profile,confidence:Number(confidence.toFixed(2)),reason,mode:'auto'};
}
export function classifyMoonexTask(context){return decideMoonexRoute(context).profile;}
function applyConversationBudget(context,profile){if(!context||!Array.isArray(context.messages)||context.messages.length<2)return;const systemMessages=context.messages.filter(m=>m?.role==='system'),conversation=context.messages.filter(m=>m?.role!=='system');const result=fitConversationContext(conversation,{maxInputTokens:32000,reservedOutputTokens:Math.min(profile.maxTokens||0,12288),systemMessages});context.messages=result.messages;context.contextBudget={estimatedInputTokens:result.estimatedInputTokens,truncated:result.truncated,droppedMessages:result.droppedMessages};}
export function resolveMoonexProfile(modelId,context={}){let profile;if(normalizeMoonexModelId(modelId)===AUTO_MODEL_ID)profile=classifyMoonexTask(context);else{const requested=findMoonexModel(modelId),req=required(context);if(!req.length||(requested.requiredCapabilities||[]).every(c=>req.includes(c)))profile=requested;else if(req.includes('vision'))profile=findMoonexModel('moonex-vision-1.5');else if(req.includes('search'))profile=findMoonexModel('moonex-research-1.5');else if(req.includes('reasoning'))profile=findMoonexModel('moonex-reasoning-1.5');else if(req.includes('tools'))profile=findMoonexModel('moonex-code-1.5');else profile=requested;}applyConversationBudget(context,profile);return profile;}
