import assert from "node:assert/strict";
import { getMemoryProfile, getMediaMemoryWarning } from "../mobile-memory.js";

const low=getMemoryProfile({deviceMemory:2,userAgent:"Mozilla/5.0 (Linux; Android 15)"});
const balanced=getMemoryProfile({deviceMemory:4,userAgent:"Android"});
const high=getMemoryProfile({deviceMemory:8,userAgent:"Android"});
assert.equal(low.tier,"low");
assert.equal(balanced.tier,"balanced");
assert.equal(high.tier,"high");
assert.ok(low.recommendedSourceBytes<balanced.recommendedSourceBytes);
assert.ok(balanced.recommendedSourceBytes<high.recommendedSourceBytes);
assert.match(getMediaMemoryWarning({fileSize:220*1024*1024,duration:2700,profile:low}),/memory/i);
assert.equal(getMediaMemoryWarning({fileSize:10*1024*1024,duration:60,profile:low}),"");
assert.equal(getMemoryProfile({userAgent:"Desktop"}).tier,"standard");
console.log("ClipSmith mobile memory checks passed.");
