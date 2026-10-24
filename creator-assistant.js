const STOP_WORDS = new Set([
  "the","and","for","that","this","with","from","your","you","are","was","were","have","has","had","but","not","just","into","then","than","when","what","why","how","who","where","will","can","all","any","one","two","his","her","their","our","out","about","after","before","because","very","more","most","clip","video","part","episode","scene","shorts","reels","movie","movies",
  "hai","hain","tha","thi","the","aur","ek","ye","ya","ki","ke","ka","ko","se","me","mein","par","toh","bhi","nahi","nahin","kya","kyun","jo","woh","wo","iska","uska","tum","aap","hum","main","mera","meri","tere","tera","ho","gaya","gayi","kar","karo","mat","bas"
]);

const TEMPLATES = {
  Hinglish: {
    Hype: [
      "{topic} ka ye moment miss mat karna 🔥",
      "Bhai, ye scene toh seedha replay-worthy hai 👀",
      "End tak dekho — best part isi mein hai ⚡",
      "Is moment ka timing dekho, pure cinema 🎬",
      "POV: tumne ye scene pehli baar dekha 😂",
      "Ye wala part doston ko bhejna banta hai 🤝",
      "Ek scene, itni saari energy 🔥",
      "Rate this moment out of 10 👇"
    ],
    Funny: [
      "{topic} mein asli comedy yahin hai 😂",
      "Bhai ka confidence dekho zara 💀",
      "Is scene ko serious lena impossible hai 🤣",
      "When the plan is perfect… bas duniya chhod ke 😂",
      "Ye reaction priceless tha 😭",
      "Tag karo us dost ko jo aisa hi karta hai 👇",
      "Comedy ka timing ho toh aisa 🎬",
      "Replay kiye bina reh paoge? 😂"
    ],
    Dramatic: [
      "{topic} ka ye moment alag hi level ka hai 🖤",
      "Kabhi kabhi ek scene sab kuch keh deta hai.",
      "Ye moment hit different karta hai… 🎬",
      "The pause. The look. The impact. 🔥",
      "Is scene ka emotion miss mat karna.",
      "Ek chhota moment, bada impact.",
      "Tell me this isn't iconic 👀",
      "Ye scene yaad rehne wala hai."
    ],
    Informative: [
      "{topic} ke is moment mein ek detail notice ki? 👀",
      "Scene ko ek baar aur dekho — details matter.",
      "Did you catch that little detail? 🎬",
      "Is moment mein sabse interesting part kya tha?",
      "Quick breakdown: is scene ka best moment 👇",
      "Context ke saath dekho, scene aur better lagega.",
      "Which detail stood out to you?",
      "Save this clip for the next rewatch."
    ]
  },
  English: {
    Hype: [
      "This {topic} moment deserves a replay 🔥",
      "Wait for the best part 👀",
      "A scene this good belongs on repeat 🎬",
      "The timing is everything ⚡",
      "POV: you found your new favourite moment",
      "Send this to someone who needs to see it 🤝",
      "One clip. All the energy. 🔥",
      "Rate this moment out of 10 👇"
    ],
    Funny: [
      "The confidence is doing all the work 😂",
      "This scene has absolutely no business being this funny 💀",
      "The reaction makes it ten times better 😭",
      "When the plan goes exactly… not to plan 🤣",
      "Comedy is all about timing.",
      "Tag the friend who would do this 👇",
      "That delivery was priceless 😂",
      "Tell me you didn't replay this."
    ],
    Dramatic: [
      "Some scenes stay with you long after they end.",
      "This {topic} moment hits differently. 🖤",
      "One look. One line. A lasting impact.",
      "The silence says more than the dialogue.",
      "Pure cinema in a few seconds. 🎬",
      "A moment worth remembering.",
      "This is why storytelling matters.",
      "Which part hit you the hardest?"
    ],
    Informative: [
      "Did you notice this detail in {topic}? 👀",
      "Watch the scene again with this detail in mind.",
      "A quick look at the moment that changes everything.",
      "What detail stood out to you?",
      "Context makes this scene even better.",
      "A closer look at a memorable moment. 🎬",
      "Did you catch that on the first watch?",
      "Save this for your next rewatch."
    ]
  },
  Hindi: {
    Hype: [
      "{topic} का ये पल मिस मत करना 🔥",
      "भाई, इस सीन का टाइमिंग देखो 👀",
      "आख़िर तक देखना — बेस्ट पार्ट आगे है ⚡",
      "ये वाला मोमेंट दोबारा देखने लायक है 🎬",
      "इस सीन को 10 में से कितने नंबर? 👇",
      "दोस्तों को भेजने वाला सीन 🤝",
      "एक सीन, पूरा धमाल 🔥",
      "तुम्हारा फेवरेट पार्ट कौन-सा है?"
    ],
    Funny: [
      "{topic} में असली कॉमेडी यहीं है 😂",
      "भाई का कॉन्फिडेंस तो देखो 💀",
      "ये रिएक्शन अनमोल था 😭",
      "इस सीन को देखकर हँसी रोकना मुश्किल है 🤣",
      "टाइमिंग हो तो ऐसी 😂",
      "उस दोस्त को टैग करो जो ऐसा ही करता है 👇",
      "ये सीन कितनी बार देखा?",
      "रीप्ले किए बिना रह पाओगे?"
    ],
    Dramatic: [
      "{topic} का ये पल दिल छू जाता है 🖤",
      "कभी-कभी एक सीन बहुत कुछ कह देता है।",
      "ये पल लंबे समय तक याद रहेगा। 🎬",
      "एक नज़र, एक बात, गहरा असर।",
      "इस सीन की फीलिंग अलग है।",
      "कुछ मोमेंट्स बार-बार देखने का मन करता है।",
      "इस सीन ने सबसे ज़्यादा क्या महसूस कराया?",
      "ये है असली कहानी का असर।"
    ],
    Informative: [
      "{topic} के इस सीन में एक डिटेल नोटिस की? 👀",
      "एक बार फिर देखो — छोटी डिटेल भी मायने रखती है।",
      "इस मोमेंट का सबसे दिलचस्प हिस्सा क्या है?",
      "क्या आपने ये बात पहली बार में नोटिस की?",
      "सीन को संदर्भ के साथ देखो। 🎬",
      "इस पल की खास बात क्या लगी?",
      "आपकी नज़र में सबसे अहम डिटेल कौन-सी है?",
      "अगली बार देखते समय इस डिटेल पर ध्यान देना।"
    ]
  }
};

const uniq = (items) => [...new Set(items.filter(Boolean))];

function clean(value) {
  return String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
}

function safeTopic(value) {
  const text = clean(value).replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").trim();
  return text.length > 54 ? text.slice(0, 51).trim() + "…" : text;
}

function hashtagToken(value) {
  const raw = clean(value).replace(/^#+/, "");
  const words = raw.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length) return "";
  const joined = words.map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1)).join("");
  return joined.length >= 2 ? "#" + joined.slice(0, 34) : "";
}

function getKeywords(text) {
  const words = clean(text).toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const counts = new Map();
  for (const word of words) {
    if (STOP_WORDS.has(word) || /^\d+$/.test(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a,b) => b[1] - a[1]).map(([word]) => word);
}

function hashtagSet({ title, fileName, transcript, visualTags, keywords, platform }) {
  const corpus = [title, fileName, transcript, ...(visualTags ?? []), keywords].map(clean).join(" ");
  const lower = corpus.toLowerCase();
  const tags = [];
  const titleSlug = hashtagToken(safeTopic(title));
  if (titleSlug && !/^#(yourseriesname|untitledseries|myclips|video)$/i.test(titleSlug)) tags.push(titleSlug);
  const platformTags = {
    "YouTube Shorts": ["#YouTubeShorts", "#Shorts"],
    "Instagram Reels": ["#InstagramReels", "#ReelsIndia"],
    TikTok: ["#TikTok", "#TikTokVideo"],
    Facebook: ["#FacebookReels", "#VideoHighlights"],
    LinkedIn: ["#LinkedInVideo", "#CreatorTips"]
  };
  tags.push(...(platformTags[platform] ?? ["#VideoHighlights"]));

  if (/munna|bhai|mbbs|bollywood|hindi cinema|hindi movie|indian film/.test(lower)) {
    tags.push("#Bollywood", "#HindiCinema", "#MovieClips", "#ComedyScene");
  }
  if (/comedy|funny|joke|lol|humou?r|हँसी|मज़ाक|mazak/.test(lower)) tags.push("#Comedy", "#FunnyMoments");
  if (/love|romance|emotional|heartbreak|sad|प्यार|दिल/.test(lower)) tags.push("#EmotionalScene", "#LoveStory");
  if (/action|fight|battle|chase|war|एक्शन/.test(lower)) tags.push("#ActionScene", "#EpicMoment");
  if (/study|learn|tutorial|explained|how to|education|tips|exam/.test(lower)) tags.push("#LearnSomething", "#QuickExplainer");
  if (/game|gaming|player|level|boss|match/.test(lower)) tags.push("#GamingClips", "#Gameplay");
  if (/food|cook|recipe|restaurant|chef|meal/.test(lower)) tags.push("#FoodContent", "#FoodReels");
  if (/travel|trip|mountain|beach|journey/.test(lower)) tags.push("#TravelReels", "#ExploreMore");
  if (/person|people|man|woman|child/.test((visualTags ?? []).join(" ").toLowerCase())) tags.push("#PeopleAndStories");
  if (/car|truck|bus|motorcycle|bicycle/.test((visualTags ?? []).join(" ").toLowerCase())) tags.push("#OnTheMove");
  for (const word of getKeywords(corpus)) {
    if (tags.length >= 18) break;
    if (word.length >= 4) tags.push(hashtagToken(word));
  }
  tags.push("#VideoHighlights", "#CreatorEdit");
  const maxByPlatform = { "YouTube Shorts": 12, "Instagram Reels": 12, TikTok: 10, Facebook: 10, LinkedIn: 8 };
  return uniq(tags).slice(0, maxByPlatform[platform] ?? 12);
}

export function generateCreatorIdeas({
  title = "",
  fileName = "",
  transcript = "",
  visualTags = [],
  keywords = "",
  platform = "YouTube Shorts",
  tone = "Hype",
  language = "Hinglish"
} = {}) {
  const cleanTitle = safeTopic(title) || safeTopic(fileName) || "this clip";
  const topic = cleanTitle.length > 48 ? cleanTitle.slice(0,45) + "…" : cleanTitle;
  const templateSet = TEMPLATES[language] ?? TEMPLATES.Hinglish;
  const templates = templateSet[tone] ?? templateSet.Hype;
  const baseCaptions = templates.map((line) => line.replaceAll("{topic}", topic));
  const transcriptLine = clean(transcript).split(/[.!?।！？]+/).map(clean).find(line => line.length >= 12) ?? "";
  let contextualHook = "";
  if (transcriptLine) {
    const quote = transcriptLine.length > 82 ? transcriptLine.slice(0, 79).trimEnd() + "…" : transcriptLine;
    contextualHook = language === "Hindi"
      ? "इस लाइन का असर देखो: “" + quote + "” 👀"
      : language === "English"
        ? "This line is the hook: “" + quote + "” 🎬"
        : "Ye line hi scene ka highlight hai: “" + quote + "” 👀";
  } else if ((visualTags ?? []).length) {
    const visual = clean(visualTags[0]);
    contextualHook = language === "Hindi"
      ? visual + " वाले इस पल पर ध्यान दो 👀"
      : language === "English"
        ? "Look at the " + visual + " in this moment 👀"
        : visual + " wala moment notice kiya? 👀";
  }
  const captions = uniq([contextualHook, ...baseCaptions]).slice(0, 8);
  const tags = hashtagSet({ title: cleanTitle, fileName, transcript, visualTags, keywords, platform });
  const signals = [];
  if (cleanTitle && !/^your series title|^untitled series|^my clips$/i.test(cleanTitle)) signals.push("project title / filename");
  if (clean(transcript)) signals.push("imported subtitles and clip captions");
  if ((visualTags ?? []).length) signals.push("objects detected from sampled video frames");
  if (clean(keywords)) signals.push("your keywords");
  return {
    captions,
    hooks: uniq([contextualHook, ...baseCaptions.slice(0, 5)]).slice(0, 6),
    titles: uniq([`${topic} — Best Moment`, `The ${topic} Scene You Need to See`, `Wait for the ${topic} Moment`, `This ${topic} Scene Hits Different`, `${topic} Explained in 30 Seconds`, `Part 1: ${topic}`]).slice(0, 6),
    hashtags: tags,
    visualTags: uniq((visualTags ?? []).map(clean)).slice(0,12),
    signals: signals.length ? signals : ["generic creator prompts — add keywords or run frame analysis for better matches"],
    topic
  };
}
