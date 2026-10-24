import { generateCreatorIdeas } from "./creator-assistant.js?v=20261024-ux2";
import { splitClipAt, duplicateClip, moveClip, createProjectManifest, validateProjectManifest, buildClipSegments } from "./editor-tools.js?v=20261024-ux2";

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fmt = (seconds = 0) => { const s=Math.max(0,Math.round(seconds)); const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),x=s%60; return h ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}`; };
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const DEFAULT_FX = { preset:"Original", brightness:0, contrast:1, saturation:1, blur:0, speed:1, volume:1, mute:false, normalize:false };
const state = {projectName:"Untitled Project",sourceFile:null,sourceUrl:"",sourceMeta:null,visualTags:[],duration:0,selectedId:null,durationPreset:30,aspect:"16:9",showSafe:false,seriesTitle:"Your series title",autoParts:true,titleStyle:{font:"Inter",size:30,color:"#ffffff",outline:"#000000",opacity:1},captionStyle:{style:"Classic",text:"Your caption appears here",highlight:"#9e83ff",positionY:78},clips:[],fx:{...DEFAULT_FX},history:[],future:[],activeTool:"media",objectUrl:null};
const snapshot = () => JSON.parse(JSON.stringify({projectName:state.projectName,durationPreset:state.durationPreset,aspect:state.aspect,showSafe:state.showSafe,seriesTitle:state.seriesTitle,autoParts:state.autoParts,titleStyle:state.titleStyle,captionStyle:state.captionStyle,clips:state.clips,fx:state.fx,selectedId:state.selectedId,sourceMeta:state.sourceMeta,visualTags:state.visualTags}));
let lastCommittedSnapshot=null;
let preserveExistingClipsOnNextMetadata=false;
let visionModelPromise=null;
function persist(){try{localStorage.setItem("clipsmith.project.v1",JSON.stringify(snapshot()))}catch{updateSaveState("● Local save unavailable")}}
function commitHistory(){const current=snapshot();if(lastCommittedSnapshot&&JSON.stringify(current)!==JSON.stringify(lastCommittedSnapshot)){state.history.push(lastCommittedSnapshot);if(state.history.length>40)state.history.shift()}state.future=[];lastCommittedSnapshot=current;persist();updateSaveState("● Saved locally")}
function restore(s){Object.assign(state,JSON.parse(JSON.stringify(s)));if(!state.sourceFile&&state.sourceMeta?.duration)state.duration=Number(state.sourceMeta.duration)||state.duration||0;if(!state.clips.some(c=>c.id===state.selectedId))state.selectedId=state.clips[0]?.id||null;lastCommittedSnapshot=snapshot();renderAll();persist()}
function undo(){const prev=state.history.pop();if(!prev)return toast("Nothing to undo yet.");state.future.push(snapshot());restore(prev);updateSaveState("● Undo")}
function redo(){const next=state.future.pop();if(!next)return toast("Nothing to redo yet.");state.history.push(snapshot());restore(next);updateSaveState("● Redo")}
function recoverDraft(){try{const raw=localStorage.getItem("clipsmith.project.v1");if(!raw)return;Object.assign(state,JSON.parse(raw));state.sourceMeta||=null;state.visualTags||=[];state.duration=Number(state.sourceMeta?.duration)||state.duration||0;if(state.sourceMeta){$("mediaName").textContent="Offline source · "+(state.sourceMeta.fileName||"video")+" · re-import to preview/export";if(state.sourceMeta.sourceUrl&&$("videoUrl"))$("videoUrl").value=state.sourceMeta.sourceUrl}if(state.clips.length){if($("previewEmptyTitle"))$("previewEmptyTitle").textContent="Project recovered";if($("previewEmptyHint"))$("previewEmptyHint").textContent="Choose the original video to restore the preview and export your saved edits.";$("previewEmpty").classList.remove("hidden")}updateSaveState("● Recovered")}catch{updateSaveState("● Recovery skipped")}}
function updateSaveState(text){$("saveState").textContent=text;setTimeout(()=>$("saveState").textContent="● Ready",1600)}
function toast(msg){let t=document.querySelector(".toast");if(!t){t=document.createElement("div");t.className="toast";document.body.appendChild(t)}t.textContent=msg;t.classList.add("show");clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove("show"),2400)}
function selectedClip(){return state.clips.find(c=>c.id===state.selectedId)||null}
function createClip(start,end,index){return{id:uid(),start,end,title:state.autoParts?`${state.seriesTitle} · Part ${index+1}`:state.seriesTitle,autoTitle:state.autoParts,caption:state.captionStyle.text,titleStyle:{...state.titleStyle},captionStyle:{...state.captionStyle},fx:{...DEFAULT_FX}}}
function generateClips({notify=true}={}){
 if(!state.duration)return toast("Load a video first.");
 const segments=buildClipSegments(state.duration,state.durationPreset);
 if(segments===null)return toast("That would create too many clips. Choose a longer clip length.");
 if(!segments.length)return toast("This video is too short to split into clips.");
 state.clips=segments.map(segment=>createClip(segment.start,segment.end,segment.index));
 state.selectedId=state.clips[0]?.id||null;commitHistory();renderAll();
 if(notify)toast(`${state.clips.length} clips ready · change the length in Media`);
}
function selectClip(id){state.selectedId=id;const c=selectedClip();if(c&&$("previewVideo").src){try{$("previewVideo").currentTime=c.start}catch{}}syncInspectorFromClip();renderClips();renderTimeline();updateTitlePreview();updatePreviewEffects();lastCommittedSnapshot=snapshot();persist()}
function applySeriesTitle(){state.seriesTitle=$("seriesTitle").value.trim()||"Untitled";state.autoParts=$("autoParts").checked;state.clips=state.clips.map((c,i)=>({...c,title:state.autoParts?`${state.seriesTitle} · Part ${i+1}`:state.seriesTitle,autoTitle:state.autoParts}));commitHistory();renderClips();renderTimeline();updateTitlePreview();toast("Title applied to all clips")}
function splitSelected(){const c=selectedClip();if(!c)return toast("Select a clip first.");const t=$("previewVideo").currentTime,result=splitClipAt(state.clips,c.id,t,{makeId:uid,titleFor:i=>`${state.seriesTitle} · Part ${i+1}`});if(!result)return toast("Move the playhead inside the selected clip.");state.clips=result.clips;state.selectedId=result.selectedId;commitHistory();renderAll();toast("Split at playhead")}
function duplicateSelected(){const c=selectedClip();if(!c)return toast("Select a clip first.");const result=duplicateClip(state.clips,c.id,{makeId:uid,titleFor:i=>`${state.seriesTitle} · Part ${i+1}`});state.clips=result.clips;state.selectedId=result.selectedId;commitHistory();renderAll();toast("Clip duplicated")}
function moveSelected(delta){const c=selectedClip();if(!c)return toast("Select a clip first.");const result=moveClip(state.clips,c.id,delta);if(!result)return;state.clips=result.clips;commitHistory();renderAll()}
function deleteSelected(){const c=selectedClip();if(!c)return;const idx=state.clips.indexOf(c);state.clips.splice(idx,1);state.selectedId=state.clips[Math.min(idx,state.clips.length-1)]?.id||null;commitHistory();renderAll()}
function renderTimeline(){const root=$("timeline");root.innerHTML="";if(!state.clips.length){root.innerHTML='<div class="timeline-empty">Your clip sequence will appear here.</div>';return}const total=state.duration||Math.max(1,state.clips.at(-1)?.end||1);for(const c of state.clips){const el=document.createElement("div");el.className=`timeline-block ${c.id===state.selectedId?"selected":""}`;el.style.width=`${Math.max(3,(c.end-c.start)/total*100)}%`;el.textContent=c.title;el.title=`${fmt(c.start)} – ${fmt(c.end)}`;el.onclick=()=>selectClip(c.id);root.appendChild(el)}}
function renderClips(){const root=$("clip-strip");root.innerHTML="";if(!state.clips.length){root.innerHTML='<div class="queue-empty">Add a video to create your first clips.</div>';return}for(const c of state.clips){const i=state.clips.indexOf(c),el=document.createElement("div");el.className=`clip-card ${c.id===state.selectedId?"selected":""}`;el.innerHTML=`<div class="clip-thumb"><span>${i+1}</span></div><div><div class="clip-meta">PART ${i+1}</div><div class="clip-title">${esc(c.title)}</div><div class="clip-time">${fmt(c.start)} → ${fmt(c.end)}</div></div>`;el.onclick=()=>selectClip(c.id);root.appendChild(el)}}
function updateTitlePreview(){const c=selectedClip(),title=c?.title||`${state.seriesTitle} · Part 1`,style=c?.titleStyle||state.titleStyle,cap=c?.captionStyle||state.captionStyle;$("titleOverlay").textContent=title;Object.assign($("titleOverlay").style,{fontFamily:style.font,fontSize:`${style.size}px`,color:style.color,opacity:style.opacity,textShadow:`0 2px 3px ${style.outline},0 5px 18px #000`});$("captionOverlay").textContent=c?.caption||cap.text||"";$("captionOverlay").style.bottom=`${100-cap.positionY}%`;$("captionOverlay").style.color=cap.highlight}
function updatePreviewEffects(){const video=$("previewVideo");if(!video)return;const fx={...DEFAULT_FX,...(selectedClip()?.fx||state.fx||{})};video.style.filter=`brightness(${clamp(100*(1+Number(fx.brightness||0)),0,200)}%) contrast(${Number(fx.contrast??1)*100}%) saturate(${Number(fx.saturation??1)*100}%) blur(${Math.max(0,Number(fx.blur)||0)}px)`;video.playbackRate=clamp(Number(fx.speed)||1,.25,4);video.volume=clamp(Number(fx.volume)||0,0,1);video.muted=Boolean(fx.mute)}
function syncInspectorFromClip(){const c=selectedClip();$("selectedClipLabel").textContent=c?c.title:"None";$("clipStart").value=c?.start??"";$("clipEnd").value=c?.end??"";$("captionText").value=c?.caption??state.captionStyle.text;const fx=c?.fx||state.fx;$("fxPreset").value=fx.preset;$("fxBrightness").value=fx.brightness;$("fxContrast").value=fx.contrast;$("fxSaturation").value=fx.saturation;$("fxBlur").value=fx.blur;$("fxSpeed").value=fx.speed;$("fxVolume").value=fx.volume;$("fxMute").checked=fx.mute;$("seriesTitle").value=state.seriesTitle;$("autoParts").checked=state.autoParts;$("titleFont").value=state.titleStyle.font;$("titleSize").value=state.titleStyle.size;$("titleColor").value=state.titleStyle.color;$("titleOutline").value=state.titleStyle.outline;$("titleOpacity").value=state.titleStyle.opacity}
function renderAll(){renderTimeline();renderClips();syncInspectorFromClip();updateTitlePreview();$("aspectSelect").value=state.aspect;$("ratioBadge").textContent=state.aspect;$("safeZones").classList.toggle("hidden",!state.showSafe);updatePreviewEffects();$("button",$("durationChips")).forEach(b=>b.classList.toggle("active",b.dataset.duration===String(state.durationPreset)))}
function setTool(tool){state.activeTool=tool;$$(`.tool,.mobile-tab`).forEach(x=>x.classList.toggle("active",x.dataset.tool===tool));$$(`.inspector-pane`).forEach(x=>x.classList.add("hidden"));$(`pane-${tool}`).classList.remove("hidden");$("inspectorTitle").textContent=tool[0].toUpperCase()+tool.slice(1);if(innerWidth<=820)$("inspector").classList.add("open")}
function setImportStatus(message,status="info"){const node=$("importStatus");if(!node)return;node.textContent=message;node.dataset.state=status}
function updateSource(file,{sourceUrl=""}={}){
 if(!file)return;
 const previousMeta=state.sourceMeta||(state.sourceFile?{fileName:state.sourceFile.name,fileSize:state.sourceFile.size}:null);
 preserveExistingClipsOnNextMetadata=Boolean(state.clips.length&&previousMeta&&previousMeta.fileName===file.name&&Number(previousMeta.fileSize)===Number(file.size));
 if(!preserveExistingClipsOnNextMetadata){state.clips=[];state.selectedId=null;state.visualTags=[];state.duration=0}
 if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
 state.sourceFile=file;state.sourceUrl=sourceUrl||"";
 state.sourceMeta={fileName:file.name,fileSize:file.size,sourceUrl:sourceUrl||previousMeta?.sourceUrl||"",duration:preserveExistingClipsOnNextMetadata?(Number(previousMeta.duration)||state.duration||0):0};
 state.objectUrl=URL.createObjectURL(file);$("previewVideo").src=state.objectUrl;$("previewVideo").load();$("mediaName").textContent=file.name;
 $("previewEmptyTitle").textContent="Loading your video…";$("previewEmptyHint").textContent="Reading duration and preparing your clip plan.";$("previewEmpty").classList.remove("hidden");
 setImportStatus("Loading video metadata…","loading");lastCommittedSnapshot=snapshot();persist();updateSaveState("● Media loaded");
}
function autoGenerateAfterMetadata(){
 const video=$("previewVideo"),nextDuration=Number(video.duration);
 if(!Number.isFinite(nextDuration)||nextDuration<=0){preserveExistingClipsOnNextMetadata=false;setImportStatus("This file does not expose a usable duration in this browser. Try an MP4/H.264 or WebM file.","error");$("previewEmptyTitle").textContent="This video could not be read";$("previewEmptyHint").textContent="Try a browser-compatible MP4/WebM file or a direct link that allows browser access.";$("previewEmpty").classList.remove("hidden");toast("Video metadata unavailable");return}
 const previousDuration=state.duration;
 const keepEdits=preserveExistingClipsOnNextMetadata&&state.clips.length>0&&Math.abs(previousDuration-nextDuration)<Math.max(.5,nextDuration*.005)&&state.clips.every(c=>c.start>=0&&c.end<=nextDuration+.05);
 preserveExistingClipsOnNextMetadata=false;state.duration=nextDuration;state.sourceMeta={...(state.sourceMeta||{}),duration:nextDuration};
 $("totalTime").textContent=fmt(state.duration);$("durationBadge").textContent=fmt(state.duration);$("previewEmpty").classList.add("hidden");
 if(!keepEdits){state.clips=[];state.selectedId=null;state.visualTags=[]}
 lastCommittedSnapshot=snapshot();persist();
 if(keepEdits){renderAll();setImportStatus("Project reconnected · saved edits restored. Your video stays in this browser.","ready");toast("Saved edits restored");return}
 renderAll();generateClips({notify:false});setImportStatus(`Ready · ${state.clips.length} clips planned at ${state.durationPreset}s each. Change the length in Media, then regenerate if needed.`,"ready");$("previewEmpty").classList.add("hidden");toast(`Video ready · ${state.clips.length} clips created`);
}
async function loadVideoUrl(){
 const raw=$("videoUrl").value.trim();if(!raw)return toast("Paste a direct video file link first.");
 let url;try{url=new URL(raw);if(!["http:","https:"].includes(url.protocol))throw new Error("Only http or https video links are supported.")}catch(error){setImportStatus(error.message||"Enter a valid direct video URL.","error");return toast("Check the video link")}
 const button=$("loadUrlBtn");button.disabled=true;setImportStatus("Downloading the linked video into this tab…","loading");
 try{
  const response=await fetch(url.href,{mode:"cors",credentials:"omit"});if(!response.ok)throw new Error(`The video host returned HTTP ${response.status}.`);
  const mime=(response.headers.get("content-type")||"").toLowerCase(),declaredSize=Number(response.headers.get("content-length")||0),maxBytes=300*1024*1024;
  if(declaredSize>maxBytes)throw new Error("This link is over 300 MB. Upload a smaller local file to avoid mobile memory problems.");
  if(mime.includes("text/html"))throw new Error("That link opens a webpage, not a video file. Paste a direct MP4/WebM file URL.");
  const blob=await response.blob();if(!blob.size)throw new Error("The link returned an empty file.");if(blob.size>maxBytes)throw new Error("This linked video is over 300 MB. Use a smaller file to protect browser memory.");
  let filename=decodeURIComponent(url.pathname.split("/").filter(Boolean).pop()||"video.mp4").replace(/[\\/:*?\"<>|]/g,"-");
  if(!/\.(mp4|webm|mov|mkv|m4v|ogv)$/i.test(filename)){const ext=mime.includes("webm")?".webm":mime.includes("quicktime")?".mov":".mp4";filename="video"+ext}
  const file=new File([blob],filename,{type:blob.type||"video/mp4"});updateSource(file,{sourceUrl:url.href});$("mediaName").textContent=filename+" · link";setImportStatus("Link imported locally. Preparing preview…","loading");
 }catch(error){const message=error instanceof TypeError?"The link could not be fetched. The host may block browser access (CORS); upload the file or use a direct link with CORS enabled.":(error.message||"Could not import that video link.");setImportStatus(message,"error");toast("Link import failed")}finally{button.disabled=false}
}
function loadSourceFile(file){if(!file)return;const supported=/\.(mp4|webm|mov|mkv|m4v|ogv|avi)$/i.test(file.name)||String(file.type||"").startsWith("video/");if(!supported){toast("Choose a video file such as MP4, WebM or MOV.");return}updateSource(file)}
$("uploadBtn").onclick=()=>$("videoInput").click();$("dropBrowseBtn").onclick=()=>$("videoInput").click();$("emptyUploadBtn").onclick=()=>$("videoInput").click();
$("videoInput").onchange=e=>{loadSourceFile(e.target.files?.[0]);e.target.value=""};$("dropCard").ondragover=e=>e.preventDefault();$("dropCard").ondrop=e=>{e.preventDefault();loadSourceFile(e.dataTransfer.files?.[0])};
$("loadUrlBtn").onclick=loadVideoUrl;$("videoUrl").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();loadVideoUrl()}};
$("previewVideo").onloadedmetadata=autoGenerateAfterMetadata;
$("previewVideo").onerror=()=>{preserveExistingClipsOnNextMetadata=false;$("previewEmptyTitle").textContent="This video format cannot be previewed";$("previewEmptyHint").textContent="Try MP4/H.264 or WebM. Some MKV/MOV codecs are not supported by every mobile browser.";$("previewEmpty").classList.remove("hidden");setImportStatus("Preview failed. The browser cannot read this file's codec/container; try MP4/H.264 or WebM.","error")};
$("previewVideo").ontimeupdate=()=>{const v=$("previewVideo");$("currentTime").textContent=fmt(v.currentTime);$("seekBar").value=state.duration?v.currentTime/state.duration*100:0;const c=selectedClip();if(c&&!v.paused&&v.currentTime>=c.end){v.pause();v.currentTime=c.end;$("playBtn").textContent="▶"}};
$("playBtn").onclick=()=>{const v=$("previewVideo");if(v.paused){if(selectedClip()&&v.currentTime>=selectedClip().end)v.currentTime=selectedClip().start;v.play().catch(()=>toast("The browser could not play this video."));$("playBtn").textContent="Ⅱ"}else{v.pause();$("playBtn").textContent="▶"}};
$("backBtn").onclick=()=>$("previewVideo").currentTime=clamp($("previewVideo").currentTime-5,0,state.duration);$("forwardBtn").onclick=()=>$("previewVideo").currentTime=clamp($("previewVideo").currentTime+5,0,state.duration);$("seekBar").oninput=e=>$("previewVideo").currentTime=Number(e.target.value)/100*state.duration;
$("aspectSelect").onchange=e=>{state.aspect=e.target.value;commitHistory();renderAll()};$("safeZoneBtn").onclick=()=>{state.showSafe=!state.showSafe;commitHistory();renderAll()};$$(`.tool,.mobile-tab`).forEach(b=>b.onclick=()=>setTool(b.dataset.tool));$("closeInspectorBtn").onclick=()=>$("inspector").classList.remove("open");$("undoBtn").onclick=undo;$("redoBtn").onclick=redo;$("splitAtPlayheadBtn").onclick=splitSelected;$("duplicateClipBtn").onclick=duplicateSelected;$("moveClipEarlierBtn").onclick=()=>moveSelected(-1);$("moveClipLaterBtn").onclick=()=>moveSelected(1);$("deleteClipBtn").onclick=deleteSelected;
$("durationChips").onclick=e=>{const b=e.target.closest("button");if(!b)return;$$("button",$("durationChips")).forEach(x=>x.classList.remove("active"));b.classList.add("active");if(b.dataset.duration==="custom")$("customDurationWrap").classList.remove("hidden");else{state.durationPreset=Number(b.dataset.duration);$("customDurationWrap").classList.add("hidden")}};$("customDuration").oninput=e=>state.durationPreset=clamp(Number(e.target.value)||30,1,3600);$("generateClipsBtn").onclick=generateClips;$("applyTitleBtn").onclick=applySeriesTitle;
$("applyTrimBtn").onclick=()=>{const c=selectedClip();if(!c)return;const s=Number($("clipStart").value),e=Number($("clipEnd").value);if(!Number.isFinite(s)||!Number.isFinite(e)||e-s<.5)return toast("Clip must be at least 0.5 seconds.");c.start=clamp(s,0,state.duration);c.end=clamp(e,c.start+.5,state.duration);commitHistory();renderAll()};$("captionText").oninput=e=>{const c=selectedClip();if(c)c.caption=e.target.value;else state.captionStyle.text=e.target.value;updateTitlePreview();persist()};$("captionText").onchange=()=>commitHistory();$("applyCaptionBtn").onclick=()=>{const c=selectedClip();if(!c)return toast("Select a clip first.");c.caption=$("captionText").value;c.captionStyle={...c.captionStyle,highlight:$("captionHighlightColor").value,positionY:Number($("captionPositionY").value),style:$("captionStyle").value};commitHistory();updateTitlePreview()};
["titleFont","titleSize","titleColor","titleOutline","titleOpacity"].forEach(id=>{$(id).oninput=()=>{state.titleStyle={...state.titleStyle,font:$("titleFont").value,size:Number($("titleSize").value),color:$("titleColor").value,outline:$("titleOutline").value,opacity:Number($("titleOpacity").value)};const c=selectedClip();if(c)c.titleStyle={...state.titleStyle};updateTitlePreview();persist()};$(id).onchange=()=>commitHistory()});
["fxPreset","fxBrightness","fxContrast","fxSaturation","fxBlur","fxSpeed","fxVolume","fxMute"].forEach(id=>{$(id).oninput=e=>{const c=selectedClip();if(!c)return;const fx={...DEFAULT_FX,...(c.fx||{})};if(id==="fxPreset"){fx.preset=e.target.value;if(fx.preset==="Cinema"){fx.contrast=1.12;fx.saturation=.82;fx.brightness=-.03}else if(fx.preset==="Vibrant"){fx.contrast=1.08;fx.saturation=1.35;fx.brightness=.02}else if(fx.preset==="Mono"){fx.saturation=0}else if(fx.preset==="Dreamy"){fx.brightness=.07;fx.saturation=1.1;fx.blur=.3}else if(fx.preset==="Original")Object.assign(fx,DEFAULT_FX)}else if(id==="fxMute")fx.mute=e.target.checked;else fx[id.replace("fx","").toLowerCase()]=Number(e.target.value);c.fx=fx;syncInspectorFromClip();updatePreviewEffects();persist()};$(id).onchange=()=>commitHistory()});
function normalizeSelectedAudio(){const c=selectedClip();if(!c)return toast("Select a clip first.");c.fx={...DEFAULT_FX,...(c.fx||{}),normalize:true};syncInspectorFromClip();updatePreviewEffects();commitHistory();toast("Loudness normalization will be applied during export")}
$("normalizeAudioBtn").onclick=normalizeSelectedAudio;$("normalizeAudioFxBtn").onclick=normalizeSelectedAudio;

let ffmpegInstance=null,ffmpegLoading=null;async function getFFmpeg(){if(ffmpegInstance)return ffmpegInstance;if(ffmpegLoading)return ffmpegLoading;ffmpegLoading=(async()=>{const {FFmpeg}=await import("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js");const {fetchFile,toBlobURL}=await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js");const ff=new FFmpeg();const base="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";await ff.load({coreURL:await toBlobURL(`${base}/ffmpeg-core.js`,"text/javascript"),wasmURL:await toBlobURL(`${base}/ffmpeg-core.wasm`,"application/wasm"),workerURL:await toBlobURL(`${base}/ffmpeg-core.worker.js`,"text/javascript")});ff.__fetchFile=fetchFile;ffmpegInstance=ff;return ff})();try{return await ffmpegLoading}catch(e){ffmpegLoading=null;throw e}}
const MAX_CONCURRENT_EXPORTS=1;const exportQueue=[];let exportMode="smart";
function openExport(){if(!state.clips.length)return toast("Your clip list is empty. Import a video first.");if(!state.sourceFile)return toast("Re-import the original video before exporting this project.");$("export-queue").classList.remove("hidden");$("exportSummary").textContent=`${state.clips.length} clips • ${fmt(state.clips.reduce((a,c)=>a+c.end-c.start,0))} total`;$("memoryHint").textContent=`Smart tries stream-copy first, then converts if needed • ${navigator.deviceMemory||"unknown"} GB device memory`;renderQueue(state.clips)}
function renderQueue(clips){$("queueList").innerHTML=clips.map((c,i)=>`<div class="queue-item" id="queue-${c.id}"><div><strong>Part ${i+1} · ${esc(c.title)}</strong><small>${fmt(c.start)} → ${fmt(c.end)}</small><div class="queue-progress"><span></span></div></div><small class="queue-status">waiting</small></div>`).join("")}
function setQueueStatus(id,status,pct=0){const el=$(`queue-${id}`);if(!el)return;el.querySelector(".queue-status").textContent=status;el.querySelector(".queue-progress span").style.width=`${pct}%`}
function chooseOutputName(c,index){const base=(c.title||`clip-${index+1}`).replace(/[^\w\u00C0-\uFFFF]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||`clip-${index+1}`;return `${String(index+1).padStart(2,"0")}-${base}.mp4`}
function downloadBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2500)}
function canStreamCopy(mode,needsFilter){return (mode==="copy"||mode==="smart")&&!needsFilter&&mode!=="mobile"}
async function renderClip(c,index,mode=exportMode){
 if(!state.sourceFile)throw new Error("Local export needs the source video file. Re-import the original video.");
 const fx={...DEFAULT_FX,...(c.fx||DEFAULT_FX)};
 const needsFilter=fx.speed!==1||fx.brightness!==0||fx.contrast!==1||fx.saturation!==1||fx.blur>0||fx.volume!==1||fx.mute||fx.normalize;
 if(mode==="copy"&&needsFilter)throw new Error("Original stream mode cannot apply FX, speed or volume edits. Choose Smart or High quality to render those edits.");
 const ff=await getFFmpeg(),inputName=`input-${uid()}.bin`,output=`output-${uid()}.mp4`;
 await ff.writeFile(inputName,await ff.__fetchFile(state.sourceFile));
 const duration=Math.max(.5,c.end-c.start),useCopy=canStreamCopy(mode,needsFilter);
 const buildArgs=(streamCopy)=>{
  const args=["-ss",String(c.start),"-i",inputName,"-t",String(duration),"-map","0:v:0?","-map","0:a:0?"];
  if(streamCopy)args.push("-c","copy","-avoid_negative_ts","make_zero");
  else{
   const vf=[];
   if(fx.brightness||fx.contrast!==1||fx.saturation!==1)vf.push(`eq=brightness=${fx.brightness}:contrast=${fx.contrast}:saturation=${fx.saturation}`);
   if(fx.blur>0)vf.push(`boxblur=${fx.blur}:1`);
   if(fx.speed!==1)vf.push(`setpts=${1/fx.speed}*PTS`);
   if(mode==="mobile")vf.push("scale='min(1280,iw)':-2");
   if(vf.length)args.push("-vf",vf.join(","));
   if(fx.mute)args.push("-an");
   else{
    const audioFilters=[];
    if(fx.speed!==1)audioFilters.push(`atempo=${clamp(fx.speed,.5,2)}`);
    if(fx.volume!==1)audioFilters.push(`volume=${fx.volume}`);
    if(fx.normalize)audioFilters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    if(audioFilters.length)args.push("-af",audioFilters.join(","));
   }
   args.push("-c:v","libx264","-preset","veryfast","-crf",mode==="mobile"?"28":mode==="high"?"20":"22","-c:a","aac","-b:a",mode==="mobile"?"96k":"128k","-movflags","+faststart");
  }
  args.push(output);return args;
 };
 const execute=async(streamCopy)=>{
  const onProgress=({progress})=>setQueueStatus(c.id,"rendering",Math.round(progress*100));ff.on("progress",onProgress);
  try{await ff.exec(buildArgs(streamCopy));const data=await ff.readFile(output);return new Blob([data],{type:"video/mp4"})}
  finally{if(typeof ff.off==="function")ff.off("progress",onProgress)}
 };
 try{
  try{return await execute(useCopy)}
  catch(error){
   const message=String(error?.message||error);
   if(mode==="smart"&&useCopy&&!/out of memory|allocation failed/i.test(message)){
    setQueueStatus(c.id,"Smart retry: stream-copy failed",0);
    try{await ff.deleteFile(output)}catch{}
    return await execute(false);
   }
   throw error;
  }
 }finally{try{await ff.deleteFile(inputName)}catch{}try{await ff.deleteFile(output)}catch{}}
}
async function startExport(){if(exportQueue.length)return;const clips=[...state.clips];if(!clips.length)return;$("startExportBtn").disabled=true;$("exportRecoveryActions").classList.add("hidden");exportQueue.push(...clips);for(let i=0;i<clips.length;i++){const c=clips[i];setQueueStatus(c.id,"starting",0);try{const blob=await renderClip(c,i,exportMode);downloadBlob(blob,chooseOutputName(c,i));setQueueStatus(c.id,"done",100);await new Promise(r=>setTimeout(r,60))}catch(e){setQueueStatus(c.id,"failed",0);$("exportRecoveryActions").classList.remove("hidden");$("recoveryText").textContent=`${e?.message||"The browser could not render this clip."} Try Original stream for a compatible source, Mobile safe for a lower-memory render, or export one clip first.`;toast("Export failed — see details below");break}}exportQueue.length=0;$("startExportBtn").disabled=false}
$("exportBtn").onclick=openExport;$("closeExportBtn").onclick=()=>$("export-queue").classList.add("hidden");$("startExportBtn").onclick=startExport;$$(`.export-mode`).forEach(b=>b.onclick=()=>{$$(`.export-mode`).forEach(x=>x.classList.remove("active"));b.classList.add("active");exportMode=b.dataset.mode});$("recoveryOriginalBtn").onclick=()=>{exportMode="copy";startExport()};$("recoveryLowBtn").onclick=()=>{exportMode="mobile";startExport()};$("recoverySingleClipBtn").onclick=async()=>{const c=selectedClip();if(!c)return toast("Select one clip first.");try{const b=await renderClip(c,0,"mobile");downloadBlob(b,chooseOutputName(c,0));setQueueStatus(c.id,"done",100)}catch{toast("Single-clip export failed")}};
$("projectName").oninput=e=>{state.projectName=e.target.value;persist()};$("saveProjectBtn").onclick=()=>{const manifest=createProjectManifest({projectName:state.projectName,sourceFileName:state.sourceFile?.name||state.sourceMeta?.fileName||"",sourceFileSize:state.sourceFile?.size||state.sourceMeta?.fileSize||0,sourceDuration:state.duration,sourceUrl:state.sourceMeta?.sourceUrl||state.sourceUrl||"",clips:state.clips,controls:{aspectSelect:state.aspect}},new Date().toISOString());downloadBlob(new Blob([JSON.stringify(manifest,null,2)],{type:"application/json"}),`${state.projectName.replace(/\W+/g,"-")||"clipsmith-project"}.clipsmith.json`);toast("Project file saved")};$("loadProjectBtn").onclick=()=>$("projectFileInput").click();$("projectFileInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const manifest=validateProjectManifest(JSON.parse(await f.text()));if(!manifest)throw new Error("Invalid project file");if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;state.sourceFile=null;$("previewVideo").removeAttribute("src");$("previewVideo").load();state.projectName=manifest.projectName;state.clips=manifest.clips;state.aspect=manifest.controls?.aspectSelect||"16:9";state.duration=manifest.source.duration||0;state.sourceMeta={fileName:manifest.source.fileName,fileSize:manifest.source.fileSize,sourceUrl:manifest.source.url||"",duration:manifest.source.duration||0};state.sourceUrl=manifest.source.url||"";state.selectedId=state.clips[0]?.id||null;if(state.sourceMeta.sourceUrl&&$("videoUrl"))$("videoUrl").value=state.sourceMeta.sourceUrl;$("mediaName").textContent="Offline source · "+(state.sourceMeta.fileName||"video")+" · re-import to preview/export";if($("previewEmptyTitle"))$("previewEmptyTitle").textContent="Project opened";if($("previewEmptyHint"))$("previewEmptyHint").textContent="Re-import the saved source file or load its direct link to preview and export."; $("previewEmpty").classList.remove("hidden");lastCommittedSnapshot=snapshot();commitHistory();renderAll();toast("Project opened · relink the source to export")}catch(err){toast(err.message||"Could not open project")}};
function loadExternalScript(src,globalName){
 if(window[globalName])return Promise.resolve(window[globalName]);
 return new Promise((resolve,reject)=>{
  let script=document.querySelector(`script[data-global="${globalName}"]`);
  if(!script){script=document.createElement("script");script.src=src;script.async=true;script.dataset.global=globalName;document.head.appendChild(script)}
  const loaded=()=>window[globalName]?resolve(window[globalName]):reject(new Error("The visual model did not initialize."));
  const failed=()=>{script.remove();reject(new Error("The model could not be downloaded. Check your connection."))};
  script.addEventListener("load",loaded,{once:true});script.addEventListener("error",failed,{once:true});
  if(window[globalName])loaded();
 });
}
async function analyzeCurrentFrame(){
 const video=$("previewVideo"),button=$("analyzeFrameBtn"),status=$("visualAnalysisStatus");
 if(!state.sourceFile||video.readyState<2||!video.videoWidth)return toast("Import the video and wait for its preview to load first.");
 button.disabled=true;status.textContent="Loading the open-source object detector… this may take a moment on mobile.";
 try{
  if(!visionModelPromise){
   visionModelPromise=(async()=>{
    await loadExternalScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js","tf");
    await window.tf.ready();
    await loadExternalScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js","cocoSsd");
    return window.cocoSsd.load({base:"lite_mobilenet_v2"});
   })();
  }
  const model=await visionModelPromise;
  const predictions=await model.detect(video,10,.35);
  state.visualTags=[...new Set(predictions.filter(p=>p.score>=.35).map(p=>p.class))].slice(0,8);
  commitHistory();
  status.textContent=state.visualTags.length?`Detected in this frame: ${state.visualTags.join(", ")}. Generate ideas to use these cues.`:"No clear objects detected in this frame. Add a transcript or description for better ideas.";
  toast(state.visualTags.length?"Frame analyzed in your browser":"No clear objects detected");
 }catch(error){
  visionModelPromise=null;
  status.textContent=error?.message||"Local visual analysis could not start. You can still generate ideas from text.";
  toast("Frame analysis unavailable");
 }finally{button.disabled=false;}
}
if($("analyzeFrameBtn"))$("analyzeFrameBtn").onclick=analyzeCurrentFrame;
$("generateIdeasBtn").onclick=()=>{const ideas=generateCreatorIdeas({title:selectedClip()?.title||state.seriesTitle,fileName:state.sourceFile?.name||"",transcript:$("ideasTranscript").value,visualTags:state.visualTags||[],platform:$("creatorPlatform").value,tone:$("creatorTone").value,language:$("creatorLanguage").value});$("creatorResults").innerHTML=`<div class="result-card"><span>Caption ideas</span>${ideas.captions.map(x=>`<div class="copy-line"><p>${esc(x)}</p><button data-copy="${esc(x)}">Copy</button></div>`).join("")}</div><div class="result-card"><span>Hashtags</span><p>${ideas.hashtags.join(" ")}</p><button data-copy="${esc(ideas.hashtags.join(" "))}">Copy hashtags</button></div><div class="result-card"><span>Hooks & titles</span>${ideas.hooks.slice(0,4).map(x=>`<p>${esc(x)}</p>`).join("")}</div>`};$("creatorResults").onclick=e=>{const b=e.target.closest("button[data-copy]");if(b)navigator.clipboard?.writeText(b.dataset.copy).then(()=>toast("Copied"))};
$("titleOverlay").addEventListener("pointerdown",startOverlayDrag);$("captionOverlay").addEventListener("pointerdown",startOverlayDrag);function startOverlayDrag(e){const el=e.currentTarget,stage=$("preview-stage"),rect=stage.getBoundingClientRect(),startY=e.clientY,initial=parseFloat(getComputedStyle(el).top)||0;el.setPointerCapture(e.pointerId);const move=ev=>{const delta=(ev.clientY-startY)/rect.height*100;el.style.top=`${clamp(initial/rect.height*100+delta,4,88)}%`;el.style.bottom="auto"};const up=()=>{el.removeEventListener("pointermove",move);el.removeEventListener("pointerup",up)};el.addEventListener("pointermove",move);el.addEventListener("pointerup",up)}
window.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();e.shiftKey?redo():undo()}if((e.ctrlKey||e.metaKey)&&e.key==="y"){e.preventDefault();redo()}if(e.code==="Space"&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();$("playBtn").click()}});recoverDraft();renderAll();
