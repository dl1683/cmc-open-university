// Chain of Draft: concise, high-signal reasoning traces as a token-budget
// control surface for LLM systems.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'chain-of-draft-reasoning-token-budget-case-study',
  title: 'Chain of Draft Reasoning Token Budget Case Study',
  category: 'Papers',
  summary: 'A concise-reasoning case study: replace verbose chain-of-thought traces with compact draft notes, measure token savings, and route hard cases to verifiers or tools.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['draft trace', 'production budget'], defaultValue: 'draft trace' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function draftGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.7, y: 3.8, note: 'task' },
      { id: 'constraint', label: 'rule', x: 2.6, y: 3.8, note: 'few words' },
      { id: 'notes', label: 'notes', x: 4.5, y: 2.4, note: 'dense' },
      { id: 'state', label: 'state', x: 4.5, y: 5.2, note: 'facts' },
      { id: 'answer', label: 'answer', x: 6.7, y: 3.8, note: 'final' },
      { id: 'metric', label: 'metrics', x: 8.6, y: 3.8, note: 'cost/lat' },
    ],
    edges: [
      { id: 'e-prompt-constraint', from: 'prompt', to: 'constraint' },
      { id: 'e-constraint-notes', from: 'constraint', to: 'notes' },
      { id: 'e-constraint-state', from: 'constraint', to: 'state' },
      { id: 'e-notes-answer', from: 'notes', to: 'answer' },
      { id: 'e-state-answer', from: 'state', to: 'answer' },
      { id: 'e-answer-metric', from: 'answer', to: 'metric' },
    ],
  }, { title });
}

function routeGraph(title) {
  return graphState({
    nodes: [
      { id: 'request', label: 'request', x: 0.7, y: 3.8, note: 'task' },
      { id: 'policy', label: 'policy', x: 2.3, y: 3.8, note: 'route' },
      { id: 'direct', label: 'direct', x: 4.2, y: 1.6, note: 'easy' },
      { id: 'cod', label: 'CoD', x: 4.2, y: 3.2, note: 'compact' },
      { id: 'cot', label: 'CoT', x: 4.2, y: 4.8, note: 'verbose' },
      { id: 'tool', label: 'tool', x: 4.2, y: 6.4, note: 'exact' },
      { id: 'verify', label: 'verify', x: 6.5, y: 3.8, note: 'score' },
      { id: 'ship', label: 'ship', x: 8.4, y: 3.8, note: 'answer' },
    ],
    edges: [
      { id: 'e-request-policy', from: 'request', to: 'policy' },
      { id: 'e-policy-direct', from: 'policy', to: 'direct' },
      { id: 'e-policy-cod', from: 'policy', to: 'cod' },
      { id: 'e-policy-cot', from: 'policy', to: 'cot' },
      { id: 'e-policy-tool', from: 'policy', to: 'tool' },
      { id: 'e-direct-verify', from: 'direct', to: 'verify' },
      { id: 'e-cod-verify', from: 'cod', to: 'verify' },
      { id: 'e-cot-verify', from: 'cot', to: 'verify' },
      { id: 'e-tool-verify', from: 'tool', to: 'verify' },
      { id: 'e-verify-ship', from: 'verify', to: 'ship' },
    ],
  }, { title });
}

function* draftTrace() {
  yield {
    state: draftGraph('Chain of Draft makes reasoning terse on purpose'),
    highlight: { active: ['prompt', 'constraint', 'notes', 'answer', 'e-prompt-constraint', 'e-constraint-notes', 'e-notes-answer'], compare: ['state'], found: ['metric'] },
    explanation: 'Chain of Draft asks the model to keep only compact, high-signal intermediate notes. The trace still exposes a route through the problem, but it avoids spending output tokens on explanatory prose that does not advance the solution.',
    invariant: 'Draft notes are an efficiency artifact, not a full explanation contract.',
  };

  yield {
    state: labelMatrix(
      'Verbose CoT versus draft trace',
      [
        { id: 'given', label: 'given' },
        { id: 'op', label: 'op' },
        { id: 'state', label: 'state' },
        { id: 'final', label: 'final' },
      ],
      [
        { id: 'cot', label: 'CoT' },
        { id: 'cod', label: 'CoD' },
      ],
      [
        ['20', '20->12'],
        ['sub', '20-12'],
        ['gave 8', '=8'],
        ['D=8', 'ans 8'],
      ],
    ),
    highlight: { active: ['given:cod', 'op:cod', 'state:cod', 'final:cod'], compare: ['given:cot', 'op:cot'] },
    explanation: 'The data structure is a compact trace: facts, operation, updated state, and final answer. It can be parsed, counted, routed, and audited more easily than a paragraph-length chain, while still preserving the key problem state.',
  };

  yield {
    state: labelMatrix(
      'Draft record schema',
      [
        { id: 'task', label: 'task' },
        { id: 'facts', label: 'facts' },
        { id: 'ops', label: 'ops' },
        { id: 'checks', label: 'check' },
        { id: 'ans', label: 'ans' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['id', 'route'],
        ['nums', 'state'],
        ['ops', 'logic'],
        ['unit', 'guard'],
        ['final', 'grade'],
      ],
    ),
    highlight: { active: ['facts:stores', 'ops:stores', 'checks:stores'], found: ['ans:why'] },
    explanation: 'Treat a draft trace like a small state machine log. The useful fields are the task type, extracted facts, operations, lightweight checks, and final answer. If those fields are missing, the trace may be short but not useful.',
  };

  yield {
    state: labelMatrix(
      'Token and latency ledger',
      [
        { id: 'std', label: 'standard' },
        { id: 'cot', label: 'CoT' },
        { id: 'cod', label: 'CoD' },
      ],
      [
        { id: 'tokens', label: 'tokens' },
        { id: 'latency', label: 'lat' },
        { id: 'quality', label: 'quality' },
      ],
      [
        ['low', 'fast', 'weak'],
        ['high', 'slow', 'strong'],
        ['low', 'fast+', 'near'],
      ],
    ),
    highlight: { active: ['cod:tokens', 'cod:latency'], compare: ['cot:tokens', 'cot:latency'], found: ['cod:quality'] },
    explanation: 'The original paper reports that Chain of Draft can keep accuracy near Chain of Thought while using far fewer output tokens on several reasoning tasks. The production question is not just accuracy; it is cost and latency per accepted answer.',
  };

  yield {
    state: draftGraph('Draft first, expand only when needed'),
    highlight: { active: ['notes', 'state', 'answer', 'metric'], compare: ['constraint'], found: ['e-answer-metric'] },
    explanation: 'A good system can use the draft as the first reasoning tier. If the answer is low risk and checks pass, ship it. If confidence is low or stakes are high, ask for a fuller trace, call a tool, or run a verifier.',
  };

  yield {
    state: labelMatrix(
      'Where draft traces fit',
      [
        { id: 'arith', label: 'arith' },
        { id: 'date', label: 'dates' },
        { id: 'code', label: 'code' },
        { id: 'legal', label: 'legal' },
        { id: 'creative', label: 'creative' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['good', 'units'],
        ['good', 'cal'],
        ['mixed', 'ctx'],
        ['risky', 'cite'],
        ['weak', 'style'],
      ],
    ),
    highlight: { active: ['arith:fit', 'date:fit'], compare: ['code:fit'], removed: ['legal:fit', 'creative:fit'] },
    explanation: 'Chain of Draft is strongest when the useful state is compact: arithmetic, date reasoning, symbolic transformations, and simple logic. It is weaker when correctness depends on broad context, evidence citation, style, or codebase-specific constraints.',
  };
}

function* productionBudget() {
  yield {
    state: routeGraph('Reasoning strategy should be routed, not hard-coded'),
    highlight: { active: ['request', 'policy', 'direct', 'cod', 'cot', 'tool', 'e-request-policy', 'e-policy-cod'], found: ['verify', 'ship'] },
    explanation: 'A production router should decide whether the task gets a direct answer, Chain of Draft, full Chain of Thought, a tool call, or human escalation. CoD is one tier in the control plane, not a universal replacement.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'task difficulty', min: 0, max: 10.8 }, y: { label: 'output tokens', min: 0, max: 420 } },
      series: [
        { id: 'cot', label: 'CoT', points: [
          { x: 1, y: 40 }, { x: 3, y: 95 }, { x: 5, y: 180 }, { x: 7, y: 280 }, { x: 10, y: 390 },
        ] },
        { id: 'cod', label: 'CoD', points: [
          { x: 1, y: 18 }, { x: 3, y: 35 }, { x: 5, y: 65 }, { x: 7, y: 115 }, { x: 10, y: 210 },
        ] },
      ],
      markers: [
        { id: 'cap', x: 7, y: 115, label: 'cap' },
      ],
    }),
    highlight: { active: ['cod', 'cap'], compare: ['cot'] },
    explanation: 'The economic shape is simple: verbose traces grow quickly with difficulty. A draft trace grows more slowly until the task requires details that cannot be safely compressed. That knee is what the router should learn.',
  };

  yield {
    state: labelMatrix(
      'Prompt contract',
      [
        { id: 'brief', label: 'brief' },
        { id: 'state', label: 'state' },
        { id: 'answer', label: 'ans' },
        { id: 'escalate', label: 'esc' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['short', 'terse'],
        ['facts', 'lost'],
        ['final', 'parse'],
        ['tool', 'conf'],
      ],
    ),
    highlight: { active: ['brief:rule', 'state:rule', 'answer:rule'], compare: ['escalate:failure'] },
    explanation: 'The prompt needs a contract: keep draft steps short, preserve essential state, separate the final answer, and escalate when the state cannot be safely compressed. A word cap alone is not enough.',
  };

  yield {
    state: routeGraph('Verifier closes the loop'),
    highlight: { active: ['cod', 'verify', 'e-cod-verify'], found: ['ship'], compare: ['cot', 'tool'] },
    explanation: 'Draft traces need a checker. The checker can be answer normalization, a unit test, a calculator, a citation support verifier, a reward model, or a human. Without a checker, shorter reasoning can hide mistakes instead of reducing cost.',
    invariant: 'Shorter traces must be measured by accepted-answer quality, not by token savings alone.',
  };

  yield {
    state: labelMatrix(
      'SWE caveat',
      [
        { id: 'math', label: 'math' },
        { id: 'swe', label: 'SWE' },
        { id: 'prod', label: 'prod' },
      ],
      [
        { id: 'saving', label: 'saving' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['high', 'compact'],
        ['mod', 'repo'],
        ['slice', 'risk'],
      ],
    ),
    highlight: { active: ['math:saving', 'swe:saving'], compare: ['swe:reason'], found: ['prod:saving'] },
    explanation: 'A later software-engineering study found useful token reductions, but not the extreme compression reported for arithmetic-style tasks. Code tasks need repo context, compatibility reasoning, and validation detail, so the draft budget must be domain-specific.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'self', label: 'self' },
        { id: 'prm', label: 'PRM' },
        { id: 'cost', label: 'cost' },
        { id: 'eval', label: 'eval' },
        { id: 'tools', label: 'tools' },
      ],
      [
        { id: 'link', label: 'link' },
        { id: 'contrast', label: 'contrast' },
      ],
      [
        ['vote', 'draft'],
        ['verify', 'steps'],
        ['tokens', 'quality'],
        ['slices', 'claims'],
        ['exact', 'text'],
      ],
    ),
    highlight: { active: ['self:link', 'prm:link', 'cost:link', 'eval:link'], found: ['tools:contrast'] },
    explanation: 'CoD belongs between reasoning methods and serving economics. It saves tokens only if quality survives evaluation. When a tool or verifier exists, the draft should route into that checker instead of becoming decorative hidden work.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'draft trace') yield* draftTrace();
  else if (view === 'production budget') yield* productionBudget();
  else throw new InputError('Pick a Chain of Draft view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Draft trace" shows a single request flowing through the Chain of Draft pipeline: prompt, brevity constraint, compact notes, extracted state, final answer, and cost metrics. "Production budget" shows a routing control plane deciding which reasoning tier to use per request, with a verifier gating every answer before it ships.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current decision point: which field is being written, which route is being selected, or which verifier check is running.',
            'Compare nodes show the alternative that this step is measured against -- usually Chain of Thought or direct answering.',
            'Found nodes are confirmed outcomes: a shipped answer, a verified metric, or a route that cleared the quality gate.',
          ],
        },
        'In the matrix views, rows are fields of the draft record or task types, and columns are properties (what is stored, why, fit level, or failure mode). Watch the "quality" column: token savings only count when quality survives.',
        {
          type: 'note',
          text: 'The animation uses small integer arithmetic for readability. Real CoD deployments handle multi-step math, date calculations, symbolic transforms, and structured extraction. The data structure is the same -- a compact state record -- but the fields and verifiers change per domain.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'While CoT significantly improves LLM performance on reasoning tasks, it comes with the cost of generating substantially more output tokens.',
          attribution: 'Xu et al., "Chain of Draft: Thinking Faster by Writing Less" (2025), Section 1',
        },
        'Chain of Thought asks a language model to show its work. The intermediate steps help the model arrive at a correct answer on tasks like arithmetic, date reasoning, and symbolic logic. The cost is output tokens: a CoT trace for a simple subtraction problem can run 50-200 tokens of prose explaining each step, even though the decision state is three numbers and one operation.',
        'Output tokens are the expensive dimension. They drive inference latency (autoregressive generation is sequential), API cost (output tokens typically cost 3-4x input tokens), memory pressure (KV cache grows with sequence length), and downstream parsing complexity. A system that generates 10x the reasoning it needs is paying 10x the cost for the same answer.',
        {
          type: 'table',
          headers: ['Cost dimension', 'How CoT inflates it', 'Scale of the problem'],
          rows: [
            ['Latency', 'Sequential token generation', '200 tokens at 50 tok/s = 4s; 20 tokens = 0.4s'],
            ['API spend', 'Output tokens billed per-token', 'At $15/M output tokens, 10M requests * 180 wasted tokens = $27K'],
            ['KV cache', 'Longer sequences hold more memory', 'Batch size drops as sequence length grows'],
            ['Parsing', 'Free-form prose needs extraction', 'Regex/LLM parsing adds latency and failure modes'],
          ],
        },
        'Chain of Draft is a prompting strategy that replaces verbose intermediate reasoning with compact draft notes -- just enough state to solve the problem, written in minimal tokens. The model still reasons step by step, but each step is a few words or symbols instead of a full sentence.',
        {type:'callout', text:'Chain of Draft is safe only when compression removes narration while preserving every load-bearing piece of decision state.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The two obvious approaches are direct answering and full Chain of Thought.',
        'Direct answering generates only the final result. It is cheap, fast, and easy to parse. It works for tasks where the model has strong pattern-match confidence: simple factual recall, format conversion, straightforward extraction. The problem is that it gives no intermediate state to check. When the model is wrong, there is no trace to debug, no state to route on, and no signal for a verifier.',
        {
          type: 'diagram',
          text: 'Direct answering:\n  Input:  "Jason had 20 lollipops. He gave 12 to Denny. How many does Jason have now?"\n  Output: "8"\n  Tokens: ~1\n  State:  none -- if wrong, no way to see why\n\nChain of Thought:\n  Input:  same\n  Output: "Jason started with 20 lollipops. He gave away 12 lollipops.\n           To find how many he has left, I subtract: 20 - 12 = 8.\n           Therefore, Jason has 8 lollipops now."\n  Tokens: ~40\n  State:  full prose -- correct, but 39 tokens of explanation for one subtraction',
          label: 'Direct answering has no state; CoT has too much',
        },
        'Full CoT scales well for hard tasks -- multi-step proofs, complex code generation, ambiguous planning. But for tasks with compact decision state (a few numbers, a date offset, a symbol transformation), CoT produces dozens of tokens that restate the problem, narrate each step, and summarize the conclusion. That prose does not help the solver; it was generated for a human reader who may not exist.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall for direct answering is invisible failures. Without intermediate state, the system cannot verify steps, route on confidence, or debug mistakes. The wall for CoT is cost at scale: verbose reasoning multiplies latency, spend, and cache pressure across every request, including the majority that do not need a paragraph of explanation.',
        {
          type: 'table',
          headers: ['Approach', 'Strength', 'Wall'],
          rows: [
            ['Direct', 'Minimal tokens, fast', 'No intermediate state; errors are silent; verifiers have nothing to check'],
            ['CoT', 'Exposes reasoning; higher accuracy on hard tasks', 'Output tokens scale with explanation length, not problem complexity; most prose is narration, not decision state'],
            ['CoD', 'Compact state; verifiable; cheap', 'Compression can drop the premise that reveals a mistake; domain-dependent safety'],
          ],
        },
        'The deeper wall is that token count and reasoning quality are not the same axis. A 200-token CoT trace and a 15-token CoD trace can encode the same decision state. The extra 185 tokens in the CoT version are explanation, not computation. But on harder tasks, some of those "extra" tokens carry information the model needs to get the answer right. The question is always: which tokens are load-bearing?',
        {
          type: 'note',
          text: 'The CoD paper (Xu et al., 2025) reports that on GSM8K (grade-school math), CoD matches CoT accuracy while using 7.6% of the output tokens. On sports understanding, CoD uses 92.4% of CoT tokens -- the compression ratio drops sharply when the task needs more context. The wall is domain-shaped, not universal.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Compression is safe when it preserves the decision state. A good draft is short because it stores only the variables that determine the answer -- not because it is vague.',
        {
          type: 'diagram',
          text: 'Decision state for "20 lollipops, gave 12, how many left?":\n\n  Variables:  start=20, gave=12\n  Operation:  subtract\n  Result:     8\n\n  CoT encodes this in ~40 tokens of prose.\n  CoD encodes this in ~5 tokens: "20; -12; =8; ans 8"\n\n  Both traces contain the same three variables and one operation.\n  The CoT trace adds 35 tokens of narration around them.',
          label: 'Same decision state, 8x fewer tokens',
        },
        'The CoD prompt teaches the model to write terse intermediate notes -- like a student solving a math problem in the margin, not in an essay. The key constraint is not "be brief." It is "preserve every fact and operation needed to verify the answer, but skip the prose that explains what you are doing."',
        {
          type: 'code',
          language: 'text',
          text: '# Chain of Draft prompt (adapted from Xu et al., 2025)\n\nThink step by step, but only keep a minimum draft for\neach thinking step, with 5 words at most.\n\nExample:\nQ: Jason had 20 lollipops. He gave Denny some. He has\n   12 now. How many did he give to Denny?\nDraft: 20-12=8\nAnswer: 8\n\nQ: There were 9 computers in the server room. Five more\n   were installed each day, Monday to Thursday. How many\n   are there now?\nDraft: digit extraction not needed;\n       4 days * 5 = 20; 9+20=29\nAnswer: 29',
        },
        'The draft record is a small state machine log. For a well-scoped task, it stores: extracted facts, operations applied, updated state, and final answer. For arithmetic, that is three to five tokens. For date reasoning, it might be day-of-week, offset, calendar rule, and result. For code tasks, it needs more: symptom, file, edit intent, compatibility constraint, verification command.',
        {
          type: 'note',
          text: 'The core insight has a boundary condition: when the task requires provenance (which source said X), policy interpretation (does rule Y apply here), or broad codebase context (will this edit break module Z), the decision state is no longer compact. CoD must grow or the router must escalate to a different reasoning tier.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism has three layers: the prompt contract, the draft trace format, and the routing/verification loop.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Layer 1: Prompt contract\nconst COD_SYSTEM = `Think step by step. Keep each step\nto 5 words or fewer. Write "Answer:" before the final\nresult. If you cannot solve the problem in compact notes,\nwrite "ESCALATE" instead of guessing.`;\n\n// Layer 2: Draft trace parsing\nfunction parseDraft(output) {\n  const lines = output.split("\\n");\n  const answerLine = lines.find(l => l.startsWith("Answer:"));\n  const draftLines = lines.filter(l => !l.startsWith("Answer:"));\n  return {\n    draft: draftLines.join("; "),\n    answer: answerLine?.replace("Answer:", "").trim(),\n    escalated: output.includes("ESCALATE"),\n    tokens: countTokens(output),\n  };\n}\n\n// Layer 3: Route decision\nfunction routeRequest(task, draftResult) {\n  if (draftResult.escalated) return "cot";     // expand reasoning\n  if (draftResult.answer == null) return "cot"; // parse failure\n  if (verifier(task, draftResult)) return "ship";\n  return "cot";  // verification failed, try verbose\n}',
        },
        'The prompt gives few-shot examples of terse notes and a clear answer separator. The examples teach the model the compression pattern: state the facts, apply the operation, write the result. A word cap (typically 5 words per step) enforces brevity, but the real contract is that every load-bearing variable appears in the trace.',
        'A production router selects the reasoning tier before or after generation. The simplest version: try CoD first, run the verifier, ship if the answer passes. If not, retry with full CoT, a tool call, or human escalation. More sophisticated versions classify the task type up front and skip CoD for domains where compression is known to fail.',
        {
          type: 'diagram',
          text: 'Production routing loop:\n\n  request --> classify task type\n                |\n    +-----------+-----------+-----------+\n    |           |           |           |\n  direct      CoD         CoT        tool\n    |           |           |           |\n    +------> verifier <-----+-----------+\n                |\n          pass? --> ship answer\n          fail? --> escalate to next tier',
          label: 'CoD is one tier in a multi-strategy pipeline, not a global replacement',
        },
        'The verifier is not optional. Without it, shorter traces hide errors instead of reducing cost. Verifier types by domain: answer normalization (does "8" match expected format), calculator (does 20-12 actually equal 8), unit tests (does the code patch pass), schema validation (does the extraction match the schema), citation check (does the claimed source support the answer), reward model (does a trained scorer rate the answer above threshold).',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is narrow: if a task has compact decision state, then the verbose tokens in a CoT trace are narration, not computation. Removing narration does not remove reasoning -- it removes the explanation of reasoning. The model still performs the same logical steps internally; it just writes fewer words about each step.',
        {
          type: 'quote',
          text: 'CoD achieves performance comparable to CoT while requiring output tokens as low as only 7.6% of the original.',
          attribution: 'Xu et al., "Chain of Draft: Thinking Faster by Writing Less" (2025), Abstract',
        },
        'The invariant is accepted-answer quality at the target risk level. Token savings count only after the answer passes the same quality gate as the CoT baseline. A draft that fails verification must expand, not ship.',
        {
          type: 'table',
          headers: ['Property', 'How CoD preserves it'],
          rows: [
            ['Step-by-step reasoning', 'Draft notes still decompose the problem into sequential steps'],
            ['Verifiability', 'Final answer is separated; intermediate state is parseable'],
            ['Accuracy', 'On compact-state tasks, accuracy matches CoT (within ~1-2% on benchmarks)'],
            ['Escalation path', 'ESCALATE signal or verifier failure triggers fuller reasoning'],
          ],
        },
        'CoD works because most reasoning tasks have a small kernel of decision-relevant state surrounded by a large shell of explanatory prose. The prompt teaches the model to write the kernel and skip the shell. When the kernel is genuinely small (arithmetic, dates, symbol manipulation), the compression is nearly lossless. When the kernel is large (code, legal reasoning, multi-document synthesis), CoD degrades and the system must route elsewhere.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Benchmark', 'CoT tokens', 'CoD tokens', 'CoD / CoT ratio', 'Accuracy delta'],
          rows: [
            ['GSM8K (math)', '~120', '~9', '7.6%', '-0.7%'],
            ['Date Understanding', '~80', '~74', '92.4%', '-1.2%'],
            ['Sports Understanding', '~55', '~22', '40.0%', '-0.4%'],
            ['Coin Flip (symbolic)', '~65', '~8', '12.3%', '+0.8%'],
            ['SWE-bench (code)', '~850', '~470', '55.4%', 'varies by variant'],
          ],
        },
        {
          type: 'note',
          text: 'Numbers for GSM8K, Date, Sports, and Coin Flip are from Xu et al. (2025), Table 2, using GPT-4o. SWE-bench numbers are from the SWE-CoD study (arxiv:2506.10987), using a baseline CoD variant. Accuracy deltas are approximate; exact values depend on prompt variant and model.',
        },
        'The token savings translate directly to cost and latency. At $15 per million output tokens, a system handling 1M math-reasoning requests per day saves roughly $2,400/day by switching from CoT to CoD on that slice. Latency drops proportionally to output length: 9 tokens generate in ~180ms at 50 tok/s; 120 tokens take ~2.4s.',
        'The operational cost is not free. CoD requires prompt engineering (few-shot examples, word caps, answer separators), output parsing (extracting the answer from terse notes), verifier maintenance (domain-specific checks), evaluation on failure slices (where does compression break), and routing policy (which tasks use which tier). The right metric is cost per accepted answer, not cost per generated token.',
        'Doubling request volume doubles inference cost linearly but does not change the compression ratio. Increasing task complexity shifts more requests from CoD to CoT or tool tiers, reducing average savings. The system architect must track the CoD-eligible fraction, not just the per-request ratio.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a multi-step word problem through both CoT and CoD to see where the token savings come from.',
        {
          type: 'diagram',
          text: 'Problem: "A store had 45 apples. It sold 12 in the morning\nand received a shipment of 30 in the afternoon. Then it\nsold 18 before closing. How many apples remain?"\n\nChain of Thought (~75 tokens):\n  "The store started with 45 apples. In the morning, it sold\n   12 apples, leaving 45 - 12 = 33 apples. In the afternoon,\n   it received 30 more apples, bringing the total to\n   33 + 30 = 63 apples. Before closing, it sold 18 apples,\n   leaving 63 - 18 = 45 apples. Therefore, 45 apples remain."\n\nChain of Draft (~12 tokens):\n  "45-12=33; +30=63; -18=45"\n  Answer: 45',
          label: 'Same 4-variable decision state: 75 tokens vs. 12 tokens',
        },
        {
          type: 'table',
          headers: ['Step', 'CoT trace', 'CoD trace', 'Decision state'],
          rows: [
            ['1. Extract start', '"The store started with 45 apples"', '45', 'start=45'],
            ['2. Morning sale', '"sold 12 apples, leaving 45-12=33"', '-12=33', 'state=33'],
            ['3. Shipment', '"received 30 more, total 33+30=63"', '+30=63', 'state=63'],
            ['4. Evening sale', '"sold 18, leaving 63-18=45"', '-18=45', 'state=45'],
            ['5. Answer', '"Therefore, 45 apples remain"', 'Answer: 45', 'ans=45'],
          ],
        },
        'Every row in the CoT column contains the same decision state as the CoD column, plus 8-15 tokens of narration ("The store started with," "bringing the total to," "Therefore"). The narration helps a human reader follow the logic but adds no information the model needs to compute the next step.',
        'Now run the verifier: parse "Answer: 45", evaluate 45-12+30-18 with a calculator, confirm 45=45. The draft passes. Ship the answer. Total cost: 12 output tokens instead of 75, same verified result.',
        {
          type: 'note',
          text: 'If the problem added a constraint -- "apples that are bruised cannot be sold; 5 of the shipment were bruised" -- the decision state grows. The CoD trace must become "45-12=33; +30=63; bruised 5 unsellable; -18=45; stock 45, sellable 40." Compression adapts to state complexity, not to a fixed word count.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Domain', 'CoD fit', 'Draft trace shape', 'Verifier'],
          rows: [
            ['Arithmetic word problems', 'Strong', 'nums; ops; result', 'Calculator'],
            ['Date/calendar reasoning', 'Strong', 'day; offset; rule; result', 'Calendar library'],
            ['Symbolic logic (coin flip)', 'Strong', 'state; flip; state; ...', 'State simulator'],
            ['Structured extraction', 'Good', 'field=value; field=value', 'Schema validator'],
            ['Customer support routing', 'Good', 'intent; entity; action', 'Policy rule engine'],
            ['Code generation', 'Mixed', 'symptom; file; edit; constraint; test', 'Unit tests, linter'],
            ['Legal/medical reasoning', 'Weak', 'Needs citations, provenance, exceptions', 'Human review required'],
            ['Creative writing', 'Poor', 'Style cannot be compressed to state', 'No compact verifier'],
          ],
        },
        'In a serving stack, CoD works as the first reasoning tier. The system tries a compact trace, runs the domain-appropriate verifier, and ships only if the answer clears the quality gate. Otherwise it escalates: retry with CoT, invoke a tool (calculator, code executor, retrieval), or route to human review.',
        {
          type: 'code',
          language: 'python',
          text: '# Production budget allocation example\nTIER_CONFIG = {\n    "direct":  {"max_output": 10,   "cost_weight": 1.0},\n    "cod":     {"max_output": 50,   "cost_weight": 1.5},\n    "cot":     {"max_output": 500,  "cost_weight": 3.0},\n    "tool":    {"max_output": 200,  "cost_weight": 5.0},\n    "human":   {"max_output": None, "cost_weight": 50.0},\n}\n\ndef select_tier(task_type, confidence, stakes):\n    if task_type in COMPACT_STATE_TASKS and stakes < 0.7:\n        return "cod"\n    if confidence > 0.95 and stakes < 0.3:\n        return "direct"\n    if task_type in TOOL_TASKS:\n        return "tool"\n    return "cot"  # default to verbose for safety',
        },
        'A practical deployment logs accepted answers, rejected drafts, escalation rate, verifier pass/fail by task slice, and latency per tier. The useful report is not average token savings -- it is the quality-adjusted cost per accepted answer, broken down by the task categories that matter to the product.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Overcompression: the model keeps the arithmetic and drops the condition, unit, exception, or constraint that determines correctness. "20-12=8" is fine for lollipops but wrong if 12 is in a different currency and needs conversion first.',
            'Blanket replacement: using CoD as a global prompt instead of a routing tier. High-stakes legal, medical, financial, or code-modifying workflows need evidence, provenance, and detail that cannot be compressed into 5-word steps.',
            'Aggregate metric masking: benchmark accuracy averages over easy and hard slices. CoD may match CoT on the easy 80% and fail on the hard 20% that matters most. Track failure slices, not averages.',
            'Hidden trace optimization: optimizing the private scratchpad for brevity instead of optimizing the final answer for user value. If compact reasoning creates more retries, more wrong answers, or less useful communication, the system optimized the wrong layer.',
            'Parse fragility: terse output is harder to parse reliably. "33+30=63" and "33 + 30 = 63" and "add 30 to get 63" are all valid CoD outputs but need different parsers. Prompt engineering reduces but does not eliminate format variance.',
            'Verifier absence: without a verifier, shorter traces hide mistakes instead of reducing cost. The error rate may be unchanged, but the errors are now invisible because the reasoning trace no longer explains itself.',
          ],
        },
        {
          type: 'note',
          text: 'The SWE-CoD study (arxiv:2506.10987) found that on software engineering tasks, CoD saved tokens but the compression was much smaller (55% of CoT tokens, not 7.6%). Code tasks need repository context, compatibility reasoning, and test validation that cannot be safely removed. The domain defines the compression floor.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Xu et al., "Chain of Draft" (2025), arxiv:2502.18600', 'Original paper: CoD prompting strategy, benchmarks across 6 reasoning tasks, token reduction measurements'],
            ['github.com/sileix/chain-of-draft', 'Reference implementation: prompts, evaluation scripts, benchmark data'],
            ['AWS "Chain-of-Draft on Bedrock" (2025)', 'Production deployment guide: prompt templates, Bedrock integration, cost analysis'],
            ['SWE-CoD study, arxiv:2506.10987', 'Software engineering extension: CoD on SWE-bench, smaller compression on code tasks'],
            ['Draft-Thinking, arxiv:2603.00578', 'Training-time approach: teach models to generate compact reasoning during training, not just prompting'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Chain of Thought Prompting to understand the verbose reasoning baseline that CoD compresses.',
            'Verification layer: study Process Reward Models & Verifier Search for step-level scoring and Verifier-Guided Inference Control Plane Case Study for routing decisions based on verification outcomes.',
            'Economics: study LLM Inference Cost Stack Case Study for the full cost model that makes token savings matter, and RAG Context Packing Token Budget Case Study for input-side budget tradeoffs.',
            'Alternatives: study Self-Consistency Reasoning Vote for sampling-based accuracy improvement (orthogonal to CoD), and Tree of Thoughts Search Case Study for broader exploration on harder problems.',
            'Evaluation: study LLM Evaluation Harnesses for measurement methodology and Benchmark Variance & Model Selection for understanding when aggregate metrics hide slice-level failures.',
          ],
        },
      ],
    },
  ],
};

