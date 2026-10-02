// ===================== BRAIN CONFIG =====================
// Player-facing Brain experiences are intentionally separate from the
// generated round mechanics. The source defines 20 experiences; the engines
// below generate valid variations for each.

const BrainConfig = Object.freeze({
  sourceVersion: 1,
  experiences: Object.freeze([
    { id:'v5-brain-001', slug:'code-breaker', title:'Code Breaker', type:'visual_search', prompt:'Find the target as quickly as you can.', engine:'VisualSearchEngine', category:'Visual search' },
    { id:'v5-brain-002', slug:'memory-grid', title:'Memory Grid', type:'memory_grid', prompt:'Remember which cells light up, then rebuild the exact set.', engine:'MemoryGridEngine', category:'Memory' },
    { id:'v5-brain-003', slug:'sequence', title:'Sequence', type:'sequence', prompt:'Watch the sequence once. Reproduce it exactly.', engine:'SequenceEngine', category:'Memory' },
    { id:'v5-brain-004', slug:'reverse', title:'Reverse', type:'reverse', prompt:'Remember the sequence, then reproduce it backwards.', engine:'SequenceEngine', category:'Memory' },
    { id:'v5-brain-005', slug:'rule-switch', title:'Rule Switch', type:'rule_switch', prompt:'Learn the rule. Then deal with the fact that it changes.', engine:'RuleSwitchEngine', category:'Switching' },
    { id:'v5-brain-006', slug:"don't-tap", title:"Don't Tap", type:'go_no_go', prompt:'Tap the right thing. Ignore the trap.', engine:'GoNoGoEngine', category:'Inhibition' },
    { id:'v5-brain-007', slug:'odd-one', title:'Odd One', type:'odd_one', prompt:'Three follow the rule. One doesn\'t. Find it.', engine:'OddOneEngine', category:'Visual discrimination' },
    { id:'v5-brain-008', slug:'change-detective', title:'Change Detective', type:'change_detection', prompt:'Look carefully. One thing changes.', engine:'ChangeDetectionEngine', category:'Change detection' },
    { id:'v5-brain-009', slug:'flash-recall', title:'Flash Recall', type:'flash_recall', prompt:'You get one quick look. That\'s it.', engine:'SequenceEngine', category:'Memory' },
    { id:'v5-brain-010', slug:'where-was-it', title:'Where Was It?', type:'spatial', prompt:'Remember where it was.', engine:'SpatialEngine', category:'Spatial memory' },
    { id:'v5-brain-011', slug:'path', title:'Path', type:'path', prompt:'Watch the route. Then recreate it.', engine:'SpatialEngine', category:'Spatial memory' },
    { id:'v5-brain-012', slug:'sort-it', title:'Sort It', type:'classification', prompt:'Follow the current rule. The current rule matters.', engine:'ClassificationEngine', category:'Classification' },
    { id:'v5-brain-013', slug:'number-trap', title:'Number Trap', type:'number_trap', prompt:'The buttons look familiar. The task keeps changing.', engine:'ClassificationEngine', category:'Flexible rules' },
    { id:'v5-brain-014', slug:'between-code', title:'BETWEEN Code', type:'symbol_mapping', prompt:'The symbols have a code. Keep it in your head.', engine:'SymbolMappingEngine', category:'Symbol mapping' },
    { id:'v5-brain-015', slug:'mirror', title:'Mirror', type:'mirror', prompt:'Which arrangement is the mirror image?', engine:'VisualSearchEngine', category:'Visual transformation' },
    { id:'v5-brain-016', slug:'the-next-thing', title:'The Next Thing', type:'pattern', prompt:'Find the rule that actually continues the pattern.', engine:'PatternEngine', category:'Pattern' },
    { id:'v5-brain-017', slug:'rapid-sort', title:'Rapid Sort', type:'rapid_sort', prompt:'Same basic job. Much less time.', engine:'ClassificationEngine', category:'Speed + switching' },
    { id:'v5-brain-018', slug:'memory-distraction', title:'Memory + Distraction', type:'memory_distraction', prompt:'Remember it while something else tries to take your attention.', engine:'CompositeEngine', category:'Memory + distraction' },
    { id:'v5-brain-019', slug:'one-second', title:'One Second', type:'one_second', prompt:'You only get a moment. Count what you saw.', engine:'VisualSearchEngine', category:'Rapid visual' },
    { id:'v5-brain-020', slug:'final-boss', title:'FINAL BOSS: BETWEEN', type:'final_boss', prompt:'Everything you just learned. Good luck.', engine:'CompositeEngine', category:'Mixed challenge' },
  ]),
  engineTypes: Object.freeze([
    'visual_search','memory_grid','sequence','reverse','rule_switch','go_no_go',
    'odd_one','change_detection','flash_recall','spatial','path','classification',
    'number_trap','symbol_mapping','mirror','pattern','rapid_sort','memory_distraction','one_second'
  ]),
  difficulty: Object.freeze({
    1: Object.freeze({ name:'Warm-up', memory:3, speed:1500, distraction:0, visual:3, sequence:4, combo:1 }),
    2: Object.freeze({ name:'Getting serious', memory:4, speed:1200, distraction:1, visual:4, sequence:5, combo:1 }),
    3: Object.freeze({ name:'Focused', memory:5, speed:900, distraction:1, visual:5, sequence:6, combo:2 }),
    4: Object.freeze({ name:'Pressure', memory:6, speed:700, distraction:2, visual:6, sequence:7, combo:2 }),
    5: Object.freeze({ name:'Unnecessarily hard', memory:7, speed:500, distraction:3, visual:6, sequence:8, combo:3 }),
  }),
  // Familiarity is earned across completed normal Brain sessions. The first
  // ten are intentionally untimed learning sessions; timed play begins on
  // session 11, then complexity unlocks gradually instead of jumping within
  // a single session. Daily Brain keeps its deterministic difficulty policy.
  progression: Object.freeze({
    learningRuns: 10,
    level2StartRun: 21,
    level3StartRun: 31,
    level4StartRun: 40,
    level5StartRun: 50,
  }),
  memoryTypes: Object.freeze(new Set(['memory_grid','sequence','reverse','flash_recall','spatial','path','memory_distraction'])),
  switchingTypes: Object.freeze(new Set(['rule_switch','classification','number_trap','symbol_mapping','rapid_sort'])),
});
