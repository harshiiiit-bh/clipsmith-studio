const MB=1024*1024;
export function getMemoryProfile({deviceMemory,userAgent}={}){
  const ua=String(userAgent??(typeof navigator!=="undefined"?navigator.userAgent:""));
  const reported=Number(deviceMemory??(typeof navigator!=="undefined"?navigator.deviceMemory:NaN));
  const hasEstimate=Number.isFinite(reported)&&reported>0;
  const isAndroid=/android/i.test(ua);
  const tier=hasEstimate?(reported<=2?"low":reported>=6?"high":"balanced"):(isAndroid?"balanced":"standard");
  const config={
    low:{label:"RAM-lean profile",recommendedSourceBytes:180*MB,recommendedDurationSeconds:40*60,description:"Low reported device RAM: close other apps for large videos. ClipSmith warns before heavy jobs and frees temporary AI/video engines after processing."},
    balanced:{label:"Balanced memory profile",recommendedSourceBytes:360*MB,recommendedDurationSeconds:60*60,description:"Balanced profile: exports run one clip at a time, heavy models are lazy-loaded, and temporary runtimes are released after jobs."},
    high:{label:"High-headroom profile",recommendedSourceBytes:650*MB,recommendedDurationSeconds:120*60,description:"Higher reported memory headroom. Very large sources can still exceed WebView memory; serial export and cleanup remain enabled."},
    standard:{label:"Conservative memory profile",recommendedSourceBytes:520*MB,recommendedDurationSeconds:90*60,description:"This browser does not expose a reliable RAM estimate. ClipSmith uses conservative source-size guidance and keeps heavy processing sequential."}
  }[tier];
  return {tier,isAndroid,reportedMemoryGB:hasEstimate?reported:null,...config};
}
export function getMediaMemoryWarning({fileSize=0,duration=0,profile=getMemoryProfile()}={}){
  const size=Number(fileSize)||0,seconds=Number(duration)||0;
  const warnings=[];
  if(size>profile.recommendedSourceBytes){
    const sizeMB=Math.round(size/MB),limitMB=Math.round(profile.recommendedSourceBytes/MB);
    warnings.push(`This source is ${sizeMB} MB, above the ${limitMB} MB guideline for the ${profile.tier==="low"?"low-memory":profile.tier} profile.`);
  }
  if(seconds>profile.recommendedDurationSeconds){
    const minutes=Math.round(seconds/60),limit=Math.round(profile.recommendedDurationSeconds/60);
    warnings.push(`This video is about ${minutes} minutes long, above the ${limit}-minute guideline for this device profile.`);
  }
  if(!warnings.length)return "";
  return warnings.join(" ")+" FFmpeg WebAssembly can use several times the source file size in working memory. Close other apps and continue only if the phone has enough free RAM and storage.";
}
