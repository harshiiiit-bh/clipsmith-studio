const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const clean = value => String(value ?? '').replace(/[\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim();
const normalize = value => clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const wordCount = value => clean(value).split(/\s+/).filter(Boolean).length;
const CATCH_WORDS = new Set(['secret','mistake','never','always','truth','shocking','finally','actually','impossible','best','worst','why','how','what','wait','stop','look','listen','revealed','changed','changes','because','nobody','everyone','hidden','fastest','biggest','surprising','unexpected','believe','realize','realised','reveal','wrong','right','danger','warning','important','powerful','proven','love','hate','win','lose','fail','success','fear','must']);
const DEFAULT_FILLERS = ['um','uh','erm','hmm','ah','like','basically','literally','actually','you know','i mean','sort of','kind of','haina','matlab','umm','uhh'];

function normalizeCues(cues) {
  return (Array.isArray(cues) ? cues : []).map((cue,index)=>({index,start:Number(cue?.start),end:Number(cue?.end),text:clean(cue?.text)})).filter(cue=>Number.isFinite(cue.start)&&Number.isFinite(cue.end)&&cue.start>=0&&cue.end>cue.start&&cue.text);
}

function scoreCue(text, cues, index) {
  const original=clean(text),value=normalize(original),words=value.split(/\s+/).filter(Boolean),unique=new Set(words);
  let score=.18, signals=[];
  const matched=[...unique].filter(word=>CATCH_WORDS.has(word));
  if(matched.length){score+=Math.min(.3,.11*matched.length);signals.push(`Hook language: ${matched.slice(0,3).join(', ')}`)}
  if(/[?!？！]/.test(original)){score+=.13;signals.push('Question or strong punctuation')}
  if(/\b\d+(?:\.\d+)?%?\b/.test(value)){score+=.07;signals.push('Specific number or statistic')}
  if(/\b(you|your|tum|tera|aap|dekho|imagine|pov|notice)\b/i.test(value)){score+=.07;signals.push('Speaks directly to the viewer')}
  if(/\b(but|however|until|then|suddenly|instead|finally|because|lekin|magar|par)\b/i.test(value)){score+=.07;signals.push('Contrast or payoff language')}
  if(words.length>=3&&words.length<=14){score+=.08;signals.push('Compact subtitle line')}
  if(words.length>0&&words.length<=3)score+=.025;
  if(/\b(i|we|you|he|she|they)\b/i.test(value)&&/[.!?]$/.test(original))score+=.03;
  const previous=index>0?normalize(cues[index-1].text):'', next=index+1<cues.length?normalize(cues[index+1].text):'';
  if(previous&&previous===value){score-=.12;signals.push('Repeated line')}
  if(next&&next===value){score-=.08;signals.push('Repeated line')}
  return {score:Number(clamp(score,0,1).toFixed(3)),signals};
}

/** Ranks highlight windows using explainable, local transcript signals; not a prediction of virality. */
export function findHighlightMoments(input, options = {}) {
  const cues=normalizeCues(input);if(!cues.length)return [];
  const duration=Math.max(0,Number(options.duration)||Math.max(...cues.map(c=>c.end)));if(!Number.isFinite(duration)||duration<=0)return [];
  const target=Math.max(5,Math.min(180,Number(options.targetDuration)||30)),maxResults=Math.max(1,Math.min(12,Math.floor(Number(options.maxResults)||5)));
  const ranked=cues.map((cue,index)=>({...cue,...scoreCue(cue.text,cues,index)})).filter(cue=>cue.start<duration&&cue.end>0).map(cue=>{
    let start=Math.max(0,cue.start-Math.min(5,target*.18)),end=Math.min(duration,Math.max(cue.end,start+target));
    if(end-start<Math.min(target,duration))start=Math.max(0,end-target);
    if(cue.start<start)start=cue.start;if(cue.end>end)end=Math.min(duration,cue.end);
    return {start:Number(start.toFixed(3)),end:Number(end.toFixed(3)),score:cue.score,hookText:cue.text,signals:cue.signals,cueIndex:cue.index};
  }).filter(candidate=>candidate.end>candidate.start).sort((a,b)=>b.score-a.score||a.start-b.start);
  const chosen=[];for(const candidate of ranked){if(chosen.some(item=>Math.min(item.end,candidate.end)-Math.max(item.start,candidate.start)>Math.min(item.end-item.start,candidate.end-candidate.start)*.62))continue;chosen.push(candidate);if(chosen.length>=maxResults)break}
  return chosen.sort((a,b)=>a.start-b.start).map((item,index)=>({...item,id:`highlight-${index+1}`}));
}

/** Flag filler words, repeated subtitle lines, and silences between subtitle cues. */
export function auditTranscript(input, options = {}) {
  const cues=normalizeCues(input),fillers=(Array.isArray(options.fillerWords)?options.fillerWords:DEFAULT_FILLERS).map(normalize).filter(Boolean);
  const fillerSource=fillers.map(word=>word.replace(/[^\p{L}\p{N} ]/gu,'').trim().replace(/\s+/g,'\\s+')).filter(Boolean).join('|');
  const fillerPattern=fillerSource?new RegExp(`(^|[^\\p{L}\\p{N}])(${fillerSource})(?=$|[^\\p{L}\\p{N}])`,'giu'):null;
  const fillerHits=[],pauses=[],repetitions=[],seen=new Map();
  for(let i=0;i<cues.length;i++){
    const cue=cues[i],matches=fillerPattern?[...cue.text.matchAll(fillerPattern)]:[];
    if(matches.length)fillerHits.push({cueIndex:cue.index,start:cue.start,end:cue.end,text:cue.text,words:[...new Set(matches.map(m=>m[2].toLowerCase()))],count:matches.length,suggestion:'Review this line for filler words; edit the subtitle rather than deleting meaningful speech.'});
    const key=normalize(cue.text);if(key&&wordCount(key)>=2&&seen.has(key)){const previous=seen.get(key);repetitions.push({cueIndex:cue.index,previousIndex:previous.index,start:cue.start,end:cue.end,text:cue.text,suggestion:'Check whether this line is intentionally repeated.'})}else if(key)seen.set(key,{index:cue.index,start:cue.start});
    const next=cues[i+1];if(next){const gap=Number((next.start-cue.end).toFixed(3)),threshold=Math.max(.5,Number(options.pauseThreshold)||1.8);if(gap>=threshold)pauses.push({start:cue.end,end:next.start,duration:gap,afterIndex:cue.index,beforeIndex:next.index,suggestion:gap>=4?'Long pause — review whether this is intentional silence.':'Pause — review the cut for pacing.'})}
  }
  return {fillers:fillerHits,repetitions,pauses,summary:{cueCount:cues.length,fillerCues:fillerHits.length,repeatedLines:repetitions.length,longPauses:pauses.length,totalPauseSeconds:Number(pauses.reduce((sum,p)=>sum+p.duration,0).toFixed(2))}};
}

function normalizeCaptionText(value) { let text=clean(value);if(!text)return '';text=text.replace(/\s+([,.;:!?।])/g,'$1').replace(/([,.;:!?।])(?=\S)/g,'$1 ');text=text.charAt(0).toLocaleUpperCase()+text.slice(1);if(!/[.!?…।！？]$/.test(text))text+='.';return text; }
/** Proposes safe punctuation/capitalization fixes and flags duplicates for user review. */
export function suggestSubtitleCleanup(input) {
  const cues=normalizeCues(input),seen=new Map(),changes=[];
  const cleaned=cues.map(cue=>{const before=cue.text,after=normalizeCaptionText(before),key=normalize(after);const duplicateOf=key&&seen.has(key)?seen.get(key):null;if(key&&!seen.has(key))seen.set(key,cue.index);const actions=[];if(before!==after)actions.push('spacing, capitalization or punctuation');if(duplicateOf!==null)actions.push('possible duplicate');if(actions.length)changes.push({cueIndex:cue.index,before,after,duplicateOf,actions});return {...cue,text:after,duplicateOf}});
  return {cleaned,changes,duplicateIndexes:changes.filter(change=>change.duplicateOf!==null).map(change=>change.cueIndex)};
}

function chapterTitle(value) {const text=normalizeCaptionText(value).replace(/[.!?।！？]+$/,'');const words=text.split(/\s+/).filter(Boolean).slice(0,7);if(!words.length)return 'New section';const result=words.join(' ');return result.length>54?result.slice(0,51).trimEnd()+'…':result;}
/** Build light chapter labels around gaps, transitions and time intervals. */
export function makeChapterLabels(input, options = {}) {
  const cues=normalizeCues(input);if(!cues.length)return [];const minGap=Math.max(5,Number(options.minGap)||18),minInterval=Math.max(8,Number(options.minInterval)||14);
  const transition=/\b(next|finally|meanwhile|however|but then|the reason|the truth|in conclusion|first|second|lastly|phir|lekin|magar|akhir|sabse pehle|dusri baat)\b/i;
  const candidates=[];let lastTime=-Infinity,lastCue=null;
  for(const cue of cues){const gap=lastCue?cue.start-lastCue.end:Infinity;if((!lastCue||gap>=minGap||transition.test(cue.text)||cue.start-lastTime>=minInterval)&&cue.text.length>=8){candidates.push(cue);lastTime=cue.start}lastCue=cue}
  const selected=[];for(const cue of candidates){if(selected.length&&cue.start-selected[selected.length-1].start<minInterval)continue;selected.push(cue)}
  return selected.map((cue,index)=>({id:`chapter-${index+1}`,timestamp:Number(cue.start.toFixed(3)),title:chapterTitle(cue.text),cueIndex:cue.index}));
}

/** Flag captions that may be long or too fast to read on a phone. */
export function calculateReadingLoad(input, options = {}) {
  const cues=normalizeCues(input),maxChars=Math.max(24,Number(options.maxChars)||42),maxWords=Math.max(4,Number(options.maxWords)||9),maxWordsPerSecond=Math.max(1,Number(options.maxWordsPerSecond)||3.6),lengthy=[],fast=[],warnings=[];
  for(const cue of cues){const words=wordCount(cue.text),duration=Math.max(.15,cue.end-cue.start),wps=words/duration;if(cue.text.length>maxChars||words>maxWords)lengthy.push({cueIndex:cue.index,start:cue.start,end:cue.end,text:cue.text,charCount:cue.text.length,wordCount:words,suggestion:'Split this subtitle into shorter lines or extend its display time.'});if(wps>maxWordsPerSecond)fast.push({cueIndex:cue.index,start:cue.start,end:cue.end,text:cue.text,wordsPerSecond:Number(wps.toFixed(2)),suggestion:'This line may be too fast to read comfortably.'})}
  warnings.push(...lengthy.map(item=>({...item,kind:'lengthy'})),...fast.map(item=>({...item,kind:'fast'})));return {lengthy,fast,warnings,summary:{cueCount:cues.length,lengthyCues:lengthy.length,fastCues:fast.length,readabilityScore:cues.length?Math.max(0,Math.round(100*(1-warnings.length/Math.max(1,cues.length)))):0}};
}

/** Transparent checklist for short-form readiness, not a prediction of views. */
export function scorePlatformReadiness({cues = [],duration = 0,platform = 'YouTube Shorts',title = '',hashtags = []} = {}) {
  const items=normalizeCues(cues),seconds=Math.max(0,Number(duration)||0),safeTitle=clean(title),safeTags=Array.isArray(hashtags)?hashtags.filter(Boolean):[],shortForm=/Shorts|Reels|TikTok/i.test(platform);let score=45;const actions=[];
  if(items.length>=4)score+=12;else actions.push('Generate timecoded subtitles or add a transcript for stronger context.');
  if(items.length>=4&&items.some(cue=>/[?!？！]/.test(cue.text)||CATCH_WORDS.has(normalize(cue.text).split(/\s+/)[0])))score+=10;else actions.push('Try opening with a question, contrast, or clear payoff.');
  if(safeTitle.length>=8&&safeTitle.length<=62)score+=10;else actions.push('Keep the title specific and usually under 60 characters.');
  if(safeTags.length>=3)score+=7;else actions.push('Add 3–8 relevant hashtags; avoid unrelated trending tags.');
  if(seconds>0&&(!shortForm||seconds<=60))score+=8;else if(shortForm)actions.push('For this short-form preset, consider a cut under 60 seconds.');
  if(items.length&&calculateReadingLoad(items).warnings.length===0)score+=8;else if(items.length)actions.push('Review dense or fast subtitle lines for phone readability.');
  if(items.length&&items[0].start<=3)score+=5;else if(items.length)actions.push('Bring the first spoken hook closer to the opening seconds.');
  score=Math.max(0,Math.min(100,Math.round(score)));return {score,scorePlatform:platform,actions,checks:{timedSubtitles:items.length>=4,openingHook:items.some(cue=>/[?!？！]/.test(cue.text)||CATCH_WORDS.has(normalize(cue.text).split(/\s+/)[0])),titleLength:safeTitle.length>=8&&safeTitle.length<=62,hashtags:safeTags.length>=3,duration:seconds>0&&(!shortForm||seconds<=60),subtitleReadability:items.length>0&&calculateReadingLoad(items).warnings.length===0},disclaimer:'A transparent editing checklist score, not a prediction of views or virality.'};
}
