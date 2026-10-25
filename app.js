import { generateCreatorIdeas } from "./creator-assistant.js?v=20261024-power3";
import { splitClipAt, duplicateClip, moveClip, createProjectManifest, validateProjectManifest, buildClipSegmentsExcludingRanges, renumberAutoTitles, removeClipAndRenumber, reorderClip, rankSceneChanges } from "./editor-tools.js?v=20261024-power3";
import { groupSubtitleWords, createSrt, wavToFloat32, createAssDocument } from "./subtitle-tools.js?v=20261025-deepaudit6";
import { findHighlightMoments, auditTranscript, suggestSubtitleCleanup, makeChapterLabels, calculateReadingLoad, scorePlatformReadiness } from "./ai-creator-tools.js?v=20261024-power3";
import { getMemoryProfile, getMediaMemoryWarning } from "./mobile-memory.js?v=20261024-power3";
import { getImportKind, getVideoMimeType, chooseVideoFromZip } from "./media-import.js?v=20261025-zipimport2";
import { scheduleCurrentSession, saveCurrentSession, loadCurrentSession, storeCurrentMedia, loadCurrentMedia, getCurrentMemoryInfo, clearCurrentMemory, flushCurrentSession } from "./memory-vault.js?v=20261024-power3";

const $=id=>document.getElementById(id); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const hexToRgba=(color,alpha=1)=>{let hex=String(color||"#111827").replace("#","").trim();if(hex.length===3)hex=hex.split("").map(ch=>ch+ch).join("");if(!/^[0-9a-fA-F]{6}$/.test(hex))hex="111827";const n=parseInt(hex,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${clamp(Number(alpha)||0,0,1)})`};
const transformTitleText=(text,mode="none")=>{const value=String(text??"");if(mode==="uppercase")return value.toLocaleUpperCase();if(mode==="lowercase")return value.toLocaleLowerCase();if(mode==="capitalize")return value.toLocaleLowerCase().replace(/(^|[ -])([a-z])/g,(_,prefix,letter)=>prefix+letter.toLocaleUpperCase());return value}
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fmt=s=>{s=Math.max(0,Math.round(Number(s)||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}`};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function timeFromInputs(prefix){const read=part=>{const el=$(prefix+part);return el&&el.value!==''?Number(el.value):0};const h=read('Hours'),m=read('Minutes'),s=read('Seconds');if(![h,m,s].every(Number.isFinite)||h<0||m<0||m>=60||s<0||s>=60)return null;return h*3600+m*60+s}
function setTimeInputs(prefix,value){const ids=['Hours','Minutes','Seconds'];if(value===null||value===undefined){ids.forEach(part=>{const el=$(prefix+part);if(el)el.value=''});return}const total=Math.max(0,Number(value)||0),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=Number((total%60).toFixed(2));const vals=[h,m,s];ids.forEach((part,i)=>{const el=$(prefix+part);if(el)el.value=String(vals[i])})}
const DEFAULT_FX={preset:"Original",brightness:0,contrast:1,saturation:1,blur:0,speed:1,volume:1,mute:false,normalize:false};
const state={projectName:"Untitled Project",sourceFile:null,sourceUrl:"",sourceMeta:null,visualTags:[],duration:0,selectedId:null,durationPreset:30,skipRanges:[],subtitleCues:[],subtitleSettings:{style:"Classic",highlight:"#9e83ff",positionY:82},exportAspect:"source",burnOverlays:true,aspect:"16:9",showSafe:false,seriesTitle:"Your series title",autoParts:true,titleStyle:{font:"Inter",size:30,color:"#ffffff",outline:"#000000",opacity:1,bold:true,italic:false,spacing:0,shadow:6,weight:800,transform:"none",align:"center",decoration:"none",outlineWidth:2,shadowColor:"#000000",glow:0,glowColor:"#8b5cf6",bgEnabled:false,bgColor:"#111827",bgOpacity:.72,bgPadding:10,bgRadius:10,rotation:0,lineHeight:1.08,positionY:17},captionStyle:{style:"Classic",text:"",highlight:"#9e83ff",positionY:78},clips:[],fx:{...DEFAULT_FX},history:[],future:[],activeTool:"media",objectUrl:null};
const MAX_CONCURRENT_EXPORTS=1; let lastCommitted=null, visionModelPromise=null, ffmpegInstance=null, ffmpegLoading=null, exportMode="smart", exportBusy=false, exportAspect="source";
let aiHighlights=[],aiAudit=null,aiCleanup=null,aiChapters=[],aiReadability=null,aiReadiness=null,lastCreatorIdeas=null;
let previewSourceVersion=0,previewCompatibilityBusy=false,queuedPreviewRecoveryFile=null;
const previewCompatibilityAttempts=new WeakSet();
const MEMORY_SAFE_MODE_KEY="clipsmith.memory-safe-mode";
let memorySafeMode=true;
try{memorySafeMode=localStorage.getItem(MEMORY_SAFE_MODE_KEY)!=="false"}catch{}
let restoreExistingClipsOnLoad=false, mediaSaveGeneration=0, memoryClearInProgress=false; let pendingRecoverySnapshot=null;
let subtitleWorker=null, subtitleWorkerReady=null, subtitleWorkerResolve=null, subtitleWorkerReject=null, subtitlePending=new Map(), subtitleRequestCounter=0, transcriptionCancelled=false, transcribing=false, subtitleCueLimit=80, sceneScanning=false;
const snap=()=>JSON.parse(JSON.stringify({projectName:state.projectName,durationPreset:state.durationPreset,aspect:state.aspect,showSafe:state.showSafe,seriesTitle:state.seriesTitle,autoParts:state.autoParts,titleStyle:state.titleStyle,captionStyle:state.captionStyle,clips:state.clips,fx:state.fx,selectedId:state.selectedId,sourceMeta:state.sourceMeta,visualTags:state.visualTags,skipRanges:state.skipRanges,subtitleCues:state.subtitleCues,subtitleSettings:state.subtitleSettings,exportAspect:state.exportAspect,burnOverlays:state.burnOverlays}));
function refreshMemoryPanel(){
  const profile=getMemoryProfile();
  const label=$("memoryProfileLabel"),advice=$("memoryAdvice"),toggle=$("memorySafeModeToggle"),status=$("memorySystemStatus");
  if(label)label.textContent=profile.label;
  if(advice)advice.textContent=profile.description;
  if(toggle)toggle.checked=memorySafeMode;
  if(status&&!status.dataset.custom)status.textContent="Project edits and subtitles autosave locally. The Memory Vault separately remembers the source video when storage permits.";
}
function setMemoryStatus(message,type="ready"){
  const status=$("memorySystemStatus");if(status){status.textContent=message;status.dataset.custom="true";status.dataset.state=type}
  const draft=$("memoryDraftStatus");if(draft){draft.textContent=type==="error"?"Autosave needs attention":"Local draft memory";draft.dataset.state=type}
}
function setMemoryVaultStatus(title,detail=""){
  const status=$("memoryVaultStatus"),copy=$("memoryVaultDetail");
  if(status)status.textContent=title;
  if(copy)copy.textContent=detail;
}
function humanBytes(bytes){if(!Number.isFinite(Number(bytes))||Number(bytes)<=0)return "0 B";const units=["B","KB","MB","GB","TB"];let value=Number(bytes),unit=0;while(value>=1024&&unit<units.length-1){value/=1024;unit++}return `${value.toFixed(unit?1:0)} ${units[unit]}`}

function persist(){const snapshot=snap();try{localStorage.setItem("clipsmith.project.v2",JSON.stringify(snapshot));const draft=$("memoryDraftStatus");if(draft){draft.textContent="Draft autosaved on this device";draft.dataset.state="ready"}}catch{setMemoryStatus("Local autosave storage is full or unavailable. Use Save to export a project file before closing the app.","error")}scheduleCurrentSession(snapshot)}
function commit(){const now=snap();if(lastCommitted&&JSON.stringify(now)!==JSON.stringify(lastCommitted)){state.history.push(lastCommitted);if(state.history.length>50)state.history.shift()}state.future=[];lastCommitted=now;persist();setSave("● Saved")}
function setSave(t){const n=$("saveState");if(!n)return;n.textContent=t;clearTimeout(n._timer);n._timer=setTimeout(()=>n.textContent="● Ready",1500)}
function toast(msg,type="info"){let t=document.querySelector(".toast");if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t)}t.textContent=msg;t.dataset.type=type;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),2600)}
function selected(){return state.clips.find(c=>c.id===state.selectedId)||null}
function undo(){const p=state.history.pop();if(!p)return toast("Nothing to undo");state.future.push(snap());restore(p);setSave("● Undo")}
function redo(){const n=state.future.pop();if(!n)return toast("Nothing to redo");state.history.push(snap());restore(n);setSave("● Redo")}
function restore(s){Object.assign(state,JSON.parse(JSON.stringify(s)));state.skipRanges=Array.isArray(s.skipRanges)?s.skipRanges:[];state.subtitleCues=Array.isArray(s.subtitleCues)?s.subtitleCues:[];state.subtitleSettings={style:"Classic",highlight:"#9e83ff",positionY:82,...(s.subtitleSettings||{})};state.exportAspect=s.exportAspect||"source";state.burnOverlays=s.burnOverlays!==false;state.duration=Number(state.sourceMeta?.duration)||state.duration||0;state.selectedId=state.clips.some(c=>c.id===state.selectedId)?state.selectedId:(state.clips[0]?.id||null);lastCommitted=snap();renderAll();persist()}
function hasRecoverableDraft(snapshot){
  return Boolean(snapshot&&(
    (Array.isArray(snapshot.clips)&&snapshot.clips.length)||
    snapshot.sourceMeta?.fileName||
    (Array.isArray(snapshot.subtitleCues)&&snapshot.subtitleCues.length)||
    (snapshot.projectName&&snapshot.projectName!=="Untitled Project")
  ));
}
function hideDraftRecoveryPrompt(){
  $("draftRecoveryActions")?.classList.add("hidden");
  $("emptyUploadBtn")?.classList.remove("hidden");
}
function showDraftRecoveryPrompt(snapshot){
  if(!hasRecoverableDraft(snapshot))return;
  pendingRecoverySnapshot=snapshot;
  const name=String(snapshot.projectName||"Untitled Project");
  $("previewEmptyTitle").textContent="Previous draft found";
  $("previewEmptyHint").textContent=`A saved project (“${name}”) is on this device. Restore it to continue, or start fresh.`;
  $("draftRecoveryActions")?.classList.remove("hidden");
  $("emptyUploadBtn")?.classList.add("hidden");
  $("previewEmpty").classList.remove("hidden");
  $("mediaName").textContent="Previous draft available";
  setMemoryVaultStatus("Previous draft found","Restore the saved edit, or start fresh to clear the old local draft and remembered source.");
}
function applyRecoveredDraft(s){
  if(!s||typeof s!=="object")return false;
  Object.assign(state,s);
  state.clips=Array.isArray(s.clips)?s.clips:[];
  state.skipRanges=Array.isArray(s.skipRanges)?s.skipRanges:[];
  state.subtitleCues=Array.isArray(s.subtitleCues)?s.subtitleCues:[];
  state.subtitleSettings={style:"Classic",highlight:"#9e83ff",positionY:82,...(s.subtitleSettings||{})};
  state.exportAspect=s.exportAspect||"source";
  state.burnOverlays=s.burnOverlays!==false;
  state.sourceMeta=s.sourceMeta&&typeof s.sourceMeta==="object"?s.sourceMeta:null;
  state.sourceUrl=state.sourceMeta?.sourceUrl||"";
  state.history=[];
  state.future=[];
  state.sourceFile=null;
  state.objectUrl=null;
  state.duration=Number(state.sourceMeta?.duration)||Number(state.duration)||0;
  state.selectedId=state.clips.some(c=>c.id===state.selectedId)?state.selectedId:(state.clips[0]?.id||null);
  pendingRecoverySnapshot=null;
  hideDraftRecoveryPrompt();
  $("previewEmptyTitle").textContent="Draft recovered";
  $("previewEmptyHint").textContent=state.sourceMeta?.fileName
    ?`Re-import ${state.sourceMeta.fileName} to reconnect preview and export.`
    :"Choose the original video to reconnect preview and export.";
  $("previewEmpty").classList.remove("hidden");
  $("mediaName").textContent=`Saved project · ${state.sourceMeta?.fileName||"video"}`;
  if($("projectName"))$("projectName").value=state.projectName||"Untitled Project";
  renderAll();
  lastCommitted=snap();
  setSave("● Recovered");
  return true;
}
function recover(){
  try{
    const raw=localStorage.getItem("clipsmith.project.v2")||localStorage.getItem("clipsmith.project.v1");
    if(!raw)return;
    const snapshot=JSON.parse(raw);
    pendingRecoverySnapshot=hasRecoverableDraft(snapshot)?snapshot:null;
  }catch{pendingRecoverySnapshot=null}
}
async function startFreshProject(){
  const button=$("startFreshBtn");
  if(button)button.disabled=true;
  memoryClearInProgress=true;
  try{
    await clearCurrentMemory();
    localStorage.removeItem("clipsmith.project.v2");
    localStorage.removeItem("clipsmith.project.v1");
    if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
    const video=$("previewVideo");
    if(video){video.pause();video.removeAttribute("src");video.load()}
    Object.assign(state,{
      projectName:"Untitled Project",sourceFile:null,sourceUrl:"",sourceMeta:null,
      visualTags:[],duration:0,selectedId:null,durationPreset:30,skipRanges:[],
      subtitleCues:[],subtitleSettings:{style:"Classic",highlight:"#9e83ff",positionY:82},
      exportAspect:"source",burnOverlays:true,aspect:"16:9",showSafe:false,
      seriesTitle:"Your series title",autoParts:true,
      titleStyle:{font:"Inter",size:30,color:"#ffffff",outline:"#000000",opacity:1,bold:true,italic:false,spacing:0,shadow:6,weight:800,transform:"none",align:"center",decoration:"none",outlineWidth:2,shadowColor:"#000000",glow:0,glowColor:"#8b5cf6",bgEnabled:false,bgColor:"#111827",bgOpacity:.72,bgPadding:10,bgRadius:10,rotation:0,lineHeight:1.08,positionY:17},
      captionStyle:{style:"Classic",text:"",highlight:"#9e83ff",positionY:78},
      clips:[],fx:{...DEFAULT_FX},history:[],future:[],activeTool:"media",objectUrl:null
    });
    pendingRecoverySnapshot=null;
    hideDraftRecoveryPrompt();
    if($("projectName"))$("projectName").value=state.projectName;
    $("mediaName").textContent="No video loaded";
    $("previewEmptyTitle").textContent="Bring in your video";
    $("previewEmptyHint").textContent="Everything stays in this browser. Nothing is uploaded for editing.";
    $("previewEmpty").classList.remove("hidden");
    renderAll();
    lastCommitted=snap();
    setSave("● Ready");
    setMemoryVaultStatus("Fresh project","The previous local draft and remembered source video were cleared.");
    toast("Started a fresh project");
  }catch(error){
    toast(`Could not clear the previous draft: ${error?.message||"storage unavailable"}`,"error");
  }finally{
    memoryClearInProgress=false;
    if(button)button.disabled=false;
  }
}
async function refreshMemoryVaultStats(){try{const info=await getCurrentMemoryInfo();const node=$("memoryVaultUsage");if(node){const used=Number(info.usageBytes)||0,quota=Number(info.quotaBytes)||0;node.textContent=used>0?(`${humanBytes(used)} used`+(quota>0?" of "+humanBytes(quota):"")):"Storage estimate unavailable"}}catch{const node=$("memoryVaultUsage");if(node)node.textContent="Storage estimate unavailable"}}
async function rememberSourceMedia(file){if(memoryClearInProgress)return;const generation=++mediaSaveGeneration;setMemoryVaultStatus("Remembering source video…",`${file.name} · checking device storage`);try{if(navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);const estimate=await navigator.storage?.estimate?.().catch(()=>null);const free=Number(estimate?.quota)-Number(estimate?.usage);if(Number.isFinite(free)&&free>0&&file.size>free*.92)throw new Error("Not enough available browser storage for this video");if(memoryClearInProgress)return;await storeCurrentMedia(file);await refreshMemoryVaultStats();if(generation===mediaSaveGeneration)setMemoryVaultStatus("Source video remembered",`${file.name} · ${humanBytes(file.size)} stored on this device. The app can reconnect it after restart.`)}catch(error){if(generation===mediaSaveGeneration)setMemoryVaultStatus("Project autosave is active",`The video is loaded for this session, but could not be stored (${error?.message||"storage unavailable"}). Re-import it after a restart. Export a project file as a backup.`)}}
async function saveMemoryNow(){const button=$("memorySaveNowBtn");if(button)button.disabled=true;setMemoryVaultStatus("Saving project memory…","Saving the current edit, settings, subtitles and available source video.");try{await flushCurrentSession(snap());if(state.sourceFile)await rememberSourceMedia(state.sourceFile);else setMemoryVaultStatus("Project memory saved","The edit and settings are stored locally. Import the source video again if it is not remembered.");const info=await getCurrentMemoryInfo();await refreshMemoryVaultStats();if(info.hasSession&&!info.hasMedia&&state.sourceMeta)setMemoryVaultStatus("Project memory saved","Your edit and subtitles are saved, but the source video needs re-importing after restart.");toast("Project memory saved on this device")}catch(error){setMemoryVaultStatus("Local backup unavailable",error?.message||"Use Save to download a portable project file.");toast("Could not save device memory · use Save to export a backup","error")}finally{if(button)button.disabled=false}}
async function clearDeviceMemory(){if(!confirm("Clear all ClipSmith project memory and remembered video stored on this device? This will remove the local draft too."))return;memoryClearInProgress=true;try{await clearCurrentMemory();localStorage.removeItem("clipsmith.project.v2");localStorage.removeItem("clipsmith.project.v1");if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);location.reload()}catch(error){memoryClearInProgress=false;toast(`Could not clear local memory: ${error?.message||"storage error"}`,"error")}}
async function restoreRememberedMemory(){
  setMemoryVaultStatus("Checking device memory…","Looking for your last project and remembered source video.");
  try{
    if(!pendingRecoverySnapshot){
      const savedSession=await loadCurrentSession();
      if(savedSession?.snapshot&&hasRecoverableDraft(savedSession.snapshot))pendingRecoverySnapshot=savedSession.snapshot;
    }
    const snapshot=pendingRecoverySnapshot;
    const savedMedia=await loadCurrentMedia();
    const meta=snapshot?.sourceMeta||null;
    const sameSource=Boolean(savedMedia?.blob&&meta&&(savedMedia.name===meta.fileName)&&(!Number(meta.fileSize)||Number(savedMedia.size)===Number(meta.fileSize)));
    if(snapshot&&sameSource){
      applyRecoveredDraft(snapshot);
      const file=new File([savedMedia.blob],savedMedia.name,{type:savedMedia.type||savedMedia.blob.type||"video/mp4",lastModified:savedMedia.lastModified||Date.now()});
      state.sourceFile=file;
      state.sourceUrl=meta.sourceUrl||"";
      state.objectUrl=URL.createObjectURL(file);
      restoreExistingClipsOnLoad=true;
      const video=$("previewVideo");
      video.src=state.objectUrl;
      video.load();
      $("mediaName").textContent=`${file.name} · remembered`;
      $("previewEmptyTitle").textContent="Restoring your project…";
      $("previewEmptyHint").textContent="Reconnecting the locally remembered video and your last edit.";
      $("previewEmpty").classList.remove("hidden");
      updateImportStatus("Restoring source video from local memory…","loading");
      setMemoryVaultStatus("Saved project found",`${file.name} · ${humanBytes(file.size)}. Reconnecting your last edit…`);
    }else if(hasRecoverableDraft(snapshot)){
      showDraftRecoveryPrompt(snapshot);
    }else{
      pendingRecoverySnapshot=null;
      hideDraftRecoveryPrompt();
      setMemoryVaultStatus("Memory vault ready","Edits autosave on this device. Source videos are remembered when storage space and browser support allow it.");
    }
    const info=await getCurrentMemoryInfo();
    if($("memoryVaultUsage"))$("memoryVaultUsage").textContent=(Number(info.usageBytes)>0?`${humanBytes(info.usageBytes)} used`:"0 B used")+(Number(info.quotaBytes)>0?" of "+humanBytes(info.quotaBytes):"");
  }catch(error){
    setMemoryVaultStatus("Local draft protection active",`The normal editor autosave is active; persistent media memory is unavailable in this browser (${error?.message||"storage unavailable"}).`);
    if(hasRecoverableDraft(pendingRecoverySnapshot))showDraftRecoveryPrompt(pendingRecoverySnapshot);
  }
}
function releaseTemporaryMemory({silent=false}={}){
  if(exportBusy||transcribing||sceneScanning||$("analyzeFrameBtn")?.disabled){
    if(!silent)toast("Finish the active video or AI task before releasing temporary memory.");
    return false;
  }
  const released=[];
  if(ffmpegLoading&&!ffmpegInstance){
    if(!silent)toast("The video engine is still loading. Try again in a moment.");
    return false;
  }
  if(ffmpegInstance){try{ffmpegInstance.terminate()}catch{}ffmpegInstance=null;ffmpegLoading=null;released.push("video engine")}
  if(subtitleWorker){try{subtitleWorker.terminate()}catch{}subtitleWorker=null;subtitleWorkerReady=null;subtitleWorkerResolve=null;subtitleWorkerReject=null;subtitlePending.clear();released.push("speech model")}
  if(visionModelPromise){const modelPromise=visionModelPromise;visionModelPromise=null;modelPromise.then(model=>model?.dispose?.()).catch(()=>{});released.push("vision model")}
  setMemoryStatus(released.length?("Temporary "+released.join(", ")+" released. Your autosaved draft and selected source file are kept."):"No temporary AI/video engines are currently loaded.");
  if(!silent)toast(released.length?"Temporary memory released · your draft is kept":"Nothing temporary to release");
  return true;
}
function makeClip(start,end,i){return{id:uid(),start,end,title:state.autoParts?`${state.seriesTitle} · Part ${i+1}`:state.seriesTitle,autoTitle:state.autoParts,caption:state.captionStyle.text,titleStyle:{...state.titleStyle},captionStyle:{...state.captionStyle},fx:{...DEFAULT_FX}}}
function generateClips({notify=true}={}){if(!state.duration)return toast("Add a video first");const seg=buildClipSegmentsExcludingRanges(state.duration,state.durationPreset,state.skipRanges);if(seg===null)return toast("That would create too many clips. Choose a longer duration");if(!seg.length)return toast("No usable footage remains. Check the marked skip ranges or choose a shorter clip length");state.clips=seg.map(s=>makeClip(s.start,s.end,s.index));state.selectedId=state.clips[0]?.id||null;commit();renderAll();if(notify)toast(`${state.clips.length} clips ready`)}
function applyTitle(){state.seriesTitle=$("seriesTitle").value.trim()||"Untitled";state.autoParts=$("autoParts").checked;state.clips.forEach((c,i)=>{if(c.autoTitle===false)return;c.title=state.autoParts?`${state.seriesTitle} · Part ${i+1}`:state.seriesTitle;c.autoTitle=state.autoParts});commit();renderAll();toast("Title pattern applied")}
function selectClip(id){state.selectedId=id;const c=selected();if(c&&$("previewVideo").src)$("previewVideo").currentTime=clamp(c.start,0,state.duration);syncInspector();renderTimeline();renderClips();updatePreview();requestAnimationFrame(()=>scrollClipCardIntoView(id));persist()}
function splitSelected(){const c=selected();if(!c)return toast("Select a clip first");const t=$("previewVideo").currentTime;if(t<=c.start+.05||t>=c.end-.05)return toast("Put the playhead inside the selected clip");const r=splitClipAt(state.clips,c.id,t,{makeId:uid,titleFor:i=>`${state.seriesTitle} · Part ${i+1}`});if(!r)return toast("Could not split here");state.clips=renumberAutoTitles(r.clips,i=>`${state.seriesTitle} · Part ${i+1}`);state.selectedId=r.selectedId;commit();renderAll();toast("Split at playhead")}
function duplicateSelected(){const c=selected();if(!c)return toast("Select a clip first");const r=duplicateClip(state.clips,c.id,{makeId:uid,titleFor:i=>`${state.seriesTitle} · Part ${i+1}`});state.clips=renumberAutoTitles(r.clips,i=>`${state.seriesTitle} · Part ${i+1}`);state.selectedId=r.selectedId;commit();renderAll();toast("Clip duplicated")}
function moveSelected(d){const c=selected();if(!c)return toast("Select a clip first");const r=moveClip(state.clips,c.id,d);if(!r)return;state.clips=renumberAutoTitles(r.clips,i=>`${state.seriesTitle} · Part ${i+1}`);commit();renderAll()}
function deleteSelected(){const c=selected();if(!c)return toast("Select a clip first");const result=removeClipAndRenumber(state.clips,c.id,{titleFor:i=>`${state.seriesTitle} · Part ${i+1}`});if(!result)return;state.clips=result.clips;state.selectedId=result.selectedId;commit();renderAll();toast("Clip removed · part numbers fixed")}
function renderTimeline(){const root=$("timeline");root.innerHTML="";if(!state.clips.length){root.innerHTML='<div class="timeline-empty">Import a video to build your clip sequence.</div>';return}const total=Math.max(1,state.duration||state.clips.at(-1).end);state.clips.forEach((c,i)=>{const e=document.createElement("button");e.type="button";e.dataset.clipId=c.id;e.className=`timeline-block ${c.id===state.selectedId?"selected":""}`;const baseWidth=Math.max(62,Math.min(260,(c.end-c.start)*2));e.dataset.baseWidth=String(baseWidth);e.style.width=`${baseWidth}px`;e.innerHTML=`<span>${i+1}</span><b>${esc(c.title)}</b>`;e.title=`${fmt(c.start)} – ${fmt(c.end)}`;e.onclick=()=>selectClip(c.id);root.appendChild(e)})}
function renderClips(){const root=$("clip-strip");root.innerHTML="";if(!state.clips.length){root.innerHTML='<div class="queue-empty">No clips yet</div>';return}state.clips.forEach((c,i)=>{const e=document.createElement("button");e.type="button";e.draggable=true;e.dataset.clipId=c.id;e.className=`clip-card ${c.id===state.selectedId?"selected":""}`;e.innerHTML=`<div class="clip-thumb"><span>${String(i+1).padStart(2,"0")}</span><span class="drag-hint">⠿ drag</span></div><div><div class="clip-meta">PART ${i+1}</div><div class="clip-title">${esc(c.title)}</div><div class="clip-time">${fmt(c.start)} → ${fmt(c.end)}</div></div>`;e.onclick=()=>selectClip(c.id);e.addEventListener("dragstart",event=>{event.dataTransfer?.setData("text/plain",c.id);if(event.dataTransfer)event.dataTransfer.effectAllowed="move";e.classList.add("dragging")});e.addEventListener("dragend",()=>e.classList.remove("dragging"));e.addEventListener("dragover",event=>{event.preventDefault();e.classList.add("drag-over")});e.addEventListener("dragleave",()=>e.classList.remove("drag-over"));e.addEventListener("drop",event=>{event.preventDefault();e.classList.remove("drag-over");const from=event.dataTransfer?.getData("text/plain");if(!from||from===c.id)return;const result=reorderClip(state.clips,from,c.id,{titleFor:i=>`${state.seriesTitle} · Part ${i+1}`});if(!result)return;state.clips=result.clips;state.selectedId=result.selectedId;commit();renderAll();toast("Clip order updated")});root.appendChild(e)})}
function syncClipStripSlider(){
  const strip=$("clip-strip"),slider=$("clipStripSlider"),prev=$("clipStripPrevBtn"),next=$("clipStripNextBtn"),position=$("clipStripPosition");
  if(!strip||!slider)return;
  const cards=$$(".clip-card",strip),maxScroll=Math.max(0,strip.scrollWidth-strip.clientWidth);
  const ratio=maxScroll>0?clamp(strip.scrollLeft/maxScroll,0,1):0;
  slider.max="1000";
  slider.disabled=maxScroll<2;
  if(document.activeElement!==slider)slider.value=String(Math.round(ratio*1000));
  if(prev)prev.disabled=maxScroll<2||strip.scrollLeft<=2;
  if(next)next.disabled=maxScroll<2||strip.scrollLeft>=maxScroll-2;
  const step=cards.length?cards[0].getBoundingClientRect().width+12:172;
  const first=cards.length?Math.min(cards.length,Math.floor(strip.scrollLeft/Math.max(1,step))+1):0;
  const visibleCount=cards.length?Math.max(1,Math.ceil(strip.clientWidth/Math.max(1,step))):0;
  const last=cards.length?Math.min(cards.length,first+visibleCount-1):0;
  const label=cards.length?(first+"–"+last+" / "+cards.length):"No clips";
  if(position)position.textContent=label;
  slider.setAttribute("aria-valuetext",cards.length?("Clips "+first+" to "+last+" of "+cards.length):"No clips");
}
function scrollClipStrip(direction){
  const strip=$("clip-strip");
  if(!strip)return;
  const step=Math.max(172,Math.min(strip.clientWidth*.82,strip.clientWidth-20));
  strip.scrollBy({left:direction*step,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
}
function scrollClipCardIntoView(id){
  const strip=$("clip-strip");
  if(!strip)return;
  const card=$$(".clip-card",strip).find(item=>item.dataset.clipId===id);
  if(!card)return;
  const left=card.offsetLeft,right=left+card.offsetWidth,viewLeft=strip.scrollLeft,viewRight=viewLeft+strip.clientWidth;
  if(left<viewLeft+5)strip.scrollTo({left:Math.max(0,left-5),behavior:"smooth"});
  else if(right>viewRight-5)strip.scrollTo({left:Math.max(0,right-strip.clientWidth+5),behavior:"smooth"});
  requestAnimationFrame(syncClipStripSlider);
}
function initializeClipStripSlider(){
  const strip=$("clip-strip"),slider=$("clipStripSlider");
  if(!strip||!slider)return;
  slider.addEventListener("input",()=>{const maxScroll=Math.max(0,strip.scrollWidth-strip.clientWidth);strip.scrollLeft=(Number(slider.value)/1000)*maxScroll;syncClipStripSlider()});
  $("clipStripPrevBtn")?.addEventListener("click",()=>scrollClipStrip(-1));
  $("clipStripNextBtn")?.addEventListener("click",()=>scrollClipStrip(1));
  strip.addEventListener("scroll",()=>requestAnimationFrame(syncClipStripSlider),{passive:true});
  window.addEventListener("resize",syncClipStripSlider,{passive:true});
  new MutationObserver(()=>requestAnimationFrame(syncClipStripSlider)).observe(strip,{childList:true});
  requestAnimationFrame(syncClipStripSlider);
}
initializeClipStripSlider();
let requestedTitleFontKey = "";
function ensureTitleFont(style){
  const font=String(style?.font||"Inter").replace(/["\\\\]/g,"").trim()||"Inter";
  const weight=clamp(Number(style?.weight??(style?.bold===false?500:800)),100,900);
  const italic=!!style?.italic;
  const key=`${font}| ${weight}|${italic}`;
  const text=$("titleOverlayText");
  if(text)text.style.fontFamily=`"${font}", Inter, sans-serif`;
  if(key===requestedTitleFontKey||!document.fonts?.load)return;
  requestedTitleFontKey=key;
  void document.fonts.load(`${italic?"italic ":""}${weight} 24px "${font}"`).then(()=>{
    const current=selected()?.titleStyle||state.titleStyle;
    const currentFont=String(current?.font||"Inter").replace(/["\\\\]/g,"").trim()||"Inter";
    const currentKey=`${currentFont}| ${clamp(Number(current?.weight??(current?.bold===false?500:800)),100,900)}|${!!current?.italic}`;
    if(currentKey===key)requestAnimationFrame(fitCanvasOverlayText);
  }).catch(()=>{if(requestedTitleFontKey===key)requestedTitleFontKey="";});
}
function updatePreview(){
  const c=selected(),style=c?.titleStyle||state.titleStyle,cap=c?.captionStyle||state.captionStyle;
  const title=$("titleOverlay"),caption=$("captionOverlay"),titleText=$("titleOverlayText");
  titleText.textContent=c?.title||`${state.seriesTitle} · Part 1`;
  ensureTitleFont(style);
  // The overlay is a positioning/background box. Typography belongs to the
  // editable text node so every property affects the visible letters reliably.
  Object.assign(title.style,{
    color:"inherit",
    fontFamily:"inherit",
    fontSize:"inherit",
    fontWeight:"inherit",
    fontStyle:"inherit",
    letterSpacing:"normal",
    textTransform:"none",
    textAlign:"inherit",
    textDecoration:"none",
    lineHeight:"inherit",
    opacity:"1",
    left:style.bgEnabled?"50%":"5%",
    right:style.bgEnabled?"auto":"5%",
    width:style.bgEnabled?"fit-content":"auto",
    maxWidth:style.bgEnabled?"84%":"90%",
    display:"block",
    boxSizing:"border-box",
    overflowWrap:"anywhere",
    backgroundColor:style.bgEnabled?hexToRgba(style.bgColor,style.bgOpacity??.72):"transparent",
    padding:style.bgEnabled?`${clamp(Number(style.bgPadding??10),0,30)}px`:"0px",
    borderRadius:style.bgEnabled?`${clamp(Number(style.bgRadius??10),0,24)}px`:"0px",
    top:`${clamp(Number(style.positionY??17),4,90)}%`,
    bottom:"auto",
    transform:`${style.bgEnabled?"translateX(-50%) ":""}rotate(${clamp(Number(style.rotation??0),-180,180)}deg)`
  });
  caption.textContent=c?(typeof c.caption==="string"?c.caption:(cap.text||"")):(cap.text||"");
  caption.dataset.style=c?.captionStyle?.style||cap.style||"Classic";
  caption.style.color=cap.highlight;
  caption.style.bottom=`${100-cap.positionY}%`;
  updateActiveSubtitle();
  const v=$("previewVideo");
  if(v){const fx={...DEFAULT_FX,...(c?.fx||state.fx)};v.style.filter=`brightness(${clamp(100*(1+Number(fx.brightness||0)),0,200)}%) contrast(${Number(fx.contrast??1)*100}%) saturate(${Number(fx.saturation??1)*100}%) blur(${Math.max(0,Number(fx.blur)||0)}px)`;v.playbackRate=clamp(Number(fx.speed)||1,.25,4);v.volume=clamp(Number(fx.volume??1),0,1);v.muted=!!fx.mute}
  fitCanvasOverlayText();
}
function syncInspector(){const c=selected(),fx={...DEFAULT_FX,...(c?.fx||state.fx)};if(c?.titleStyle)state.titleStyle={...state.titleStyle,...c.titleStyle};if($("canvasTitleColor"))$("canvasTitleColor").value=state.titleStyle.color;if($("subtitleStyle"))$("subtitleStyle").value=state.subtitleSettings.style;if($("subtitleHighlightColor"))$("subtitleHighlightColor").value=state.subtitleSettings.highlight;if($("subtitlePositionY"))$("subtitlePositionY").value=state.subtitleSettings.positionY;if($("selectedClipLabel"))$("selectedClipLabel").textContent=c?c.title:"No clip selected";setTimeInputs("clipStart",c?.start??null);setTimeInputs("clipEnd",c?.end??null);if($("captionText"))$("captionText").value=c?.caption??state.captionStyle.text;if($("captionStyle"))$("captionStyle").value=c?.captionStyle?.style||state.captionStyle.style||"Classic";if($("captionHighlightColor"))$("captionHighlightColor").value=c?.captionStyle?.highlight||state.captionStyle.highlight||"#9e83ff";if($("captionPositionY"))$("captionPositionY").value=c?.captionStyle?.positionY??state.captionStyle.positionY??78;if($("seriesTitle"))$("seriesTitle").value=state.seriesTitle;if($("autoParts"))$("autoParts").checked=state.autoParts;if($("titleFont")){$("titleFont").value=state.titleStyle.font||"Inter";$("titleFont").style.fontFamily=`"${state.titleStyle.font||"Inter"}"`;}if($("titleSize"))$("titleSize").value=state.titleStyle.size;if($("titleColor"))$("titleColor").value=state.titleStyle.color;if($("titleOutline"))$("titleOutline").value=state.titleStyle.outline;if($("titleOpacity"))$("titleOpacity").value=state.titleStyle.opacity;if($("titleBold"))$("titleBold").checked=state.titleStyle.bold!==false;if($("titleItalic"))$("titleItalic").checked=!!state.titleStyle.italic;if($("titleSpacing"))$("titleSpacing").value=state.titleStyle.spacing??0;if($("titleShadow"))$("titleShadow").value=state.titleStyle.shadow??6;
  const titleControlValues={titleWeight:state.titleStyle.weight??(state.titleStyle.bold===false?500:800),titleTransform:state.titleStyle.transform??"none",titleAlign:state.titleStyle.align??"center",titleDecoration:state.titleStyle.decoration??"none",titleOutlineWidth:state.titleStyle.outlineWidth??2,titleShadowColor:state.titleStyle.shadowColor??"#000000",titleGlow:state.titleStyle.glow??0,titleGlowColor:state.titleStyle.glowColor??"#8b5cf6",titleBgEnabled:state.titleStyle.bgEnabled??false,titleBgColor:state.titleStyle.bgColor??"#111827",titleBgOpacity:state.titleStyle.bgOpacity??.72,titleBgPadding:state.titleStyle.bgPadding??10,titleBgRadius:state.titleStyle.bgRadius??10,titleRotation:state.titleStyle.rotation??0,titleLineHeight:state.titleStyle.lineHeight??1.08,titlePositionY:state.titleStyle.positionY??17};
  Object.entries(titleControlValues).forEach(([id,value])=>{const control=$(id);if(!control)return;if(control.type==="checkbox")control.checked=Boolean(value);else control.value=value});
  ["fxPreset","fxBrightness","fxContrast","fxSaturation","fxBlur","fxSpeed","fxVolume"].forEach(id=>{if($(id))$(id).value=fx[id.slice(2).toLowerCase()]});if($("fxMute"))$("fxMute").checked=!!fx.mute}
function renderSkipRanges(){const root=$("skipRangeList");if(!root)return;if(!state.skipRanges.length){root.innerHTML='<p class="hint">No promo or ad ranges marked yet.</p>';return}root.innerHTML=state.skipRanges.map((r,i)=>`<div class="skip-range-item"><div><strong>${esc(r.label||('Promo / ad break '+(i+1)))}</strong><small>${fmt(r.start)} → ${fmt(r.end)} · ${fmt(r.end-r.start)}</small></div><button class="remove-skip-btn" type="button" data-remove-skip="${esc(r.id)}" aria-label="Remove skip range">×</button></div>`).join('')}
function setSkipFromPlayhead(which){if(!state.duration)return toast("Load a video first");const prefix=which==="start"?"skipStart":"skipEnd";setTimeInputs(prefix,$("previewVideo").currentTime||0);toast((which==="start"?"Skip start":"Skip end")+" set to playhead")}
function addSkipRange(){if(!state.duration)return toast("Load a video first");const start=timeFromInputs("skipStart"),end=timeFromInputs("skipEnd");if(start===null||end===null)return toast("Use 0–59 for minutes and seconds","error");const a=clamp(start,0,state.duration),b=clamp(end,0,state.duration);if(b-a<0.5)return toast("The skip range must be at least 0.5 seconds","error");state.skipRanges.push({id:uid(),start:a,end:b,label:"Promo / ad break"});state.skipRanges.sort((x,y)=>x.start-y.start);commit();renderSkipRanges();toast("Marked "+fmt(a)+" → "+fmt(b)+". Rebuild clips to exclude it.")}
function clearSkipRanges(){if(!state.skipRanges.length)return toast("There are no skip marks to clear");state.skipRanges=[];commit();renderSkipRanges();toast("Skip marks cleared. Rebuild the clip plan to restore those sections.")}
function updateSubtitleProgress(message){const status=$("subtitleProgress");if(status)status.textContent=message}
function updateActiveSubtitle(){const overlay=$("subtitleOverlay"),video=$("previewVideo");if(!overlay||!video)return;const time=Number(video.currentTime)||0;const cue=state.subtitleCues.find(item=>time>=item.start&&time<item.end);overlay.textContent=cue?.text||"";overlay.classList.toggle("hidden",!cue);overlay.dataset.style=state.subtitleSettings.style;overlay.style.color=state.subtitleSettings.highlight;overlay.style.bottom=`${100-state.subtitleSettings.positionY}%`}
function renderSubtitleCueList(){const root=$("subtitleCueList");if(!root)return;const cues=state.subtitleCues||[];const meta=$("subtitleCueMeta");if(meta)meta.textContent=`${cues.length} timed line${cues.length===1?"":"s"}`;const download=$("downloadSrtBtn");if(download)download.disabled=!cues.length;const more=$("showMoreCuesBtn");if(more){more.classList.toggle("hidden",cues.length<=subtitleCueLimit);more.textContent=`Show next ${Math.min(80,cues.length-subtitleCueLimit)} lines (${cues.length-subtitleCueLimit} remaining)`}if(!cues.length){root.innerHTML='<div class="queue-empty">No subtitles yet. Generate them or add a manual caption below.</div>';return}root.innerHTML=cues.slice(0,subtitleCueLimit).map((cue,i)=>`<div class="subtitle-cue-row"><button type="button" class="cue-time" data-cue-seek="${i}" title="Jump to this line">${fmt(cue.start)}<span>↗</span></button><textarea class="cue-edit" rows="2" data-subtitle-edit="${i}" aria-label="Edit subtitle line ${i+1}">${esc(cue.text)}</textarea><button type="button" class="cue-remove" data-cue-remove="${i}" aria-label="Remove subtitle line">×</button></div>`).join("")}
function downloadSubtitleFile(){if(!state.subtitleCues.length)return toast("Generate subtitles first");const srt=createSrt(state.subtitleCues);downloadBlob(new Blob([srt],{type:"text/plain;charset=utf-8"}),`${(state.projectName||"clipsmith").replace(/[^\w-]+/g,"-")}.srt`);toast("SRT subtitles downloaded")}
function ensureSubtitleWorker(){if(subtitleWorker&&subtitleWorkerReady)return subtitleWorkerReady;subtitleWorker=new Worker(new URL("./transcribe-worker.js?v=20261024-power3",import.meta.url),{type:"module"});subtitleWorkerReady=new Promise((resolve,reject)=>{subtitleWorkerResolve=resolve;subtitleWorkerReject=reject});subtitleWorker.addEventListener("message",event=>{const data=event.data||{};if(data.type==="model-progress"){const suffix=data.progress===null?"":` · ${Math.round(data.progress)}%`;updateSubtitleProgress(`Loading local Whisper model${data.status?` · ${data.status}`:""}${suffix}`);return}if(data.type==="ready"){subtitleWorkerResolve?.();subtitleWorkerResolve=null;subtitleWorkerReject=null;updateSubtitleProgress("Whisper model ready · transcribing audio locally…");return}if(data.type==="fatal"){subtitleWorkerReject?.(new Error(data.message||"Whisper model failed to load"));subtitleWorkerResolve=null;subtitleWorkerReject=null;return}const pending=subtitlePending.get(data.requestId);if(!pending)return;subtitlePending.delete(data.requestId);if(data.type==="result")pending.resolve(data);else pending.reject(new Error(data.message||"Transcription failed"))});subtitleWorker.addEventListener("error",event=>{const error=new Error(event.message||"Subtitle worker crashed");subtitleWorkerReject?.(error);for(const pending of subtitlePending.values())pending.reject(error);subtitlePending.clear()});subtitleWorker.postMessage({type:"load"});return subtitleWorkerReady}
function transcribeAudioChunk(samples,offset,language){return new Promise((resolve,reject)=>{if(!subtitleWorker) return reject(new Error("Subtitle worker is not ready"));const requestId=String(++subtitleRequestCounter);subtitlePending.set(requestId,{resolve,reject});subtitleWorker.postMessage({type:"transcribe",requestId,offset,samples,language},[samples.buffer])})}
function approximateWords(text,start,end){const pieces=String(text||"").trim().split(/\s+/).filter(Boolean);if(!pieces.length)return[];const span=Math.max(.4,end-start),step=span/pieces.length;return pieces.map((word,i)=>({start:start+i*step,end:start+(i+1)*step,text:word}))}
async function generateAutoSubtitles(){if(transcribing)return;if(!state.sourceFile||!state.duration)return toast("Import a video with audio first","error");const safetyWarnings=[];if(memorySafeMode){const warning=getMediaMemoryWarning({fileSize:state.sourceFile.size,duration:state.duration});if(warning)safetyWarnings.push(warning)}if(state.duration>5400||state.sourceFile.size>600*1024*1024)safetyWarnings.push("This is a long or large source. Speech recognition and FFmpeg can use substantial RAM on a phone.");if(safetyWarnings.length&&!confirm("ClipSmith memory-safety check:\n\n"+safetyWarnings.join("\n\n")+"\n\nContinue with local transcription?"))return;transcribing=true;transcriptionCancelled=false;$("autoSubtitleBtn").disabled=true;$("cancelTranscriptionBtn").classList.remove("hidden");const previousTime=$("previewVideo").currentTime;let ff=null,input="",prefix="",chunkCount=0;const words=[];try{updateSubtitleProgress("Loading browser video tools…");await ensureSubtitleWorker();if(transcriptionCancelled)throw new Error("Transcription cancelled");ff=await getFFmpeg();input=`asr-source-${uid()}`;prefix=`asr-audio-${uid()}-`;await ff.writeFile(input,await ff.__fetchFile(state.sourceFile));updateSubtitleProgress("Extracting 30-second audio chunks…");const pattern=`${prefix}%03d.wav`;await ff.exec(["-i",input,"-map","0:a:0","-vn","-ac","1","-ar","16000","-c:a","pcm_s16le","-f","segment","-segment_time","30","-reset_timestamps","1",pattern]);chunkCount=Math.ceil(state.duration/30)+1;for(let i=0;i<chunkCount;i++){if(transcriptionCancelled)throw new Error("Transcription cancelled");const name=`${prefix}${String(i).padStart(3,"0")}.wav`;let wav;try{wav=await ff.readFile(name)}catch{break}try{const samples=wavToFloat32(wav);if(!samples.length)continue;updateSubtitleProgress(`Transcribing audio chunk ${i+1} · about ${fmt(Math.min(state.duration,(i+1)*30))} of ${fmt(state.duration)}…`);const response=await transcribeAudioChunk(samples,i*30,$("subtitleLanguage").value);if(transcriptionCancelled)throw new Error("Transcription cancelled");const chunks=Array.isArray(response.chunks)?response.chunks:[];let usable=0;for(const item of chunks){const a=Array.isArray(item.timestamp)?Number(item.timestamp[0]):NaN,b=Array.isArray(item.timestamp)?Number(item.timestamp[1]):NaN;if(item.text&&Number.isFinite(a)&&Number.isFinite(b)&&b>a){words.push({start:i*30+a,end:Math.min(state.duration,i*30+b),text:item.text});usable++}}if(!usable&&response.text)words.push(...approximateWords(response.text,i*30,Math.min(state.duration,(i+1)*30)))}finally{try{await ff.deleteFile(name)}catch{}}}if(transcriptionCancelled)throw new Error("Transcription cancelled");state.subtitleCues=groupSubtitleWords(words,{maxWords:7,maxDuration:3.2,maxChars:42});subtitleCueLimit=80;if(!state.subtitleCues.length)throw new Error("No speech was detected. The video may have no audio, or the audio may be too unclear.");commit();renderSubtitleCueList();updateActiveSubtitle();updateSubtitleProgress(`Done · ${state.subtitleCues.length} timed subtitle lines generated locally. Edit any line or download the SRT.`);toast("Auto subtitles generated")}catch(error){const message=error?.message||"Subtitle generation failed";if(transcriptionCancelled||/cancelled/i.test(message)){updateSubtitleProgress("Transcription cancelled. Your video and existing subtitles are unchanged.");toast("Transcription cancelled")}else{if(subtitleWorker){subtitleWorker.terminate();subtitleWorker=null}subtitleWorkerReady=null;subtitleWorkerResolve=null;subtitleWorkerReject=null;updateSubtitleProgress(`Could not generate subtitles: ${message}`);toast("Auto subtitles failed · check the status message","error")}}finally{if(ff){if(input){try{await ff.deleteFile(input)}catch{}}for(let i=0;i<chunkCount;i++){try{await ff.deleteFile(`${prefix}${String(i).padStart(3,"0")}.wav`)}catch{}}}try{const video=$("previewVideo");if(video&&Number.isFinite(previousTime)&&state.duration)video.currentTime=clamp(previousTime,0,state.duration)}catch{}transcribing=false;$("autoSubtitleBtn").disabled=false;$("cancelTranscriptionBtn").classList.add("hidden");if(memorySafeMode)releaseTemporaryMemory({silent:true});}}
function cancelAutoSubtitles(){if(!transcribing)return;transcriptionCancelled=true;subtitleWorkerReject?.(new Error("Transcription cancelled"));if(subtitleWorker){subtitleWorker.terminate();subtitleWorker=null}subtitleWorkerReady=null;subtitleWorkerResolve=null;subtitleWorkerReject=null;for(const pending of subtitlePending.values())pending.reject(new Error("Transcription cancelled"));subtitlePending.clear();updateSubtitleProgress("Cancelling… the current chunk will stop shortly")}
function setTrimEndpoint(which){const clip=selected();if(!clip)return toast("Select a clip first");const time=clamp($("previewVideo").currentTime||0,0,state.duration);if(which==="start")clip.start=Number(Math.min(time,clip.end-.5).toFixed(3));else clip.end=Number(Math.max(time,clip.start+.5).toFixed(3));clip.start=clamp(clip.start,0,Math.max(0,state.duration-.5));clip.end=clamp(clip.end,clip.start+.5,state.duration);commit();renderAll();toast(which==="start"?"Trim start set to playhead":"Trim end set to playhead")}
function nudgeTrim(which,delta){const clip=selected();if(!clip)return toast("Select a clip first");if(which==="start")clip.start=Number(clamp(clip.start+delta,0,clip.end-.5).toFixed(3));else clip.end=Number(clamp(clip.end+delta,clip.start+.5,state.duration).toFixed(3));commit();renderAll()}
function bumpTitleSize(delta){const clip=selected(),current=clip?.titleStyle||state.titleStyle;state.titleStyle={...state.titleStyle,...current,size:clamp(Number(current.size||30)+delta,14,108)};if(clip)clip.titleStyle={...state.titleStyle};if($("titleSize"))$("titleSize").value=state.titleStyle.size;updatePreview();commit()}
function applyTitlePreset(name){
  const make=(font,size,color,outline,extra={})=>({font,size,color,outline,opacity:1,bold:Number(extra.weight??800)>=700,italic:false,spacing:0,shadow:6,weight:800,transform:"none",align:"center",decoration:"none",outlineWidth:2,shadowColor:"#000000",glow:0,glowColor:"#8b5cf6",bgEnabled:false,bgColor:"#111827",bgOpacity:.72,bgPadding:10,bgRadius:10,rotation:0,lineHeight:1.08,positionY:17,...extra});
  const presets={
    cinema:make("Bebas Neue",42,"#ffffff","#101018",{outlineWidth:3,shadow:9,positionY:14}),
    meme:make("Bangers",48,"#ffe66d","#121212",{outlineWidth:4,shadow:8,rotation:-2,positionY:14}),
    minimal:make("Inter",28,"#ffffff","#000000",{outlineWidth:0,shadow:2,weight:600}),
    gaming:make("Anton",44,"#85f4ff","#061019",{outlineWidth:3,glow:4,glowColor:"#00c8ff",shadow:7,positionY:13}),
    editorial:make("Playfair Display",36,"#f7ead4","#17120f",{weight:700,outlineWidth:.5,shadow:2,positionY:18}),
    neon:make("Bricolage Grotesque",42,"#8bfff4","#032f38",{outlineWidth:1.5,glow:16,glowColor:"#00dcff",shadow:4,positionY:15}),
    retro:make("Bangers",44,"#ffe27a","#7b271b",{outlineWidth:4,shadow:8,rotation:-1,positionY:15}),
    horror:make("Oswald",42,"#ff526b","#180810",{outlineWidth:3,shadow:10,glow:4,glowColor:"#ac082b",positionY:14}),
    anime:make("Lilita One",42,"#fff36b","#1c1840",{outlineWidth:4,shadow:8,rotation:-1,positionY:14}),
    action:make("Anton",46,"#ffb34d","#2a0b06",{outlineWidth:4,shadow:10,rotation:-1,positionY:13}),
    luxury:make("DM Serif Display",36,"#f4d89a","#17120b",{weight:500,outlineWidth:1,shadow:4,spacing:1,positionY:18}),
    documentary:make("Lato",30,"#ffffff","#000000",{weight:700,outlineWidth:1,shadow:3,align:"left",positionY:12}),
    comedy:make("Fredoka",42,"#ffe45c","#301a12",{outlineWidth:4,shadow:7,rotation:1,positionY:14}),
    dreamy:make("Dancing Script",42,"#ffd6f1","#301d46",{weight:700,italic:true,outlineWidth:1,glow:8,glowColor:"#d18cff",shadow:5,positionY:17}),
    bold:make("Archivo Black",40,"#ffffff","#111111",{outlineWidth:4,shadow:10,transform:"uppercase",spacing:.5,positionY:15}),
    electric:make("League Spartan",42,"#8be7ff","#07142b",{outlineWidth:2,glow:13,glowColor:"#247bff",shadow:7,positionY:14}),
    manga:make("Bangers",44,"#ffffff","#000000",{outlineWidth:6,shadow:5,rotation:-2,positionY:15}),
    sports:make("Teko",48,"#d3ff5f","#12220d",{outlineWidth:3,shadow:8,transform:"uppercase",spacing:1,positionY:14}),
    romance:make("Playfair Display",36,"#ffc7df","#31172b",{italic:true,weight:600,outlineWidth:1,glow:5,glowColor:"#ef75ad",shadow:3,positionY:18}),
    serif:make("Merriweather",32,"#f4f0e7","#161616",{weight:700,outlineWidth:1,shadow:4,positionY:17}),
    mono:make("JetBrains Mono",27,"#a7ffd8","#06221b",{weight:700,outlineWidth:1,shadow:4,transform:"uppercase",spacing:1.5,positionY:16}),
    sunset:make("Raleway",38,"#ffc18a","#481c3a",{weight:800,outlineWidth:2,glow:6,glowColor:"#ff5a8a",shadow:7,positionY:15}),
    cyberpunk:make("Exo 2",40,"#ff68df","#260746",{outlineWidth:2,glow:12,glowColor:"#ff00d4",shadow:7,transform:"uppercase",spacing:1,positionY:14}),
    vintage:make("Lora",34,"#f2d8a8","#33200c",{weight:700,outlineWidth:1,shadow:4,spacing:.3,positionY:17}),
    outline:make("Montserrat",38,"#ffffff","#000000",{outlineWidth:5,shadow:2,positionY:15}),
    shadow:make("Poppins",36,"#ffffff","#121212",{outlineWidth:1,shadow:16,shadowColor:"#000000",positionY:15}),
    poster:make("Bebas Neue",48,"#fff06c","#121212",{outlineWidth:4,shadow:8,transform:"uppercase",spacing:1,positionY:13}),
    script:make("Caveat",46,"#ffffff","#282143",{italic:true,weight:700,outlineWidth:1,glow:4,glowColor:"#ad90ff",shadow:5,positionY:17}),
    alert:make("Oswald",39,"#ff5168","#24080e",{weight:800,outlineWidth:3,shadow:8,transform:"uppercase",spacing:.5,positionY:12}),
    glass:make("Manrope",34,"#ffffff","#101828",{weight:800,outlineWidth:0,shadow:5,bgEnabled:true,bgColor:"#101827",bgOpacity:.68,bgPadding:14,bgRadius:14,positionY:16})
  };
  const preset=presets[name];if(!preset)return;
  state.titleStyle={...state.titleStyle,...preset};
  const clip=selected();if(clip)clip.titleStyle={...state.titleStyle};
  syncInspector();updatePreview();commit();
  toast(`${name[0].toUpperCase()+name.slice(1)} heading preset applied`);
}
function previewTitleTyping(){const text=$("titleOverlayText").innerText.replace(/[\r\n]+/g," ").replace(/\s+/g," ").trim();const clip=selected();if(clip&&text){clip.title=text;persist()}}
function editTitleFromCanvas(){const text=$("titleOverlayText").innerText.replace(/[\r\n]+/g," ").replace(/\s+/g," ").trim();const clip=selected();if(!text||!clip)return;const clipId=clip.id,base=text.replace(/\s*[·–-]\s*Part\s+\d+\s*$/i,"").trim()||text;state.seriesTitle=base;state.clips=renumberAutoTitles(state.clips,i=>`${base} · Part ${i+1}`);const current=state.clips.find(item=>item.id===clipId);if(current){current.title=text;current.autoTitle=false}if($("seriesTitle"))$("seriesTitle").value=base;renderTimeline();renderClips();persist()}
function applyTitleStyleToAll(){if(!state.clips.length)return toast("Create clips first");state.clips.forEach(clip=>clip.titleStyle={...state.titleStyle});commit();renderAll();toast("Heading style copied to every clip")}
function applyCaptionToAll(){if(!state.clips.length)return toast("Create clips first");const text=$("captionText").value,style={style:$("captionStyle").value,highlight:$("captionHighlightColor").value,positionY:Number($("captionPositionY").value)};state.clips.forEach(clip=>{clip.caption=text;clip.captionStyle={...(clip.captionStyle||{}),...style}});commit();renderAll();toast("Manual caption copied to all clips")}
async function exportCurrentThumbnail(){
  const video=$("previewVideo");
  if(!video||video.readyState<2||!video.videoWidth)return toast("Load a video and wait for the preview first");
  await document.fonts?.ready;
  const canvas=document.createElement("canvas"),scale=Math.min(1,1920/video.videoWidth);
  canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
  const ctx=canvas.getContext("2d");if(!ctx)return toast("Could not create thumbnail canvas","error");
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const clip=selected(),style=clip?.titleStyle||state.titleStyle;
  const title=transformTitleText(clip?.title||state.seriesTitle,style.transform||"none");
  const typographyScale=canvas.width/420;
  const size=clamp(Number(style.size)||30,14,108)*typographyScale,weight=clamp(Number(style.weight??(style.bold===false?500:800)),100,900);
  const titleOpacity=clamp(Number(style.opacity??1),0,1);
  ctx.save();ctx.translate(canvas.width/2,canvas.height*clamp(Number(style.positionY??17),4,90)/100);ctx.rotate(clamp(Number(style.rotation)||0,-180,180)*Math.PI/180);
  ctx.font=`${style.italic?"italic ":""}${weight} ${size}px "${String(style.font||"Inter").replace(/["\\\\]/g,"")}"`;
  if("letterSpacing" in ctx)ctx.letterSpacing=String((Number(style.spacing)||0)*typographyScale)+"px";
  ctx.textAlign=style.align||"center";ctx.textBaseline="top";ctx.lineJoin="round";
  ctx.lineWidth=clamp(Number(style.outlineWidth??2),0,12)*typographyScale;ctx.strokeStyle=style.outline||"#000000";ctx.fillStyle=style.color||"#ffffff";
  ctx.shadowBlur=clamp(Number(style.shadow??6),0,16)*typographyScale;ctx.shadowColor=style.shadowColor||"#000000";
  const maxWidth=canvas.width*.9,words=title.split(/\s+/),lines=[];let line="";
  for(const word of words){const next=line?line+" "+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line);
  const lineHeight=size*clamp(Number(style.lineHeight??1.08),.8,1.5),drawLines=lines.slice(0,4);
  drawLines.forEach((value,index)=>{const y=index*lineHeight,metrics=ctx.measureText(value),width=Math.min(maxWidth,metrics.width);const tx=ctx.textAlign==="center"?0:ctx.textAlign==="right"?canvas.width*.45:-canvas.width*.45;const x=ctx.textAlign==="center"?-width/2:ctx.textAlign==="right"?tx-width:tx;
    if(style.bgEnabled){const pad=clamp(Number(style.bgPadding??10),0,30)*typographyScale;ctx.save();ctx.shadowBlur=0;ctx.fillStyle=hexToRgba(style.bgColor,style.bgOpacity??.72);const bx=x-pad,by=y-pad,bw=width+pad*2,bh=lineHeight+pad*2,rad=clamp(Number(style.bgRadius??10),0,24)*typographyScale;ctx.beginPath();ctx.roundRect?ctx.roundRect(bx,by,bw,bh,rad):(ctx.rect(bx,by,bw,bh));ctx.fill();ctx.restore()}
    ctx.globalAlpha=titleOpacity;
    ctx.fillStyle=style.color||"#ffffff";ctx.strokeStyle=style.outline||"#000000";ctx.lineWidth=clamp(Number(style.outlineWidth??2),0,12)*typographyScale;
    const glow=clamp(Number(style.glow)||0,0,24)*typographyScale,shadow=clamp(Number(style.shadow??6),0,16)*typographyScale;
    if(glow>0){ctx.save();ctx.shadowBlur=glow;ctx.shadowColor=style.glowColor||"#8b5cf6";ctx.strokeText(value,tx,y,maxWidth);ctx.fillText(value,tx,y,maxWidth);ctx.restore()}
    ctx.shadowBlur=shadow;ctx.shadowColor=style.shadowColor||"#000000";if(ctx.lineWidth>0)ctx.strokeText(value,tx,y,maxWidth);ctx.fillText(value,tx,y,maxWidth);
    ctx.globalAlpha=1;
  });
  ctx.restore();
  canvas.toBlob(blob=>{if(!blob)return toast("Thumbnail export failed","error");downloadBlob(blob,`${(state.projectName||"clipsmith").replace(/[^a-zA-Z0-9_-]+/g,"-")}-thumbnail.png`);toast("Thumbnail PNG saved")},"image/png")
}
function waitForVideoSeek(video,time){if(Math.abs(video.currentTime-time)<.01)return Promise.resolve();return new Promise(resolve=>{let timer;const finish=()=>{clearTimeout(timer);video.removeEventListener("seeked",finish);resolve()};video.addEventListener("seeked",finish,{once:true});timer=setTimeout(finish,1400);try{video.currentTime=time}catch{finish()}})}
async function scanSceneChanges(){const video=$("previewVideo"),button=$("sceneScanBtn"),status=$("sceneScanStatus"),results=$("sceneScanResults");if(sceneScanning)return;if(!video||video.readyState<2||!video.videoWidth)return toast("Import a video first");sceneScanning=true;button.disabled=true;results.classList.remove("hidden");results.innerHTML="";const original=video.currentTime,wasPlaying=!video.paused;video.pause();try{const canvas=document.createElement("canvas");canvas.width=64;canvas.height=36;const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)throw new Error("Frame sampling is unavailable in this browser");const count=Math.min(160,Math.max(20,Math.ceil(state.duration/2))),step=state.duration/count;let previous=null;const samples=[];for(let i=0;i<count;i++){const time=Math.min(Math.max(.02,state.duration-.02),i*step);await waitForVideoSeek(video,time);ctx.drawImage(video,0,0,64,36);const pixels=ctx.getImageData(0,0,64,36).data;let score=0;if(previous){for(let p=0;p<pixels.length;p+=4){const a=previous[p]*.2126+previous[p+1]*.7152+previous[p+2]*.0722,b=pixels[p]*.2126+pixels[p+1]*.7152+pixels[p+2]*.0722;score+=Math.abs(a-b)/255}score/=64*36;samples.push({time,score})}previous=new Uint8ClampedArray(pixels);status.textContent=`Sampling frames ${i+1}/${count} · suggestions are approximate`}const candidates=rankSceneChanges(samples,{threshold:.22,minGap:Math.max(1.2,step*1.25)}).sort((a,b)=>b.score-a.score).slice(0,16).sort((a,b)=>a.time-b.time);state.sceneSuggestions=candidates;results.innerHTML=candidates.length?`<div class="scene-results-head"><strong>${candidates.length} possible scene changes</strong><small>Review each before splitting.</small></div>`+candidates.map((item,i)=>`<div class="scene-result-row"><button class="soft-btn" data-jump-scene="${item.time}">${fmt(item.time)} <small>${Math.round(item.score*100)}% change</small></button><button class="primary-btn" data-split-scene="${item.time}">Split</button></div>`).join(""):'<p class="hint">No clear scene changes detected. Try a different video or split manually.</p>';status.textContent=`Scanned ${count} frames · review suggestions before using them`;toast(`Scene scan complete · ${candidates.length} suggestions`)}catch(error){status.textContent=error.message||"Scene scan failed";toast("Could not scan scene changes","error")}finally{sceneScanning=false;button.disabled=false;try{await waitForVideoSeek(video,clamp(original,0,state.duration));if(wasPlaying)await video.play()}catch{}}}
function applyCanvasAspect(){
  const stage=$("preview-stage"),canvas=$("preview-canvas");
  if(!stage||!canvas)return;
  const sizes={"16:9":[16,9],"9:16":[9,16],"1:1":[1,1],"4:5":[4,5]};
  const aspect=state.aspect in sizes?state.aspect:"16:9";
  const aspectTargets=[stage,canvas,document.querySelector(".preview-panel"),document.querySelector(".editor-center"),document.querySelector(".timeline-panel")];
  aspectTargets.forEach(el=>{if(el)el.dataset.aspect=aspect});
  const [ratioWidth,ratioHeight]=sizes[aspect];
  const stageStyle=getComputedStyle(stage);
  const availableWidth=stage.clientWidth-(parseFloat(stageStyle.paddingLeft)||0)-(parseFloat(stageStyle.paddingRight)||0);
  const availableHeight=stage.clientHeight-(parseFloat(stageStyle.paddingTop)||0)-(parseFloat(stageStyle.paddingBottom)||0);
  if(availableWidth<2||availableHeight<2)return;
  const ratio=ratioWidth/ratioHeight;
  let width=Math.min(availableWidth,availableHeight*ratio);
  let height=width/ratio;
  if(height>availableHeight){height=availableHeight;width=height*ratio}
  width=Math.max(1,Math.floor(width));
  height=Math.max(1,Math.floor(height));
  canvas.style.width=width+"px";
  canvas.style.height=height+"px";
  canvas.style.aspectRatio=ratioWidth+" / "+ratioHeight;
  canvas.dataset.aspect=aspect;
  const badge=$("ratioBadge");
  if(badge)badge.textContent=aspect;
  fitCanvasOverlayText();
}
function fitCanvasOverlayText(){
  const canvas=$("preview-canvas");
  if(!canvas)return;
  const width=canvas.clientWidth;
  if(width<2)return;
  const clip=selected(),style=clip?.titleStyle||state.titleStyle;
  // Use one ratio-aware scale for text, tracking, stroke, glow and backing
  // spacing. This keeps presets visually consistent on landscape, square,
  // portrait, and 4:5 canvases without making narrow text illegible.
  const scale=Math.max(.28,width/420);
  const titleFontSize=Math.max(12,(Number(style?.size)||30)*scale);
  const title=$("titleOverlay"),titleText=$("titleOverlayText");
  const font=String(style?.font||"Inter").replace(/["\\\\]/g,"").trim()||"Inter";
  const weight=clamp(Number(style?.weight??(style?.bold===false?500:800)),100,900);
  const shadow=clamp(Number(style?.shadow??6),0,16),glow=clamp(Number(style?.glow??0),0,24);
  const shadows=[];
  if(shadow>0)shadows.push(`0 ${Math.max(.5,2*scale)}px ${Math.max(.6,shadow*scale)}px ${style?.shadowColor||"#000000"}`);
  if(glow>0)shadows.push(`0 0 ${Math.max(.6,glow*scale)}px ${style?.glowColor||"#8b5cf6"}`);
  Object.assign(titleText.style,{
    fontFamily:`"${font}", Inter, sans-serif`,
    fontSize:titleFontSize+"px",
    width:style?.bgEnabled?"auto":"100%",
    maxWidth:"100%",
    fontWeight:weight,
    fontStyle:style?.italic?"italic":"normal",
    letterSpacing:(clamp(Number(style?.spacing)||0,-2,10)*scale)+"px",
    color:style?.color||"#ffffff",
    opacity:String(clamp(Number(style?.opacity??1),0,1)),
    textTransform:style?.transform||"none",
    textAlign:style?.align||"center",
    textDecoration:style?.decoration||"none",
    lineHeight:String(clamp(Number(style?.lineHeight??1.08),.8,1.5)),
    textShadow:shadows.join(", ")||"none",
    fontKerning:"normal",
    textRendering:"geometricPrecision"
  });
  titleText.style.setProperty("-webkit-text-stroke",clamp(Number(style?.outlineWidth??2),0,12)*scale>0
    ?`${(clamp(Number(style?.outlineWidth??2),0,12)*scale).toFixed(2)}px ${style?.outline||"#000000"}`
    :"0 transparent");
  if(title){
    title.style.fontSize=titleFontSize+"px";
    title.style.lineHeight=String(clamp(Number(style?.lineHeight??1.08),.8,1.5));
    title.style.opacity="1";
    title.style.padding=style?.bgEnabled?`${clamp(Number(style?.bgPadding??10),0,30)*scale}px`:"0px";
    title.style.borderRadius=style?.bgEnabled?`${clamp(Number(style?.bgRadius??10),0,24)*scale}px`:"0px";
  }
  const caption=$("captionOverlay");
  if(caption)caption.style.fontSize=Math.max(11,21*Math.min(1,Math.max(.52,width/420)))+"px";
  const subtitle=$("subtitleOverlay");
  if(subtitle)subtitle.style.fontSize=Math.max(10,Math.min(26,width*.055))+"px";
}
const canvasAspectObserver=typeof ResizeObserver!=="undefined"?new ResizeObserver(()=>requestAnimationFrame(applyCanvasAspect)):null;
canvasAspectObserver?.observe($("preview-stage"));
const canvasTextObserver=typeof ResizeObserver!=="undefined"?new ResizeObserver(()=>requestAnimationFrame(fitCanvasOverlayText)):null;
canvasTextObserver?.observe($("preview-canvas"));
window.addEventListener("resize",()=>requestAnimationFrame(applyCanvasAspect),{passive:true});
function renderAll(){renderTimeline();renderClips();renderSkipRanges();renderSubtitleCueList();syncInspector();updatePreview();$("aspectSelect").value=state.aspect;applyCanvasAspect();if($("burnOverlaysToggle"))$("burnOverlaysToggle").checked=state.burnOverlays!==false;$("ratioBadge").textContent=state.aspect;$("safeZones").classList.toggle("hidden",!state.showSafe);$$('#durationChips button').forEach(b=>b.classList.toggle('active',b.dataset.duration===String(state.durationPreset)||(b.dataset.duration==="custom"&&![15,30,45,60].includes(state.durationPreset))));setTimeInputs("duration",state.durationPreset);$("durationBadge").textContent=fmt(state.duration);$("totalTime").textContent=fmt(state.duration);$("timelineHint").textContent=state.clips.length?`${state.clips.length} clips · select one to edit`:"Your sequence is empty";if($("projectName"))$("projectName").value=state.projectName}
function setTool(tool){if(typeof tool!=="string"||!tool)return;if(tool==="preview"){state.activeTool="preview";$("inspector").classList.remove("open");$$('.tool,.mobile-tab').forEach(x=>x.classList.remove('active'));$$('.mobile-tab[data-tool="preview"]').forEach(x=>x.classList.add('active'));return}state.activeTool=tool;$$('.tool,.mobile-tab').forEach(x=>x.classList.toggle('active',x.dataset.tool===tool));$$('.inspector-pane').forEach(x=>x.classList.add('hidden'));const pane=$("pane-"+tool);if(pane)pane.classList.remove('hidden');$("inspectorTitle").textContent=tool==="cut"?"Clips":tool==="creator"?"Creator Intelligence":tool[0].toUpperCase()+tool.slice(1);if(innerWidth<=820)$("inspector").classList.add('open')}
function updateImportStatus(text,type="info"){const n=$("importStatus");if(n){n.textContent=text;n.dataset.state=type}}
function updateSource(file,{sourceUrl=""}={}){if(!file)return;previewSourceVersion++;if(pendingRecoverySnapshot){pendingRecoverySnapshot=null;hideDraftRecoveryPrompt()}restoreExistingClipsOnLoad=false;if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.subtitleCues=[];subtitleCueLimit=80;renderSubtitleCueList();updateActiveSubtitle();state.skipRanges=[];setTimeInputs("skipStart",null);setTimeInputs("skipEnd",null);renderSkipRanges();state.sourceFile=file;state.sourceUrl=sourceUrl;state.sourceMeta={fileName:file.name,fileSize:file.size,sourceUrl,duration:0};state.objectUrl=URL.createObjectURL(file);const v=$("previewVideo");v.src=state.objectUrl;v.load();$("mediaName").textContent=file.name;$("previewEmptyTitle").textContent="Preparing your edit…";$("previewEmptyHint").textContent="Reading the video and building your first clip plan."; $("previewEmpty").classList.remove("hidden");updateImportStatus("Reading video metadata…","loading");setSave("● Media loaded");persist();void rememberSourceMedia(file)}
async function loadFile(file,{memoryCheckConfirmed=false}={}){
  if(!file)return;
  const kind=getImportKind(file);
  if(kind==="zip"){
    try{
      const episode=await chooseVideoFromZip(file,{onStatus:updateImportStatus,onBeforeExtract:({fileSize})=>{if(!memorySafeMode)return true;const warning=getMediaMemoryWarning({fileSize,duration:0});return !warning||confirm("ClipSmith ZIP memory-safety check:\n\n"+warning+"\n\nExtracting this episode may temporarily duplicate its storage in memory. Continue?")}});
      if(episode)await loadFile(episode,{memoryCheckConfirmed:true});
      else updateImportStatus("ZIP selection cancelled.","info");
    }catch(error){
      const message=error?.message||"Could not read that ZIP archive.";
      updateImportStatus(message,"error");
      toast(message,"error");
    }
    return;
  }
  if(kind==="unsupported-archive"){
    const message="ClipSmith can browse .zip archives directly. Convert this .7z/.rar/.tar archive to ZIP first.";
    updateImportStatus(message,"error");toast(message,"error");return;
  }
  if(kind!=="video"){
    const message="Choose a video file or a ZIP archive containing video episodes. ClipSmith accepts common video containers and can attempt a local compatibility conversion if the browser cannot decode the video.";
    updateImportStatus(message,"error");toast("Choose a video file or ZIP archive","error");return;
  }
  if(memorySafeMode&&!memoryCheckConfirmed){
    const warning=getMediaMemoryWarning({fileSize:file.size,duration:0});
    if(warning&&!confirm("ClipSmith memory-safety check:\\n\\n"+warning+"\\n\\nClose other apps before continuing. Continue anyway?"))return;
  }
  updateSource(file);
}

async function recoverPreviewCompatibility(file){
  if(!file||getImportKind(file)!=="video")return;
  if(previewCompatibilityBusy){queuedPreviewRecoveryFile=file;return;}
  if(previewCompatibilityAttempts.has(file)){
    $("previewEmptyTitle").textContent="This video could not be decoded";
    $("previewEmptyHint").textContent="ClipSmith already tried a local H.264/AAC compatibility conversion. Try a smaller MP4 or a different source file.";
    updateImportStatus("Preview failed after compatibility conversion. The original file is still selected.","error");
    return;
  }
  if(file.size>1.75*1024*1024*1024){
    previewCompatibilityAttempts.add(file);
    const message="This source is over ClipSmith's 1.75 GB in-browser conversion limit. The browser could not decode it; try a smaller compatible MP4.";
    $("previewEmptyTitle").textContent="Source too large to convert safely";
    $("previewEmptyHint").textContent=message;
    updateImportStatus(message,"error");
    return;
  }
  if(memorySafeMode&&file.size>1024*1024*1024&&!confirm("This format needs local video conversion. A source over 1 GB may use substantial RAM. Continue?")){
    previewCompatibilityAttempts.add(file);
    updateImportStatus("Compatibility conversion cancelled. The original file remains selected.","error");
    return;
  }
  previewCompatibilityBusy=true;
  previewCompatibilityAttempts.add(file);
  const sourceVersion=previewSourceVersion;
  let ff=null,input="",output="",progressHandler=null;
  try{
    $("previewEmpty").classList.remove("hidden");
    $("previewEmptyTitle").textContent="Preparing a compatible preview…";
    $("previewEmptyHint").textContent="Converting locally in your browser. The original episode is kept for clip export.";
    updateImportStatus("Browser could not decode this source. Loading the local compatibility converter…","loading");
    ff=await getFFmpeg();
    const ext=(file.name.match(/\.([a-z0-9]{1,8})$/i)?.[1]||"mp4").toLowerCase();
    const inputExt=/^(mp4|m4v|mov|webm|mkv|avi|ogv|ogg|mpeg|mpg|mts|m2ts|ts|flv|wmv|3gp|3g2|asf|vob|divx|mxf|m2v|mpv|qt|f4v|rm|rmvb)$/.test(ext)?ext:"mp4";
    input="compat-source-"+uid()+"."+inputExt;
    output="compat-preview-"+uid()+".mp4";
    progressHandler=({progress})=>{
      if(sourceVersion===previewSourceVersion)updateImportStatus("Converting preview locally… "+Math.round(clamp(Number(progress)||0,0,1)*100)+"%","loading");
    };
    ff.on("progress",progressHandler);
    await ff.writeFile(input,new Uint8Array(await file.arrayBuffer()));
    await ff.exec(["-hide_banner","-y","-i",input,"-map","0:v:0","-map","0:a:0?","-sn","-dn","-c:v","libx264","-preset","ultrafast","-crf","21","-pix_fmt","yuv420p","-c:a","aac","-b:a","160k","-movflags","+faststart",output]);
    const bytes=await ff.readFile(output);
    const previewName=(file.name.replace(/\.[^.]+$/,"")||"episode")+".clipsmith-preview.mp4";
    const compatibleFile=new File([bytes],previewName,{type:"video/mp4",lastModified:file.lastModified||Date.now()});
    if(sourceVersion!==previewSourceVersion||state.sourceFile!==file)return;
    if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
    state.objectUrl=URL.createObjectURL(compatibleFile);
    const video=$("previewVideo");
    video.pause();video.src=state.objectUrl;video.load();
    previewSourceVersion++;
    $("previewEmptyTitle").textContent="Preparing a compatible preview…";
    $("previewEmptyHint").textContent="The original source stays local and is still used for clip exports.";
    updateImportStatus("Compatible preview ready · original source retained for export.","ready");
    toast("Compatible preview prepared");
  }catch(error){
    if(sourceVersion===previewSourceVersion){
      const detail=error?.message||"The converter could not read this file.";
      $("previewEmptyTitle").textContent="Could not prepare this video";
      $("previewEmptyHint").textContent="Try another episode or use an MP4 with H.264 video and AAC audio. "+detail;
      updateImportStatus("Compatibility conversion failed: "+detail,"error");
      toast("Could not decode this video","error");
    }
  }finally{
    if(ff){
      if(progressHandler){try{ff.off("progress",progressHandler)}catch{}}
      for(const path of [input,output])if(path){try{await ff.deleteFile(path)}catch{}}
      if(memorySafeMode)releaseTemporaryMemory({silent:true});
    }
    previewCompatibilityBusy=false;
    const queued=queuedPreviewRecoveryFile;queuedPreviewRecoveryFile=null;
    if(queued&&queued===state.sourceFile)void recoverPreviewCompatibility(queued);
  }
}

async function readBlobWithLimit(response,maxBytes){
  const reader=response.body?.getReader?.();
  if(!reader){
    const blob=await response.blob();
    if(blob.size>maxBytes)throw Error("This video is over 300 MB. Upload the local file instead for better reliability.");
    return blob;
  }
  const chunks=[];
  let bytesRead=0;
  try{
    while(true){
      const part=await reader.read();
      if(part.done)break;
      bytesRead+=part.value?.byteLength||0;
      if(bytesRead>maxBytes){
        try{await reader.cancel()}catch{}
        throw Error("This video is over 300 MB. Upload the local file instead for better reliability.");
      }
      if(part.value)chunks.push(part.value);
    }
  }finally{try{reader.releaseLock()}catch{}}
  const mime=(response.headers.get("content-type")||"application/octet-stream").split(";")[0];
  return new Blob(chunks,{type:mime});
}
async function loadUrl(){const raw=$("videoUrl").value.trim();if(!raw)return toast("Paste a direct video file link first","error");let url;try{url=new URL(raw);if(!/^https?:$/.test(url.protocol))throw Error("Only http/https links are supported")}catch(e){updateImportStatus(e.message,"error");return}const b=$("loadUrlBtn");b.disabled=true;updateImportStatus("Fetching the video into this tab…","loading");try{const r=await fetch(url,{mode:'cors',credentials:'omit'});if(!r.ok)throw Error(`Host returned HTTP ${r.status}`);const mime=(r.headers.get('content-type')||'').toLowerCase();if(mime.includes('text/html'))throw Error("That URL is a webpage, not a direct video file");const maxUrlBytes=300*1024*1024;const lengthHeader=r.headers.get('content-length');const advertisedBytes=Number(lengthHeader);if(lengthHeader!==null&&Number.isFinite(advertisedBytes)&&advertisedBytes>maxUrlBytes)throw Error("This video is over 300 MB. Upload the local file instead for better reliability.");if(memorySafeMode&&lengthHeader!==null&&Number.isFinite(advertisedBytes)&&advertisedBytes>0){const warning=getMediaMemoryWarning({fileSize:advertisedBytes,duration:0});if(warning&&!confirm("ClipSmith memory-safety check before download:\n\n"+warning+"\n\nContinue downloading this video into the browser?")){updateImportStatus("URL import cancelled before download","info");return}}const blob=await readBlobWithLimit(r,maxUrlBytes);let name=decodeURIComponent(url.pathname.split('/').pop()||'video.mp4').replace(/[\\/:*?"<>|]/g,'-');if(!/\.(mp4|webm|mov|mkv|m4v|ogv)$/i.test(name))name=mime.includes('webm')?'video.webm':'video.mp4';const linkedFile=new File([blob],name,{type:getVideoMimeType(name,blob.type||mime)});if(memorySafeMode){const warning=getMediaMemoryWarning({fileSize:linkedFile.size,duration:0});if(warning&&!confirm("ClipSmith memory-safety check:\n\n"+warning+"\n\nContinue anyway?"))return}updateSource(linkedFile,{sourceUrl:url.href});updateImportStatus("Video imported locally · preparing preview…","loading")}catch(e){updateImportStatus(e.message||"Could not import that link","error");toast("Link import failed","error")}finally{b.disabled=false}}
$("uploadBtn").onclick=$("dropBrowseBtn").onclick=$("emptyUploadBtn").onclick=()=>$("videoInput").click();$("videoInput").onchange=e=>{void loadFile(e.target.files?.[0]);e.target.value=''};$("dropCard").ondragover=e=>e.preventDefault();$("dropCard").ondrop=e=>{e.preventDefault();void loadFile(e.dataTransfer.files?.[0])};$("loadUrlBtn").onclick=loadUrl;$("videoUrl").onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();loadUrl()}};
$("previewVideo").onerror=()=>{const video=$("previewVideo"),file=state.sourceFile;if(!file)return;if(video.currentSrc&&state.objectUrl&&video.currentSrc!==state.objectUrl)return;void recoverPreviewCompatibility(file)};
$("previewVideo").onloadedmetadata=()=>{const d=Number($("previewVideo").duration);if(!Number.isFinite(d)||d<=0)return $("previewVideo").onerror?.();state.duration=d;state.sourceMeta={...(state.sourceMeta||{}),duration:d};$("previewEmpty").classList.add("hidden");$("totalTime").textContent=fmt(d);$("durationBadge").textContent=fmt(d);if(restoreExistingClipsOnLoad&&state.clips.length){restoreExistingClipsOnLoad=false;state.selectedId=state.clips.some(c=>c.id===state.selectedId)?state.selectedId:(state.clips[0]?.id||null);renderAll();lastCommitted=snap();updateImportStatus(`Memory restored · ${state.clips.length} saved clips reconnected`,"ready");setMemoryStatus("Project fully restored",`${state.clips.length} clips, subtitles and source video are ready. Changes continue to autosave.`);setMemoryVaultStatus("Project fully restored",`${state.clips.length} clips, subtitles and source video are ready. Changes continue to autosave.`);void refreshMemoryVaultStats();toast("Project and source video restored")}else{restoreExistingClipsOnLoad=false;generateClips({notify:false});updateImportStatus(`Ready · ${state.clips.length} clips planned at ${state.durationPreset}s`,"ready");toast("Video ready")}};
function syncPlaybackClip(time){const active=state.clips.find(c=>time>=c.start&&time<c.end);if(!active||active.id===state.selectedId)return;state.selectedId=active.id;$(".timeline-block, .clip-card").forEach(node=>node.classList.toggle("selected",node.dataset.clipId===active.id));if($("selectedClipLabel"))$("selectedClipLabel").textContent=active.title;syncInspector();updatePreview()}
$("previewVideo").ontimeupdate=()=>{const v=$("previewVideo");$("currentTime").textContent=fmt(v.currentTime);$("seekBar").value=state.duration?v.currentTime/state.duration*100:0;syncPlaybackClip(v.currentTime);updateActiveSubtitle()};
$("previewVideo").onplay=()=>{$("playBtn").textContent='Ⅱ'};
$("previewVideo").onpause=()=>{$("playBtn").textContent='▶'};
$("previewVideo").onended=()=>{$("playBtn").textContent='▶'};
$("playBtn").onclick=()=>{const v=$("previewVideo");if(v.paused){if(Number.isFinite(v.duration)&&v.currentTime>=v.duration-.05)v.currentTime=0;v.play().catch(()=>toast("Playback could not start","error"))}else v.pause()};$("backBtn").onclick=()=>$("previewVideo").currentTime=clamp($("previewVideo").currentTime-5,0,state.duration);$("forwardBtn").onclick=()=>$("previewVideo").currentTime=clamp($("previewVideo").currentTime+5,0,state.duration);$("seekBar").oninput=e=>$("previewVideo").currentTime=Number(e.target.value)/100*state.duration;
// Action-only mobile tabs deliberately have no data-tool; keep them out of setTool routing.
$$('.tool,.mobile-tab').forEach(b=>b.onclick=()=>{if(b.dataset.tool)setTool(b.dataset.tool)});$("undoBtn").onclick=undo;$("redoBtn").onclick=redo;$("closeInspectorBtn").onclick=()=>$("inspector").classList.remove('open');$("splitAtPlayheadBtn").onclick=splitSelected;$("duplicateClipBtn").onclick=duplicateSelected;$("moveClipEarlierBtn").onclick=()=>moveSelected(-1);$("moveClipLaterBtn").onclick=()=>moveSelected(1);$("deleteClipBtn").onclick=deleteSelected;
$("durationChips").onclick=e=>{const b=e.target.closest("button");if(!b)return;$$("#durationChips button").forEach(x=>x.classList.remove("active"));b.classList.add("active");if(b.dataset.duration==="custom"){$("customDurationWrap").classList.remove("hidden");setTimeInputs("duration",state.durationPreset)}else{state.durationPreset=Number(b.dataset.duration);$("customDurationWrap").classList.add("hidden")}};["durationHours","durationMinutes","durationSeconds"].forEach(id=>$(id).oninput=()=>{const seconds=timeFromInputs("duration");if(seconds!==null)state.durationPreset=clamp(seconds,1,86400)});$("generateClipsBtn").onclick=()=>generateClips();$("applyTitleBtn").onclick=applyTitle;
$("setSkipStartBtn").onclick=()=>setSkipFromPlayhead("start");$("setSkipEndBtn").onclick=()=>setSkipFromPlayhead("end");$("addSkipRangeBtn").onclick=addSkipRange;$("clearSkipRangesBtn").onclick=clearSkipRanges;$("applySkipRangesBtn").onclick=()=>{if(!state.duration)return toast("Load a video first");generateClips()};$("skipRangeList").onclick=e=>{const b=e.target.closest("[data-remove-skip]");if(!b)return;state.skipRanges=state.skipRanges.filter(r=>r.id!==b.dataset.removeSkip);commit();renderSkipRanges();toast("Skip mark removed. Rebuild the clip plan to apply the change.")};$("applyTrimBtn").onclick=()=>{const c=selected();if(!c)return toast("Select a clip first");const rawStart=timeFromInputs("clipStart"),rawEnd=timeFromInputs("clipEnd");if(rawStart===null||rawEnd===null)return toast("Use 0–59 for minutes and seconds","error");const start=clamp(rawStart,0,state.duration),end=clamp(rawEnd,0,state.duration);if(end-start<0.5)return toast("End time must be at least 0.5 seconds after start","error");c.start=Number(start.toFixed(3));c.end=Number(end.toFixed(3));commit();renderAll();toast("Trim applied")};
$("captionText").oninput=e=>{const c=selected();if(c)c.caption=e.target.value;else state.captionStyle.text=e.target.value;updatePreview();persist()};$("applyCaptionBtn").onclick=()=>{const c=selected();if(!c)return toast("Select a clip first");c.caption=$("captionText").value;c.captionStyle={...c.captionStyle,style:$("captionStyle").value,highlight:$("captionHighlightColor").value,positionY:Number($("captionPositionY").value)};commit();updatePreview();toast("Caption applied")};
const titleControlMap={titleFont:"font",titleSize:"size",titleColor:"color",titleOutline:"outline",titleOpacity:"opacity",titleBold:"bold",titleItalic:"italic",titleSpacing:"spacing",titleShadow:"shadow",titleWeight:"weight",titleTransform:"transform",titleAlign:"align",titleDecoration:"decoration",titleOutlineWidth:"outlineWidth",titleShadowColor:"shadowColor",titleGlow:"glow",titleGlowColor:"glowColor",titleBgEnabled:"bgEnabled",titleBgColor:"bgColor",titleBgOpacity:"bgOpacity",titleBgPadding:"bgPadding",titleBgRadius:"bgRadius",titleRotation:"rotation",titleLineHeight:"lineHeight",titlePositionY:"positionY"};
const titleNumberKeys=new Set(["size","opacity","spacing","shadow","weight","outlineWidth","glow","bgOpacity","bgPadding","bgRadius","rotation","lineHeight","positionY"]);
Object.entries(titleControlMap).forEach(([id,key])=>{const control=$(id);if(!control)return;const applyTitleControl=event=>{const raw=event.currentTarget.type==="checkbox"?event.currentTarget.checked:event.currentTarget.value;const value=titleNumberKeys.has(key)?Number(raw):raw;state.titleStyle={...state.titleStyle,[key]:value};if(key==="weight"){state.titleStyle.bold=Number(value)>=700;const boldControl=$("titleBold");if(boldControl)boldControl.checked=state.titleStyle.bold}if(key==="bold"){const currentWeight=clamp(Number(state.titleStyle.weight)||800,100,900);state.titleStyle.weight=value?Math.max(700,currentWeight):(currentWeight>=700?500:currentWeight);const weightControl=$("titleWeight");if(weightControl)weightControl.value=state.titleStyle.weight}if(key==="font")control.style.fontFamily=`"${String(value).replace(/["\\\\]/g,"")}"`;if(key==="color"&&$("canvasTitleColor"))$("canvasTitleColor").value=String(value);const c=selected();if(c)c.titleStyle={...state.titleStyle};updatePreview();persist()};control.addEventListener("input",applyTitleControl);control.addEventListener("change",applyTitleControl)});

["fxPreset","fxBrightness","fxContrast","fxSaturation","fxBlur","fxSpeed","fxVolume","fxMute"].forEach(id=>$(id).oninput=e=>{const c=selected();if(!c)return;const fx={...DEFAULT_FX,...(c.fx||{})};const k=id==='fxMute'?'mute':id.slice(2).toLowerCase();if(id==='fxPreset'){fx.preset=e.target.value;if(fx.preset==='Cinema')Object.assign(fx,{contrast:1.12,saturation:.82,brightness:-.03});if(fx.preset==='Vibrant')Object.assign(fx,{contrast:1.08,saturation:1.35,brightness:.02});if(fx.preset==='Mono')fx.saturation=0;if(fx.preset==='Dreamy')Object.assign(fx,{brightness:.07,saturation:1.1,blur:.3});if(fx.preset==='Original')Object.assign(fx,DEFAULT_FX)}else fx[k]=id==='fxMute'?e.target.checked:Number(e.target.value);c.fx=fx;syncInspector();updatePreview();persist()});
$("autoSubtitleBtn").onclick=generateAutoSubtitles;$("cancelTranscriptionBtn").onclick=cancelAutoSubtitles;$("downloadSrtBtn").onclick=downloadSubtitleFile;
$("clearSubtitlesBtn").onclick=()=>{if(!state.subtitleCues.length)return toast("No subtitles to clear");state.subtitleCues=[];subtitleCueLimit=80;commit();renderSubtitleCueList();updateActiveSubtitle();updateSubtitleProgress("Subtitles cleared.");toast("Subtitle cues cleared")};$("showMoreCuesBtn").onclick=()=>{subtitleCueLimit+=80;renderSubtitleCueList()};
$("subtitleCueList").addEventListener("input",event=>{const field=event.target.closest("[data-subtitle-edit]");if(!field)return;const index=Number(field.dataset.subtitleEdit);if(!Number.isInteger(index)||!state.subtitleCues[index])return;state.subtitleCues[index].text=field.value;updateActiveSubtitle();persist()});$("subtitleCueList").addEventListener("focusout",event=>{if(event.target.closest("[data-subtitle-edit]"))commit()});
$("subtitleCueList").addEventListener("click",event=>{const seek=event.target.closest("[data-cue-seek]");if(seek){const cue=state.subtitleCues[Number(seek.dataset.cueSeek)];if(cue){$("previewVideo").currentTime=cue.start;const clip=state.clips.find(item=>cue.start>=item.start&&cue.start<=item.end);if(clip){state.selectedId=clip.id;syncInspector();renderTimeline();renderClips()}updateActiveSubtitle()}return}const remove=event.target.closest("[data-cue-remove]");if(remove){const index=Number(remove.dataset.cueRemove);state.subtitleCues.splice(index,1);commit();renderSubtitleCueList();updateActiveSubtitle()}});
["subtitleStyle","subtitleHighlightColor","subtitlePositionY"].forEach(id=>$(id).addEventListener("input",()=>{state.subtitleSettings={style:$("subtitleStyle").value,highlight:$("subtitleHighlightColor").value,positionY:Number($("subtitlePositionY").value)};updateActiveSubtitle();persist()}));
$("applySubtitleStyleBtn").onclick=()=>{state.subtitleSettings={style:$("subtitleStyle").value,highlight:$("subtitleHighlightColor").value,positionY:Number($("subtitlePositionY").value)};commit();updateActiveSubtitle();toast("Subtitle look applied to every cue")};
$("applyCaptionAllBtn").onclick=applyCaptionToAll;
$("applyStyleAllBtn").onclick=applyTitleStyleToAll;
$$("[data-title-preset]").forEach(button=>button.addEventListener("click",()=>applyTitlePreset(button.dataset.titlePreset)));
$("titleSizeDownBtn").onclick=()=>bumpTitleSize(-2);$("titleSizeUpBtn").onclick=()=>bumpTitleSize(2);$("canvasTitleColor").oninput=event=>{state.titleStyle={...state.titleStyle,color:event.target.value};if($("titleColor"))$("titleColor").value=event.target.value;const clip=selected();if(clip)clip.titleStyle={...state.titleStyle};updatePreview();persist()};
$("titleOverlayText").addEventListener("input",previewTitleTyping);$("titleOverlayText").addEventListener("blur",()=>{editTitleFromCanvas();commit();updatePreview()});
$("thumbnailBtn").onclick=exportCurrentThumbnail;$("sceneScanBtn").onclick=scanSceneChanges;
$("sceneScanResults").onclick=event=>{const jump=event.target.closest("[data-jump-scene]"),split=event.target.closest("[data-split-scene]"),button=jump||split;if(!button)return;const time=Number(button.dataset.jumpScene??button.dataset.splitScene);if(!Number.isFinite(time))return;const video=$("previewVideo"),clip=state.clips.find(item=>time>=item.start+.05&&time<=item.end-.05);if(split){if(!clip)return toast("This scene change is too close to a clip boundary");state.selectedId=clip.id;video.currentTime=time;splitSelected();return}if(clip)state.selectedId=clip.id;renderAll();video.currentTime=time;updateActiveSubtitle()};
$("setTrimStartBtn").onclick=()=>setTrimEndpoint("start");$("setTrimEndBtn").onclick=()=>setTrimEndpoint("end");$("nudgeStartBackBtn").onclick=()=>nudgeTrim("start",-.5);$("nudgeStartForwardBtn").onclick=()=>nudgeTrim("start",.5);$("nudgeEndBackBtn").onclick=()=>nudgeTrim("end",-.5);$("nudgeEndForwardBtn").onclick=()=>nudgeTrim("end",.5);
$("keyboardHelpBtn").onclick=()=>$("keyboardHelpModal").classList.remove("hidden");$("closeKeyboardHelpBtn").onclick=()=>$("keyboardHelpModal").classList.add("hidden");$("keyboardHelpModal").addEventListener("click",event=>{if(event.target.id==="keyboardHelpModal")$("keyboardHelpModal").classList.add("hidden")});
$("aspectSelect").onchange=e=>{state.aspect=e.target.value;commit();renderAll();requestAnimationFrame(()=>{applyCanvasAspect();fitCanvasOverlayText()})};$("exportAspectSelect").onchange=e=>{state.exportAspect=e.target.value;if(state.exportAspect!=='source'&&exportMode==='copy'){exportMode='smart';$$('.export-mode').forEach(x=>x.classList.toggle('active',x.dataset.mode==='smart'))}commit()};$("safeZoneBtn").onclick=()=>{state.showSafe=!state.showSafe;commit();renderAll()};
$("exportBtn").onclick=()=>openExport();$("closeExportBtn").onclick=()=>$("export-queue").classList.add('hidden');$$('.export-mode').forEach(b=>b.onclick=()=>{$$('.export-mode').forEach(x=>x.classList.remove('active'));b.classList.add('active');exportMode=b.dataset.mode;if(exportMode==='copy'){if(state.burnOverlays){state.burnOverlays=false;if($("burnOverlaysToggle"))$("burnOverlaysToggle").checked=false}if(state.exportAspect!=='source'){state.exportAspect='source';$("exportAspectSelect").value='source'}commit();toast('Original stream keeps the source picture; text burn-in and aspect conversion are disabled')}});$("burnOverlaysToggle").onchange=e=>{state.burnOverlays=e.target.checked;if(state.burnOverlays&&exportMode==='copy'){exportMode='smart';$$('.export-mode').forEach(x=>x.classList.toggle('active',x.dataset.mode==='smart'))}commit();toast(state.burnOverlays?'Heading and timed subtitles will be burned into the MP4':'Export will keep text as editable preview-only overlays')};
function openExport(){if(!state.clips.length)return toast("Create clips first");if(!state.sourceFile)return toast("Re-import the source video before exporting","error");if(memorySafeMode){const warning=getMediaMemoryWarning({fileSize:state.sourceFile.size,duration:state.duration});if(warning&&!confirm("ClipSmith memory-safety check:\n\n"+warning+"\n\nExporting processes one clip at a time, but large sources still need RAM. Continue?"))return}$("export-queue").classList.remove('hidden');$("exportAspectSelect").value=state.exportAspect||"source";$("burnOverlaysToggle").checked=state.burnOverlays!==false;$("exportSummary").textContent=`${state.clips.length} clips · ${fmt(state.clips.reduce((a,c)=>a+c.end-c.start,0))} total`;$("memoryHint").textContent=`Smart export · serial processing · ${navigator.deviceMemory?`${navigator.deviceMemory} GB`:'memory unknown'}`;renderQueue(state.clips)}
async function renderClip(c,i,mode){
  const fx={...DEFAULT_FX,...(c.fx||{})};
  const needsFilter=fx.speed!==1||fx.brightness!==0||fx.contrast!==1||fx.saturation!==1||fx.blur>0||fx.volume!==1||fx.mute||fx.normalize;
  const needsAspect=state.exportAspect!=='source';
  const needsOverlay=state.burnOverlays!==false&&Boolean(c.title||c.caption||state.subtitleCues.some(q=>q.end>c.start&&q.start<c.end));
  if(mode==='copy'&&(needsFilter||needsAspect||needsOverlay))throw Error('Original stream cannot apply visual/audio edits, change aspect ratio, or burn text. Turn off burn-in or choose Smart / High quality.');
  const ff=await getFFmpeg(),input=`source-${uid()}`,output=`clip-${uid()}.mp4`,assFile=`clip-overlay-${uid()}.ass`;
  const duration=Math.max(.5,c.end-c.start);
  let assWritten=false;
  try{
    await ff.writeFile(input,await ff.__fetchFile(state.sourceFile));
    if(needsOverlay){
      const sizes={"9:16":[720,1280],"1:1":[1080,1080],"4:5":[864,1080],"16:9":[1280,720]};
      const desired=needsAspect?sizes[state.exportAspect]:null;
      const width=Number(desired?.[0]||$("previewVideo").videoWidth||1280);
      const height=Number(desired?.[1]||$("previewVideo").videoHeight||720);
      const relativeCues=state.subtitleCues.filter(q=>q.end>c.start&&q.start<c.end).map(q=>({start:Math.max(0,Number(q.start)-c.start),end:Math.min(c.end,Number(q.end))-c.start,text:q.text})).filter(q=>q.end>q.start&&String(q.text||'').trim());
      const ass=createAssDocument({title:c.title||'',caption:c.caption||'',duration,width,height,cues:relativeCues,titleStyle:c.titleStyle||state.titleStyle,subtitleStyle:state.subtitleSettings,captionStyle:c.captionStyle||state.captionStyle});
      await ff.writeFile(assFile,new TextEncoder().encode(ass));
      assWritten=true;
    }
    const buildArgs=copy=>{
      const args=['-ss',String(c.start),'-i',input,'-t',String(duration),'-map','0:v:0?','-map','0:a:0?'];
      if(copy)args.push('-c','copy','-avoid_negative_ts','make_zero');
      else{
        const vf=[];
        if(fx.brightness||fx.contrast!==1||fx.saturation!==1)vf.push(`eq=brightness=${fx.brightness}:contrast=${fx.contrast}:saturation=${fx.saturation}`);
        if(fx.blur>0)vf.push(`boxblur=${fx.blur}:1`);
        if(fx.speed!==1)vf.push(`setpts=${1/fx.speed}*PTS`);
        if(mode==='mobile')vf.push("scale='min(1280,iw)':-2");
        if(needsAspect){const sizes={"9:16":[720,1280],"1:1":[1080,1080],"4:5":[864,1080],"16:9":[1280,720]};const size=sizes[state.exportAspect];if(!size)throw Error("Unknown export ratio");const [w,h]=size;vf.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease`,`pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`)}
        if(needsOverlay)vf.push(`subtitles=${assFile}`);
        if(vf.length)args.push('-vf',vf.join(','));
        if(fx.mute)args.push('-an');else{const af=[];if(fx.speed!==1)af.push(`atempo=${clamp(fx.speed,.5,2)}`);if(fx.volume!==1)af.push(`volume=${fx.volume}`);if(fx.normalize)af.push('loudnorm=I=-16:TP=-1.5:LRA=11');if(af.length)args.push('-af',af.join(','))}
        args.push('-c:v','libx264','-preset','veryfast','-crf',mode==='mobile'?'29':mode==='high'?'20':'23','-c:a','aac','-b:a',mode==='mobile'?'96k':'128k','-movflags','+faststart')
      }
      args.push(output);return args
    };
    const execute=async(copy)=>{const onProgress=({progress})=>qstatus(c.id,copy?'copying':'rendering',Math.round(progress*100));ff.on('progress',onProgress);try{await ff.exec(buildArgs(copy));const data=await ff.readFile(output);return new Blob([data],{type:'video/mp4'})}finally{if(ff.off)ff.off('progress',onProgress)}};
    return await execute(mode==='copy'||(mode==='smart'&&!needsFilter&&!needsAspect&&!needsOverlay));
  }catch(error){
    if(mode==='smart'&&!needsFilter&&!needsAspect&&!needsOverlay){qstatus(c.id,'Smart retry: re-encoding',0);try{await ff.deleteFile(output)}catch{}return await ff.exec(['-ss',String(c.start),'-i',input,'-t',String(duration),'-map','0:v:0?','-map','0:a:0?','-c:v','libx264','-preset','veryfast','-crf','23','-c:a','aac','-b:a','128k','-movflags','+faststart',output]).then(async()=>new Blob([await ff.readFile(output)],{type:'video/mp4'}))}
    throw error;
  }finally{try{await ff.deleteFile(input)}catch{}try{await ff.deleteFile(output)}catch{}if(assWritten){try{await ff.deleteFile(assFile)}catch{}}}
}
function renderQueue(clips){$("queueList").innerHTML=clips.map((c,i)=>`<div class="queue-item" id="queue-${c.id}"><div><strong>Part ${i+1} · ${esc(c.title)}</strong><small>${fmt(c.start)} → ${fmt(c.end)}</small><div class="queue-progress"><span></span></div></div><small class="queue-status">waiting</small></div>`).join('')}
function qstatus(id,s,p=0){const e=$("queue-"+id);if(!e)return;e.querySelector('.queue-status').textContent=s;e.querySelector('.queue-progress span').style.width=p+'%'}
function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}
function outputName(c,i){const prefix=String($("powerExportPrefix")?.value||"").trim().replace(/[^\w\u00C0-\uFFFF-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48);const title=(c.title||`clip-${i+1}`).replace(/[^\w\u00C0-\uFFFF]+/g,'-').slice(0,70);return `${prefix?prefix+"-":""}${String(i+1).padStart(2,'0')}-${title}.mp4`}
async function getFFmpeg(){if(ffmpegInstance)return ffmpegInstance;if(ffmpegLoading)return ffmpegLoading;ffmpegLoading=(async()=>{const {FFmpeg}=await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js');const {fetchFile,toBlobURL}=await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js');const ff=new FFmpeg();const base='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';await ff.load({classWorkerURL:new URL("./ffmpeg/worker.js?v=20261024-workerfix1",import.meta.url).href,coreURL:await toBlobURL(`${base}/ffmpeg-core.js`,'text/javascript'),wasmURL:await toBlobURL(`${base}/ffmpeg-core.wasm`,'application/wasm'),workerURL:await toBlobURL(`${base}/ffmpeg-core.worker.js`,'text/javascript')});ff.__fetchFile=fetchFile;ffmpegInstance=ff;return ff})();try{return await ffmpegLoading}catch(e){ffmpegLoading=null;throw e}}
async function startExport(){if(exportBusy)return;exportBusy=true;$("startExportBtn").disabled=true;$("exportRecoveryActions").classList.add('hidden');const clips=[...state.clips];try{for(let i=0;i<clips.length;i++){const c=clips[i];qstatus(c.id,'starting',0);try{const blob=await renderClip(c,i,exportMode);downloadBlob(blob,outputName(c,i));qstatus(c.id,'done',100);await new Promise(r=>setTimeout(r,50))}catch(e){qstatus(c.id,'failed',0);$("exportRecoveryActions").classList.remove('hidden');$("recoveryText").textContent=e.message||'The browser could not render this clip.';toast('Export stopped — recovery options are ready','error');break}}}finally{exportBusy=false;$("startExportBtn").disabled=false;if(memorySafeMode)releaseTemporaryMemory({silent:true})}}
$("startExportBtn").onclick=startExport;$("recoveryOriginalBtn").onclick=()=>{exportMode='copy';startExport()};$("recoveryLowBtn").onclick=()=>{exportMode='mobile';startExport()};$("recoverySingleClipBtn").onclick=async()=>{const c=selected();if(!c)return toast('Select one clip first');try{const b=await renderClip(c,0,'mobile');downloadBlob(b,outputName(c,0));toast('Selected clip exported')}catch(e){toast(e.message||'Single-clip export failed','error')}};
$("saveProjectBtn").onclick=()=>{const m=createProjectManifest({projectName:state.projectName,sourceFileName:state.sourceFile?.name||state.sourceMeta?.fileName||'',sourceFileSize:state.sourceFile?.size||state.sourceMeta?.fileSize||0,sourceDuration:state.duration,sourceUrl:state.sourceMeta?.sourceUrl||'',clips:state.clips,controls:{aspectSelect:state.aspect,skipRanges:state.skipRanges,subtitleCues:state.subtitleCues,subtitleSettings:state.subtitleSettings,exportAspect:state.exportAspect,burnOverlays:state.burnOverlays}},new Date().toISOString());downloadBlob(new Blob([JSON.stringify(m,null,2)],{type:'application/json'}),`${state.projectName.replace(/\W+/g,'-')||'clipsmith-project'}.clipsmith.json`);toast('Project saved')};$("loadProjectBtn").onclick=()=>$("projectFileInput").click();$("projectFileInput").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const m=validateProjectManifest(JSON.parse(await f.text()));if(!m)throw Error('Invalid ClipSmith project file');if(pendingRecoverySnapshot){pendingRecoverySnapshot=null;hideDraftRecoveryPrompt()}state.projectName=m.projectName;state.clips=m.clips;state.aspect=m.controls?.aspectSelect||'16:9';state.skipRanges=Array.isArray(m.controls?.skipRanges)?m.controls.skipRanges.filter(r=>Number.isFinite(Number(r?.start))&&Number.isFinite(Number(r?.end))&&Number(r.end)>Number(r.start)).slice(0,500).map(r=>({id:typeof r.id==='string'?r.id:uid(),start:Math.max(0,Number(r.start)),end:Math.max(0,Number(r.end)),label:'Promo / ad break'})):[];state.subtitleCues=Array.isArray(m.controls?.subtitleCues)?m.controls.subtitleCues.filter(q=>Number.isFinite(Number(q.start))&&Number.isFinite(Number(q.end))&&Number(q.end)>Number(q.start)&&String(q.text||'').trim()).slice(0,50000):[];state.subtitleSettings={style:"Classic",highlight:"#9e83ff",positionY:82,...(m.controls?.subtitleSettings||{})};state.exportAspect=m.controls?.exportAspect||"source";state.burnOverlays=m.controls?.burnOverlays!==false;state.duration=m.source.duration||0;state.sourceMeta={fileName:m.source.fileName,fileSize:m.source.fileSize,sourceUrl:m.source.url||'',duration:state.duration};state.sourceFile=null;state.selectedId=state.clips[0]?.id||null;$("projectName").value=state.projectName;$("mediaName").textContent=`Saved project · ${state.sourceMeta.fileName||'video'}`;$("previewEmptyTitle").textContent='Project opened';$("previewEmptyHint").textContent='Re-import the source video to preview and export.';$("previewEmpty").classList.remove('hidden');commit();renderAll();toast('Project opened')}catch(err){toast(err.message||'Could not open project','error')}finally{e.target.value=''}};
$("projectName").oninput=e=>{state.projectName=e.target.value;persist()};
$("generateIdeasBtn").onclick=()=>{const ideas=generateCreatorIdeas({title:selected()?.title||state.seriesTitle,fileName:state.sourceFile?.name||'',transcript:$("ideasTranscript").value.trim()||state.subtitleCues.map(cue=>cue.text).join(" "),visualTags:state.visualTags,platform:$("creatorPlatform").value,tone:$("creatorTone").value,language:$("creatorLanguage").value});lastCreatorIdeas=ideas;$("creatorResults").innerHTML=`<div class="result-card"><span>Caption ideas</span>${ideas.captions.map(x=>`<div class="copy-line"><p>${esc(x)}</p><button data-copy="${esc(x)}">Copy</button></div>`).join('')}</div><div class="result-card"><span>Hashtags</span><div class="copy-line"><p>${esc(ideas.hashtags.join(' '))}</p><button data-copy="${esc(ideas.hashtags.join(' '))}">Copy</button></div></div><div class="result-card"><span>Hooks</span>${(ideas.hooks||ideas.captions||[]).slice(0,5).map(x=>`<div class="copy-line"><p>${esc(x)}</p><button data-copy="${esc(x)}">Copy</button></div>`).join("")}</div><div class="result-card"><span>Short titles</span>${(ideas.titles||[]).map(x=>`<div class="copy-line"><p>${esc(x)}</p><button data-copy="${esc(x)}">Copy</button></div>`).join("")}</div>`};$("creatorResults").onclick=e=>{const b=e.target.closest('[data-copy]');if(b)navigator.clipboard?.writeText(b.dataset.copy).then(()=>toast('Copied'))};
async function analyzeCurrentFrame(){const v=$("previewVideo"),status=$("visualAnalysisStatus"),btn=$("analyzeFrameBtn");if(!state.sourceFile||v.readyState<2)return toast('Load a video first');btn.disabled=true;status.textContent='Loading local object detection…';try{if(!visionModelPromise){visionModelPromise=(async()=>{await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';document.head.appendChild(s);await new Promise((res,rej)=>{s.onload=res;s.onerror=rej});return window.cocoSsd.load({base:'lite_mobilenet_v2'})})()}const model=await visionModelPromise;const p=await model.detect(v,10,.35);state.visualTags=[...new Set(p.map(x=>x.class))].slice(0,8);status.textContent=state.visualTags.length?`Detected: ${state.visualTags.join(', ')}`:'No clear objects detected';commit();toast('Frame analyzed')}catch(e){visionModelPromise=null;status.textContent='Local analysis unavailable; add a transcript or description instead.';toast('Frame analysis unavailable','error')}finally{btn.disabled=false;if(memorySafeMode)releaseTemporaryMemory({silent:true})}}
$("analyzeFrameBtn")?.addEventListener('click',analyzeCurrentFrame);
$("normalizeAudioBtn")?.addEventListener('click',()=>{const c=selected();if(!c)return toast('Select a clip first');c.fx={...DEFAULT_FX,...c.fx,normalize:true};commit();syncInspector();toast('Audio normalization enabled')});$("normalizeAudioFxBtn")?.addEventListener('click',()=>$("normalizeAudioBtn").click());
$("titleOverlay").addEventListener("pointerdown",dragOverlay);$("captionOverlay").addEventListener("pointerdown",dragOverlay);function dragOverlay(e){const el=e.currentTarget;if(el.id==="titleOverlay"&&!e.target.closest("[data-overlay-drag-handle]"))return;e.preventDefault();const stage=$("preview-canvas")||$("preview-stage"),r=stage.getBoundingClientRect(),start=e.clientY,elRect=el.getBoundingClientRect(),top0=elRect.top-r.top;el.setPointerCapture(e.pointerId);const move=ev=>{const nextY=clamp((top0+ev.clientY-start)/r.height*100,4,90);el.style.top=`${nextY}%`;el.style.bottom="auto";if(el.id==="titleOverlay"){state.titleStyle={...state.titleStyle,positionY:Number(nextY.toFixed(1))};const clip=selected();if(clip)clip.titleStyle={...state.titleStyle};if($("titlePositionY"))$("titlePositionY").value=nextY}};const up=()=>{el.removeEventListener("pointermove",move);el.removeEventListener("pointerup",up);commit()};el.addEventListener("pointermove",move);el.addEventListener("pointerup",up)}
window.addEventListener("keydown",e=>{const active=document.activeElement,typing=!!active?.isContentEditable||/input|textarea|select/i.test(active?.tagName||"");if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo();return}if(typing)return;if(e.code==="Space"){e.preventDefault();$("playBtn").click();return}if(e.key.toLowerCase()==="s"){e.preventDefault();splitSelected();return}if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();deleteSelected();return}if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();$("previewVideo").currentTime=clamp($("previewVideo").currentTime+(e.key==="ArrowLeft"?-1:1),0,state.duration);return}if(e.key==="?")$("keyboardHelpModal").classList.remove("hidden");if(e.key==="Escape"){$("export-queue")?.classList.add("hidden");$("keyboardHelpModal")?.classList.add("hidden");$("inspector")?.classList.remove("open")}});
function aiTranscriptRequired(){if(!state.subtitleCues.length){toast('Generate auto subtitles first in the Captions tab, then try Copilot.','error');return false}return true}
function renderAIList(html){const root=$('aiRecommendationList');if(root)root.innerHTML=html}
function showAIHighlights(){if(!aiTranscriptRequired())return;const target=Number($('aiHighlightDuration').value)||30,count=Number($('aiHighlightCount').value)||5;aiHighlights=findHighlightMoments(state.subtitleCues,{duration:state.duration,targetDuration:target,maxResults:count});$('buildHighlightReelBtn').disabled=!aiHighlights.length;if(!aiHighlights.length){renderAIList('<p class="hint">No strong timed moments were found. Try generating subtitles with clearer audio.</p>');return}renderAIList('<div class="ai-results-head"><strong>Suggested highlight moments</strong><span>Explainable transcript signals · review before use</span></div>'+aiHighlights.map((item,i)=>`<article class="ai-highlight-row"><div class="ai-highlight-top"><span class="ai-rank">${String(i+1).padStart(2,'0')}</span><div><strong>${esc(item.hookText)}</strong><small>${fmt(item.start)} → ${fmt(item.end)} · ${Math.round(item.score*100)} score</small></div></div><p>${esc(item.signals.join(' · ')||'Clear transcript moment')}</p><button type="button" class="soft-btn" data-ai-jump="${item.start}">Preview moment</button></article>`).join(''))}
function showAITranscriptAudit(){if(!aiTranscriptRequired())return;aiAudit=auditTranscript(state.subtitleCues);const groups=[];if(aiAudit.fillers.length)groups.push(`<div class="ai-report-block"><strong>Filler-word lines · ${aiAudit.fillers.length}</strong>${aiAudit.fillers.map(item=>`<div class="ai-audit-row"><div><b>${esc(item.words.join(', '))}</b><small>${fmt(item.start)} · ${esc(item.text)}</small></div><button type="button" class="soft-btn" data-ai-jump="${item.start}">Review</button></div>`).join('')}</div>`);if(aiAudit.repetitions.length)groups.push(`<div class="ai-report-block"><strong>Repeated subtitle lines · ${aiAudit.repetitions.length}</strong>${aiAudit.repetitions.map(item=>`<div class="ai-audit-row"><div><b>Possible repeat</b><small>${fmt(item.start)} · ${esc(item.text)}</small></div><button type="button" class="soft-btn" data-ai-jump="${item.start}">Review</button></div>`).join('')}</div>`);if(aiAudit.pauses.length)groups.push(`<div class="ai-report-block"><strong>Long pauses · ${aiAudit.pauses.length}</strong>${aiAudit.pauses.map((item,i)=>`<div class="ai-audit-row"><div><b>${fmt(item.duration)} pause</b><small>${fmt(item.start)} → ${fmt(item.end)}</small></div><button type="button" class="soft-btn" data-ai-add-pause="${i}">Mark to skip</button></div>`).join('')}</div>`);if(!groups.length)groups.push('<p class="hint">No obvious filler words, duplicate subtitle lines or long pauses were detected. Review the transcript manually too.</p>');renderAIList(`<div class="ai-results-head"><strong>Transcript audit</strong><span>${aiAudit.summary.cueCount} cues checked</span></div><div class="ai-audit-summary"><span>${aiAudit.summary.fillerCues} filler lines</span><span>${aiAudit.summary.repeatedLines} repeats</span><span>${aiAudit.summary.longPauses} pauses</span></div>${groups.join('')}`)}
function showAISubtitleCleanup(){if(!aiTranscriptRequired())return;aiCleanup=suggestSubtitleCleanup(state.subtitleCues);$('applySubtitleCleanupBtn').classList.toggle('hidden',!aiCleanup.changes.length);if(!aiCleanup.changes.length){renderAIList('<p class="hint">Your subtitle text already looks tidy. No punctuation or duplicate-line suggestions were found.</p>');return}renderAIList(`<div class="ai-results-head"><strong>Subtitle cleanup preview</strong><span>${aiCleanup.changes.length} suggestions · nothing changed yet</span></div>${aiCleanup.changes.slice(0,60).map(item=>`<div class="ai-clean-row"><small>${fmt(state.subtitleCues[item.cueIndex]?.start||0)} · ${esc(item.actions.join(', '))}</small><div><span>${esc(item.before)}</span><b>${esc(item.after)}</b></div>${item.duplicateOf!==null?'<em>Possible duplicate — kept for your review</em>':''}</div>`).join('')}${aiCleanup.changes.length>60?`<p class="hint">Showing 60 of ${aiCleanup.changes.length} changes.</p>`:''}`)}
function applyAISubtitleCleanup(){if(!aiCleanup?.changes.length)return toast('No cleanup suggestions to apply');if(!confirm(`Apply ${aiCleanup.changes.length} subtitle text suggestions? Possible duplicates will be kept, not deleted.`))return;const proposed=new Map(aiCleanup.cleaned.map(cue=>[cue.index,cue]));state.subtitleCues=state.subtitleCues.map((cue,index)=>{const item=proposed.get(index);return item?{...cue,text:item.text}:cue});commit();renderSubtitleCueList();updateActiveSubtitle();$('applySubtitleCleanupBtn').classList.add('hidden');toast('Reviewed subtitle cleanup applied')}
function showAIChapters(){if(!aiTranscriptRequired())return;aiChapters=makeChapterLabels(state.subtitleCues);if(!aiChapters.length){renderAIList('<p class="hint">No chapters could be suggested from these captions.</p>');return}renderAIList(`<div class="ai-results-head"><strong>Suggested chapters</strong><span>${aiChapters.length} sections</span></div>${aiChapters.map((chapter,i)=>`<div class="ai-chapter-row"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(chapter.title)}</b><small>${fmt(chapter.timestamp)}</small></div><button type="button" class="soft-btn" data-ai-jump="${chapter.timestamp}">Preview</button></div>`).join('')}<button id="downloadChaptersBtn" type="button" class="soft-btn full">Download chapter list</button>`)}
function showAIReadingLoad(){if(!aiTranscriptRequired())return;aiReadability=calculateReadingLoad(state.subtitleCues);const items=[...aiReadability.lengthy.map(x=>({...x,kind:'Long subtitle'})),...aiReadability.fast.map(x=>({...x,kind:'Fast reading'}))].sort((a,b)=>a.start-b.start);renderAIList(`<div class="ai-results-head"><strong>Subtitle readability</strong><span>${aiReadability.summary.readabilityScore}/100 checklist score</span></div><div class="ai-audit-summary"><span>${aiReadability.lengthy.length} lengthy lines</span><span>${aiReadability.fast.length} fast lines</span></div>${items.length?items.slice(0,80).map(item=>`<div class="ai-audit-row"><div><b>${esc(item.kind)}</b><small>${fmt(item.start)} · ${esc(item.text)}</small></div><button class="soft-btn" data-ai-jump="${item.start}">Review</button></div>`).join(''):'<p class="hint">No obviously dense or fast subtitle lines flagged with the current reading thresholds.</p>'}`)}
function getAIReadinessInput(){const clip=selected(),start=clip?.start||0,end=clip?.end||state.duration;const cues=clip?state.subtitleCues.filter(item=>item.start<end&&item.end>start).map(item=>({start:Math.max(0,item.start-start),end:Math.min(end,item.end)-start,text:item.text})):state.subtitleCues;return {cues,duration:clip?Math.max(.5,end-start):state.duration,platform:$('creatorPlatform').value,title:clip?.title||state.seriesTitle,hashtags:lastCreatorIdeas?.hashtags||[]}}
function showAIReadiness(){aiReadiness=scorePlatformReadiness(getAIReadinessInput());$('aiReadinessScore').textContent=`${aiReadiness.score}/100`;$('aiReadinessSummary').textContent=aiReadiness.disclaimer;const checks=Object.entries(aiReadiness.checks).map(([key,passed])=>`<span class="ai-check ${passed?'is-good':'is-missing'}">${passed?'✓':'○'} ${esc(key.replace(/([A-Z])/g,' $1').toLowerCase())}</span>`).join('');renderAIList(`<div class="ai-results-head"><strong>${esc(aiReadiness.scorePlatform)} checklist</strong><span>${aiReadiness.score}/100</span></div><div class="ai-checks">${checks}</div>${aiReadiness.actions.length?`<div class="ai-report-block"><strong>Recommended next steps</strong>${aiReadiness.actions.map(x=>`<p class="ai-action">→ ${esc(x)}</p>`).join('')}</div>`:'<p class="hint">The main readiness checks look good. Final quality still depends on content and viewer context.</p>'}`)}
function buildAIHighlightReel(){if(!aiHighlights.length)return toast('Find highlights first');if(state.clips.length&&!confirm('Replace the current clip sequence with the suggested highlight reel? You can undo this afterwards.'))return;state.clips=aiHighlights.map((item,index)=>({...makeClip(item.start,item.end,index),aiScore:item.score,aiHook:item.hookText}));state.clips=renumberAutoTitles(state.clips,i=>`${state.seriesTitle} · Part ${i+1}`);state.selectedId=state.clips[0]?.id||null;commit();renderAll();setTool('cut');toast(`Highlight reel created · ${state.clips.length} suggested clips`)}
function downloadAIChapters(){if(!aiChapters.length)return;const text=aiChapters.map(chapter=>`${fmt(chapter.timestamp)}  ${chapter.title}`).join('\n');downloadBlob(new Blob([text+'\n'],{type:'text/plain;charset=utf-8'}),`${(state.projectName||'clipsmith').replace(/[^\w-]+/g,'-')}-chapters.txt`)}
function downloadAIBrief(){const context=$('ideasTranscript').value.trim()||state.subtitleCues.map(cue=>cue.text).join(' ');const ideas=lastCreatorIdeas||generateCreatorIdeas({title:selected()?.title||state.seriesTitle,fileName:state.sourceMeta?.fileName||'',transcript:context,visualTags:state.visualTags,platform:$('creatorPlatform').value,tone:$('creatorTone').value,language:$('creatorLanguage').value});const highlights=aiHighlights.length?aiHighlights:findHighlightMoments(state.subtitleCues,{duration:state.duration,targetDuration:Number($('aiHighlightDuration').value)||30,maxResults:Number($('aiHighlightCount').value)||5});const chapters=aiChapters.length?aiChapters:makeChapterLabels(state.subtitleCues);const audit=aiAudit||auditTranscript(state.subtitleCues);const ready=aiReadiness||scorePlatformReadiness({...getAIReadinessInput(),hashtags:ideas.hashtags});const parts=[`CLIPSMITH CREATOR BRIEF`,`Project: ${state.projectName}`,`Platform: ${$('creatorPlatform').value}`,`Tone: ${$('creatorTone').value}`,`Duration: ${fmt(state.duration)}`,`Readiness checklist: ${ready.score}/100`,ready.disclaimer,'',`HOOK IDEAS`,...ideas.hooks.map((x,i)=>`${i+1}. ${x}`),'',`CAPTION IDEAS`,...ideas.captions.map((x,i)=>`${i+1}. ${x}`),'',`HASHTAGS`,ideas.hashtags.join(' '),'',`HIGHLIGHT WINDOWS`,...highlights.map((x,i)=>`${i+1}. ${fmt(x.start)}–${fmt(x.end)} | score ${Math.round(x.score*100)} | ${x.hookText}`),'',`CHAPTERS`,...chapters.map(x=>`${fmt(x.timestamp)} ${x.title}`),'',`TRANSCRIPT AUDIT`,`Filler lines: ${audit.summary.fillerCues}`,`Repeated lines: ${audit.summary.repeatedLines}`,`Long pauses: ${audit.summary.longPauses}`,'',`READABILITY`,...(aiReadability?.warnings||[]).map(x=>`${fmt(x.start)} ${x.kind||'warning'}: ${x.text}`),'',`NOTES`,'Suggestions are based on transcript signals and editing heuristics; they do not predict views or virality.'].flat();downloadBlob(new Blob([parts.join('\n')+'\n'],{type:'text/plain;charset=utf-8'}),`${(state.projectName||'clipsmith').replace(/[^\w-]+/g,'-')}-creator-brief.txt`);toast('Creator brief exported')}
$('aiHighlightBtn').onclick=showAIHighlights;$('aiAuditBtn').onclick=showAITranscriptAudit;$('aiCleanSubtitlesBtn').onclick=showAISubtitleCleanup;$('aiChapterBtn').onclick=showAIChapters;$('aiReadingLoadBtn').onclick=showAIReadingLoad;$('aiReadinessBtn').onclick=showAIReadiness;$('buildHighlightReelBtn').onclick=buildAIHighlightReel;$('applySubtitleCleanupBtn').onclick=applyAISubtitleCleanup;$('aiBriefBtn').onclick=downloadAIBrief;
$("memorySafeModeToggle")?.addEventListener("change",event=>{memorySafeMode=event.target.checked;try{localStorage.setItem(MEMORY_SAFE_MODE_KEY,String(memorySafeMode))}catch{}refreshMemoryPanel();setMemoryStatus(memorySafeMode?"Memory-safe mode is on: ClipSmith warns before large-source operations and releases temporary runtimes after heavy tasks.":"Memory-safe warnings and automatic cleanup are off. Large video exports may use substantial RAM.");toast(memorySafeMode?"Memory-safe mode enabled":"Memory-safe mode disabled")});
$("releaseTemporaryMemoryBtn")?.addEventListener("click",()=>releaseTemporaryMemory());
window.addEventListener("clipsmith-native-memory-warning",()=>{if(memorySafeMode)releaseTemporaryMemory({silent:true})});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")persist()});
$('aiRecommendationList').addEventListener('click',event=>{const jump=event.target.closest('[data-ai-jump]');if(jump){const time=Number(jump.dataset.aiJump);if(!Number.isFinite(time))return;const clip=state.clips.find(item=>time>=item.start&&time<=item.end);if(clip)state.selectedId=clip.id;renderAll();$('previewVideo').currentTime=clamp(time,0,state.duration);setTool('preview');return}const pause=event.target.closest('[data-ai-add-pause]');if(pause){const item=aiAudit?.pauses?.[Number(pause.dataset.aiAddPause)];if(!item)return;const exists=state.skipRanges.some(r=>Math.abs(r.start-item.start)<.25&&Math.abs(r.end-item.end)<.25);if(!exists)state.skipRanges.push({id:uid(),start:item.start,end:item.end,label:'AI-suggested pause'});state.skipRanges.sort((a,b)=>a.start-b.start);commit();renderSkipRanges();toast('Pause marked as a skip range. Review it in Clips before rebuilding.');return}if(event.target.closest('#downloadChaptersBtn'))downloadAIChapters()});
$("memorySaveNowBtn")?.addEventListener("click",saveMemoryNow);$("memoryClearBtn")?.addEventListener("click",clearDeviceMemory);window.addEventListener("pagehide",()=>{if(memoryClearInProgress)return;try{flushCurrentSession(snap()).catch(()=>{})}catch{}});window.ClipSmithStudio = Object.freeze({
  build: "20261024-power3",
  getProjectName: () => state.projectName,
  getDuration: () => Number(state.duration) || 0,
  getCurrentTime: () => Number($("previewVideo")?.currentTime) || 0,
  getSelectedClip: () => {
    const clip = selected();
    if (!clip) return null;
    const index = state.clips.findIndex((item) => item.id === clip.id);
    const fx = { ...DEFAULT_FX, ...(clip.fx || state.fx) };
    return { id: clip.id, index: index + 1, start: Number(clip.start) || 0, end: Number(clip.end) || 0,
      title: clip.title || "", caption: clip.caption || "", speed: Number(fx.speed) || 1, muted: Boolean(fx.mute) };
  },
  setTool,
  toast,
  seekTo: (time) => {
    const video = $("previewVideo");
    if (!video || video.readyState < 1 || !Number.isFinite(Number(time))) return false;
    video.currentTime = clamp(Number(time), 0, state.duration || Number(time));
    if ($("seekBar") && state.duration > 0) $("seekBar").value = String(video.currentTime / state.duration * 100);
    return true;
  },
  setSelectedTitle: (value, style = null) => {
    const clip = selected();
    if (!clip) return false;
    clip.title = String(value || "").trim().slice(0, 240);
    clip.autoTitle = false;
    if (style && typeof style === "object") {
      clip.titleStyle = { ...state.titleStyle, ...style };
      state.titleStyle = { ...state.titleStyle, ...style };
    }
    commit(); renderAll(); return true;
  },
  setSelectedCaption: (value, style = null) => {
    const clip = selected();
    if (!clip) return false;
    clip.caption = String(value || "").trim().slice(0, 500);
    if (style && typeof style === "object") clip.captionStyle = { ...state.captionStyle, ...style };
    commit(); renderAll(); return true;
  },
  setPlaybackSpeed: (value) => {
    const speed = clamp(Number(value) || 1, 0.5, 2);
    const clip = selected();
    if (clip) clip.fx = { ...DEFAULT_FX, ...(clip.fx || state.fx), speed };
    else state.fx = { ...DEFAULT_FX, ...state.fx, speed };
    commit(); syncInspector(); updatePreview(); return speed;
  },
  setPreviewMuted: (value) => {
    const muted = Boolean(value);
    const clip = selected();
    if (clip) clip.fx = { ...DEFAULT_FX, ...(clip.fx || state.fx), mute: muted };
    else state.fx = { ...DEFAULT_FX, ...state.fx, mute: muted };
    commit(); syncInspector(); updatePreview(); return muted;
  },
  resetSelectedEffects: () => {
    const clip = selected();
    if (clip) clip.fx = { ...DEFAULT_FX };
    else state.fx = { ...DEFAULT_FX };
    commit(); syncInspector(); updatePreview(); return true;
  },
  exportSelectedClip: async () => {
    const clip = selected();
    if (!clip) throw new Error("Select a clip before exporting it.");
    if (!state.sourceFile) throw new Error("Re-import the source video before exporting this project.");
    if (exportBusy) throw new Error("Another export is already running.");
    exportBusy = true;
    try {
      const index = state.clips.findIndex((item) => item.id === clip.id);
      const blob = await renderClip(clip, index, exportMode);
      downloadBlob(blob, outputName(clip, index));
      toast("Selected clip exported");
      return true;
    } finally {
      exportBusy = false;
      if (memorySafeMode) releaseTemporaryMemory({ silent: true });
    }
  }
});

$("restoreDraftBtn").onclick=()=>{const snapshot=pendingRecoverySnapshot;if(!snapshot)return;if(applyRecoveredDraft(snapshot)){setMemoryVaultStatus("Project memory restored",state.sourceMeta?.fileName?`Your saved edits are restored. Re-import ${state.sourceMeta.fileName} to reconnect preview and export.`:"Your saved edits are restored. Add a video to preview and export.");toast("Saved draft restored")}};$("startFreshBtn").onclick=()=>{void startFreshProject()};recover();lastCommitted=snap();if($("projectName"))$("projectName").value=state.projectName;renderAll();refreshMemoryPanel();void restoreRememberedMemory();
window.dispatchEvent(new CustomEvent("clipsmith:app-ready", { detail: { build: "20261025-stylefinder2" } }));