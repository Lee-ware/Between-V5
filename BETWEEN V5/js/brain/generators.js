// ===================== BRAIN GENERATORS =====================
// Deterministic procedural generators. A seed produces the same challenge,
// which makes Daily Brain, debugging and adversarial QA reproducible.

const BrainGenerators = (() => {
  const SYMBOLS = ['★','●','▲','■','◆','✦','✚','✿'];
  const PAIRS = [['●','○'],['▲','△'],['■','□'],['◆','◇'],['★','☆'],['✦','✧']];
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
  const WORDS = [
    {text:'APPLE', side:0, tags:['food','vowel','short','thing']},
    {text:'BANANA', side:0, tags:['food','vowel','long','thing']},
    {text:'ORANGE', side:0, tags:['food','vowel','long','thing']},
    {text:'CAR', side:1, tags:['transport','consonant','short','thing','move']},
    {text:'BUS', side:1, tags:['transport','consonant','short','thing','move']},
    {text:'TRAIN', side:1, tags:['transport','consonant','long','thing','move']},
    {text:'DOG', side:0, tags:['animal','consonant','short','living','move']},
    {text:'ZEBRA', side:0, tags:['animal','consonant','long','living','move']},
    {text:'EAGLE', side:0, tags:['animal','vowel','long','living','move']},
    {text:'CHAIR', side:1, tags:['object','consonant','long','thing']},
    {text:'TABLE', side:1, tags:['object','consonant','long','thing']},
    {text:'BOOK', side:1, tags:['object','consonant','short','thing']},
  ];

  const int = (rnd, min, max) => min + Math.floor(rnd() * (max - min + 1));
  const pick = (rnd, arr) => arr[int(rnd, 0, arr.length - 1)];
  const shuffle = (rnd, arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = int(rnd, 0, i); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const unique = (rnd, arr, n) => shuffle(rnd, [...new Set(arr)]).slice(0, n);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function chooseNumberChoices(rnd, answer, min = 0, max = 20) {
    const vals = new Set([answer]);
    const deltas = shuffle(rnd, [1,-1,2,-2,3,-3,4,-4,5,-5]);
    for (const d of deltas) if (vals.size < 4 && answer + d >= min && answer + d <= max) vals.add(answer + d);
    let guard = 0;
    while (vals.size < 4 && guard++ < 100) vals.add(int(rnd, min, max));
    return shuffle(rnd, [...vals]);
  }

  function tokenPool() {
    return [
      ...SYMBOLS,
      ...LETTERS.slice(0, 10),
      ...Array.from({length:10}, (_,i)=>String(i))
    ];
  }

  function generateVisualSearch(level, rnd) {
    const size = clamp(2 + level, 3, 6);
    const total = size * size;
    const target = pick(rnd, SYMBOLS.slice(0, level >= 4 ? 6 : 4));
    const values = Array.from({length: total}, () => pick(rnd, SYMBOLS.filter(s => s !== target).slice(0, 4)));
    const targetIndex = int(rnd, 0, total - 1);
    values[targetIndex] = target;
    let decoyIndex = null;
    if (level >= 5) {
      const pair = PAIRS.find(([a]) => a === target);
      if (pair) {
        decoyIndex = int(rnd, 0, total - 1);
        while (decoyIndex === targetIndex) decoyIndex = int(rnd, 0, total - 1);
        values[decoyIndex] = pair[1];
      }
    }
    return { type:'visual_search', title:'Code Breaker', instructions:`Find ${target}.`, gridSize:size, values, target, answerIndex:targetIndex, decoyIndex, timeLimit:Math.max(1200, level===1?4500:3500-level*350), dimension:'visual' };
  }

  function generateMemoryGrid(level, rnd) {
    const size = clamp(3 + Math.floor((level-1)/2), 3, 5);
    const total = size * size;
    const count = clamp(2 + level, 3, Math.min(8, total - 1));
    const targets = unique(rnd, Array.from({length:total}, (_,i)=>i), count);
    return { type:'memory_grid', title:'Memory Grid', instructions:`Memorize ${count} highlighted cells.`, gridSize:size, targets, displayTime:Math.max(650, 1600 - level*180), timeLimit:Math.max(3000, 6500 - level*500), dimension:'memory' };
  }

  function generateSequence(level, rnd, reverse = false) {
    const len = clamp(3 + level, 4, 8);
    const pool = tokenPool();
    const tokens = unique(rnd, pool, len);
    return { type:reverse?'reverse':'sequence', title:reverse?'Reverse':'Sequence', instructions:reverse?'Reproduce it backwards.':'Reproduce it in the same order.', tokens, length:len, flashTime:Math.max(260, 680 - level*70), timeLimit:Math.max(4000, 8000-level*500), dimension:'memory', reverse };
  }

  function generateRuleSwitch(level, rnd) {
    const rounds = clamp(2 + Math.floor(level/2), 2, 5);
    const symbols = unique(rnd, SYMBOLS, 5);
    const result = [];
    for (let r=0;r<rounds;r++) {
      const cardSymbols = shuffle(rnd, symbols.slice(0,4));
      const cardNumbers = unique(rnd, Array.from({length:9},(_,i)=>i+1), 4);
      const cards = cardSymbols.map((symbol, i) => ({symbol, number:cardNumbers[i]}));
      let rule;
      if (r % 3 === 0) rule = {kind:'symbol', text:`Tap ${symbols[r % symbols.length]}`, targetSymbol:symbols[r % symbols.length]};
      else if (r % 3 === 1) rule = {kind:'largest', text:'Tap the largest number'};
      else rule = {kind:'smallest', text:'Tap the smallest number'};
      let answerIndex = -1;
      if (rule.kind === 'symbol') answerIndex = cards.findIndex(c => c.symbol === rule.targetSymbol);
      if (rule.kind === 'largest') answerIndex = cards.reduce((best,c,i)=>c.number>cards[best].number?i:best,0);
      if (rule.kind === 'smallest') answerIndex = cards.reduce((best,c,i)=>c.number<cards[best].number?i:best,0);
      // Ensure a target-symbol rule has one exact card.
      if (answerIndex < 0) { cards[0].symbol = rule.targetSymbol; answerIndex = 0; }
      result.push({cards, rule, answerIndex});
    }
    return { type:'rule_switch', title:'Rule Switch', instructions:'The rule changes. Keep up.', rounds:result, perRoundLimit:Math.max(2400, 4200-level*350), dimension:'switching' };
  }

  function generateGoNoGo(level, rnd) {
    const count = 8 + level*2;
    const go = pick(rnd, SYMBOLS.slice(0,4));
    const noGo = unique(rnd, SYMBOLS.filter(s=>s!==go), 3);
    const sequence = [];
    for (let i=0;i<count;i++) sequence.push(rnd() < 0.45 ? go : pick(rnd,noGo));
    if (!sequence.includes(go)) sequence[int(rnd,0,count-1)] = go;
    return { type:'go_no_go', title:"Don't Tap", instructions:`Tap ${go}. Never tap the others.`, go, noGo, sequence, itemMs:Math.max(500, 950-level*90), timeLimit:Math.max(5000, count*Math.max(500,950-level*90)), dimension:'accuracy' };
  }

  function generateOddOne(level, rnd) {
    const size = level <= 2 ? 2 : level <= 3 ? 3 : 4;
    const pair = pick(rnd, PAIRS);
    const base = pair[0], odd = pair[1];
    const total = size*size;
    const oddIndex = int(rnd,0,total-1);
    const values = Array.from({length:total},()=>base); values[oddIndex]=odd;
    return { type:'odd_one', title:'Odd One', instructions:'Find the one that does not match.', gridSize:size, values, oddIndex, timeLimit:Math.max(1800, 4000-level*350), dimension:'visual' };
  }

  function generateChangeDetection(level, rnd, fixedSize = null, fixedReveal = null) {
    const size = fixedSize || clamp(3 + Math.floor((level-1)/2), 3, 5);
    const total = size*size;
    const palette = unique(rnd,SYMBOLS,4);
    const first = Array.from({length:total},()=>pick(rnd,palette));
    const changed = int(rnd,0,total-1);
    const second = first.slice();
    const replacement = pick(rnd,palette.filter(x=>x!==first[changed]));
    second[changed]=replacement;
    return { type:'change_detection', title:'Change Detective', instructions:'Remember the first grid. Find the changed tile.', gridSize:size, first, second, changedIndex:changed, revealTime:fixedReveal ?? Math.max(650, 1700-level*180), timeLimit:Math.max(2500, 5000-level*350), dimension:'memory' };
  }

  function generateFlashRecall(level, rnd) {
    const len = clamp(level+3,4,8);
    const tokens = unique(rnd, tokenPool(), len);
    const mode = pick(rnd,['index','before','present']);
    let question, answer, choices = [];
    if (mode === 'index') {
      const index=int(rnd,0,len-1); answer=tokens[index]; question=`What was item ${index+1}?`;
      choices = shuffle(rnd, [answer, ...unique(rnd,tokens.filter(x=>x!==answer),3)]);
    } else if (mode === 'before') {
      const index=int(rnd,1,len-1); const anchor=tokens[index]; answer=tokens[index-1]; question=`What came immediately before ${anchor}?`;
      choices = shuffle(rnd,[answer,...unique(rnd,tokens.filter(x=>x!==answer),3)]);
    } else {
      const absent = pick(rnd, tokenPool().filter(x=>!tokens.includes(x))); answer = absent; question=`Which one was NOT shown?`;
      choices = shuffle(rnd,[absent,...unique(rnd,tokens,3)]);
    }
    return {type:'flash_recall',title:'Flash Recall',instructions:'One quick look. Then answer.',tokens,question,answer,choices,displayTime:Math.max(500,1400-level*140),timeLimit:Math.max(2500,5000-level*250),dimension:'memory'};
  }

  function generateSpatial(level, rnd) {
    const size = clamp(3 + Math.floor((level-1)/2),3,5);
    const total=size*size;
    const positions=unique(rnd,Array.from({length:total},(_,i)=>i),Math.min(3+Math.floor(level/2),6));
    const objects=unique(rnd,SYMBOLS,positions.length).map((symbol,i)=>({symbol,index:positions[i]}));
    const target=pick(rnd,objects);
    return {type:'spatial',title:'Where Was It?',instructions:`Remember where ${target.symbol} is.`,gridSize:size,objects,targetSymbol:target.symbol,targetIndex:target.index,displayTime:Math.max(700,1600-level*170),timeLimit:Math.max(2500,5000-level*300),dimension:'memory'};
  }

  function makePath(level, rnd) {
    const size=clamp(3+Math.floor((level-1)/2),3,6);
    const length=clamp(3+level,4,8);
    const dirs=[[-1,0],[1,0],[0,-1],[0,1]];
    function search(path){
      if(path.length>=length) return path.slice();
      const current=path[path.length-1];
      const row=Math.floor(current/size), col=current%size;
      const options=shuffle(rnd, dirs.map(([dr,dc])=>[row+dr,col+dc])
        .filter(([r,c])=>r>=0&&r<size&&c>=0&&c<size)
        .map(([r,c])=>r*size+c)
        .filter(i=>!path.includes(i)));
      for(const next of options){
        const result=search([...path,next]);
        if(result) return result;
      }
      return null;
    }
    const starts=shuffle(rnd, Array.from({length:size*size},(_,i)=>i));
    let path=null;
    for(const start of starts){
      path=search([start]);
      if(path) break;
    }
    if(!path) throw new Error(`Unable to generate path at level ${level}`);
    return {type:'path',title:'Path',instructions:`Remember the path — ${length} steps.`,gridSize:size,path,displayTime:Math.max(650,1400-level*130),timeLimit:Math.max(4000,7000-level*350),dimension:'memory'};
  }

  function generateClassification(level, rnd, rapid=false) {
    const rule=pick(rnd,[
      {id:'food_transport',text:'LEFT = food · RIGHT = transport', left:w=>w.tags.includes('food'), right:w=>w.tags.includes('transport')},
      {id:'eat_drive',text:'LEFT = things you can eat · RIGHT = things you can drive', left:w=>w.tags.includes('food'), right:w=>w.tags.includes('transport')},
      {id:'vowel_consonant',text:'LEFT = starts with a vowel · RIGHT = starts with a consonant', left:w=>w.tags.includes('vowel'), right:w=>w.tags.includes('consonant')},
      {id:'animal_object',text:'LEFT = animal · RIGHT = object/thing', left:w=>w.tags.includes('animal'), right:w=>w.tags.includes('object') || w.tags.includes('thing')},
    ]);
    const left=WORDS.filter(rule.left), right=WORDS.filter(rule.right);
    if(!left.length || !right.length) throw new Error(`Classification rule has no two-sided vocabulary: ${rule.id}`);
    const take=Math.max(2,Math.floor((rapid?10:8)/2));
    const candidates=[...shuffle(rnd,left).slice(0,take), ...shuffle(rnd,right).slice(0,take)];
    const items=shuffle(rnd,candidates).map(w=>({text:w.text,side:rule.left(w)?0:1}));
    return {type:rapid?'rapid_sort':'classification',title:rapid?'Rapid Sort':'Sort It',instructions:rule.text,items,perItemLimit:Math.max(500, (rapid ? 1600 : 3000) - level*120),dimension:'switching'};
  }

  function generateNumberTrap(level, rnd) {
    const nums=unique(rnd,Array.from({length:15},(_,i)=>i+1),4);
    const task=pick(rnd,['largest','smallest','closest','furthest','second']);
    let answerIndex;
    if(task==='largest') answerIndex=nums.indexOf(Math.max(...nums));
    if(task==='smallest') answerIndex=nums.indexOf(Math.min(...nums));
    const pivot=5;
    if(task==='closest') answerIndex=nums.reduce((best,n,i)=>Math.abs(n-pivot)<Math.abs(nums[best]-pivot)?i:best,0);
    if(task==='furthest') answerIndex=nums.reduce((best,n,i)=>Math.abs(n-pivot)>Math.abs(nums[best]-pivot)?i:best,0);
    if(task==='second') answerIndex=1;
    const text={largest:'Tap the largest number.',smallest:'Tap the smallest number.',closest:'Tap the number closest to 5.',furthest:'Tap the number furthest from 5.',second:'Tap the number that appeared second.'}[task];
    return {type:'number_trap',title:'Number Trap',instructions:text,numbers:nums,answerIndex,timeLimit:Math.max(1800,3600-level*300),dimension:'switching'};
  }

  function generateSymbolMapping(level, rnd) {
    const symbols=unique(rnd,SYMBOLS,4);
    const makePart=(label)=>{ const mapping=Object.fromEntries(symbols.map(s=>[s,int(rnd,1,9)])); const len=clamp(2+level,4,7); const sequence=Array.from({length:len},()=>pick(rnd,symbols)); const answer=sequence.reduce((sum,s)=>sum+mapping[s],0); return {label,mapping,sequence,answer}; };
    const parts=[makePart('Current code')];
    if(level>=4 && rnd()<0.75) parts.push(makePart('CODE UPDATED — forget the old mapping'));
    return {type:'symbol_mapping',title:'BETWEEN Code',instructions:'Translate the symbols, then total them.',symbols,parts,timeLimit:Math.max(4500,8000-level*450),dimension:'switching'};
  }

  function transformGrid(base,size,kind) {
    const out=Array(size*size);
    const at=(r,c)=>base[r*size+c];
    for(let r=0;r<size;r++) for(let c=0;c<size;c++) {
      let rr=r,cc=c;
      if(kind==='h') cc=size-1-c;
      if(kind==='v') rr=size-1-r;
      if(kind==='r180'){ rr=size-1-r; cc=size-1-c; }
      if(kind==='r90'){ rr=size-1-c; cc=r; }
      out[r*size+c]=at(rr,cc);
    }
    return out;
  }

  function generateMirror(level, rnd) {
    const size=level>=4?3:2;
    const base=unique(rnd,SYMBOLS,size*size);
    const correctKind='h';
    const kinds=shuffle(rnd,['h','v','r180','r90']).slice(0,4);
    if(!kinds.includes(correctKind)) kinds[0]=correctKind;
    const choices=kinds.map(k=>transformGrid(base,size,k));
    const correctIndex=kinds.indexOf(correctKind);
    return {type:'mirror',title:'Mirror',instructions:'Select the horizontal mirror image.',gridSize:size,base,choices,correctIndex,timeLimit:Math.max(2500,5000-level*320),dimension:'visual'};
  }

  function generatePattern(level, rnd) {
    const kind=pick(rnd, level>=4?['arithmetic','doubling','alternating','second_difference']:['arithmetic','doubling','alternating']);
    const len=clamp(4+level-1,4,7);
    let seq=[], answer;
    if(kind==='arithmetic') { const start=int(rnd,1,9), step=int(rnd,1,5); seq=Array.from({length:len},(_,i)=>start+i*step); answer=start+len*step; }
    if(kind==='doubling') { const start=int(rnd,1,4); seq=Array.from({length:len},(_,i)=>start*Math.pow(2,i)); answer=start*Math.pow(2,len); }
    if(kind==='alternating') { const a=int(rnd,1,9), b=int(rnd,10,18); seq=Array.from({length:len},(_,i)=>i%2?a:b); answer=len%2?b:a; }
    if(kind==='second_difference') { const start=int(rnd,1,3), d=int(rnd,1,3); seq=[start]; for(let i=1;i<len;i++) seq.push(seq[i-1]+i*d); answer=seq[len-1]+len*d; }
    const choices=chooseNumberChoices(rnd,answer,0,Math.max(answer+8,20));
    return {type:'pattern',title:'The Next Thing',instructions:'What comes next?',sequence:seq,answer,choices,timeLimit:Math.max(2500,5000-level*330),dimension:'visual'};
  }

  function generateMemoryDistraction(level, rnd) {
    const len=clamp(4+level-1,4,7); const tokens=unique(rnd,tokenPool(),len);
    const index=int(rnd,0,len-1); const questionType=pick(rnd,['index','before','absent']); let question,answer,choices;
    if(questionType==='index'){ question=`Which item was ${index+1}th?`; answer=tokens[index]; }
    else if(questionType==='before'){ const i=Math.max(1,index); question=`What came immediately before ${tokens[i]}?`; answer=tokens[i-1]; }
    else { answer=pick(rnd,tokenPool().filter(t=>!tokens.includes(t))); question='Which symbol was NOT shown?'; }
    choices=shuffle(rnd,[answer,...unique(rnd,tokenPool().filter(t=>t!==answer),3)]);
    return {type:'memory_distraction',title:'Memory + Distraction',instructions:'Remember the sequence, then answer the question.',tokens,question,answer,choices,displayTime:Math.max(650,1300-level*110),timeLimit:Math.max(3000,6000-level*350),dimension:'memory'};
  }

  function generateOneSecond(level, rnd) {
    const length=clamp(2+level,3,8); const target=pick(rnd,SYMBOLS.slice(0,4));
    const values=Array.from({length},()=>pick(rnd,SYMBOLS.slice(0,5)));
    if(!values.includes(target)) values[int(rnd,0,length-1)]=target;
    const answer=values.filter(v=>v===target).length;
    return {type:'one_second',title:'One Second',instructions:`How many ${target}?`,values,target,answer,displayTime:Math.max(500,1500-(level-1)*250),timeLimit:3000,dimension:'visual'};
  }

  function generate(type, level, rnd) {
    switch(type){
      case 'visual_search': return generateVisualSearch(level,rnd);
      case 'memory_grid': return generateMemoryGrid(level,rnd);
      case 'sequence': return generateSequence(level,rnd,false);
      case 'reverse': return generateSequence(level,rnd,true);
      case 'rule_switch': return generateRuleSwitch(level,rnd);
      case 'go_no_go': return generateGoNoGo(level,rnd);
      case 'odd_one': return generateOddOne(level,rnd);
      case 'change_detection': return generateChangeDetection(level,rnd);
      case 'flash_recall': return generateFlashRecall(level,rnd);
      case 'spatial': return generateSpatial(level,rnd);
      case 'path': return makePath(level,rnd);
      case 'classification': return generateClassification(level,rnd,false);
      case 'number_trap': return generateNumberTrap(level,rnd);
      case 'symbol_mapping': return generateSymbolMapping(level,rnd);
      case 'mirror': return generateMirror(level,rnd);
      case 'pattern': return generatePattern(level,rnd);
      case 'rapid_sort': return generateClassification(level,rnd,true);
      case 'memory_distraction': return generateMemoryDistraction(level,rnd);
      case 'one_second': return generateOneSecond(level,rnd);
      case 'final_change': return generateChangeDetection(5,rnd,5,520);
      default: throw new Error(`Unsupported Brain generator: ${type}`);
    }
  }

  return { generate, SYMBOLS };
})();
