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
      heading: 'What it is',
      paragraphs: [
        'Chain of Draft is a prompting strategy for efficient reasoning. Instead of asking the model to write a verbose chain-of-thought explanation, it asks for compact draft notes that preserve only the critical facts, transformations, and checks needed to reach the answer.',
        'The core system idea is a token-budget control surface. A draft trace is shorter, more parseable, and cheaper to generate than a prose trace. But it is not automatically safer or more faithful. It should be treated as an intermediate artifact that can be checked, routed, expanded, or rejected.',
      ],
    },
    {
      heading: 'The data structure',
      paragraphs: [
        'A useful draft trace stores task type, extracted facts, operations, updated state, lightweight checks, and final answer. For arithmetic, that might be "20 -> 12; 20-12=8; ans 8." For date reasoning, it might store offsets and calendar constraints. For code, it might store failing symptom, suspected file, edit intent, and required verification.',
        'That structure lets the system count tokens, normalize answers, run cheap validators, decide whether more reasoning is needed, and compare trace cost against final quality. In other words, Chain of Draft turns reasoning text into something closer to a compact execution log.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The prompt demonstrates short draft steps, often with a few-shot example. The model is asked to keep each reasoning step concise while still retaining the essential state. The output separates draft notes from the final answer so downstream code can parse and grade it.',
        'The important implementation detail is routing. Easy tasks can answer directly. Medium tasks can use Chain of Draft. Ambiguous or high-stakes tasks should route to full reasoning, retrieval, calculators, code execution, citation checks, process reward models, or human review. A fixed word cap is not a policy.',
      ],
    },
    {
      heading: 'Case studies',
      paragraphs: [
        'The original Chain of Draft paper reports that CoD can match or surpass Chain of Thought on several reasoning tasks while using as little as 7.6 percent of the tokens, with corresponding latency and cost reductions. The reported wins are strongest where the reasoning state is compact, such as arithmetic, common-sense, symbolic, date, and sports-understanding tasks.',
        'A later software-engineering study is the useful caution. Across 300 SWE-bench samples, Chain of Draft variants used substantially fewer tokens than Chain of Thought, with a baseline variant at 55.4 percent of CoT token usage, but the savings were less extreme than in math-style tasks because code work needs repository context, compatibility checks, and validation detail.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Output tokens directly affect latency and cost in many hosted LLM systems. A shorter trace can reduce time to final answer and make downstream parsing easier. The right metric is not raw token savings, though. It is cost per accepted answer at target quality, latency, and risk level.',
        'Draft traces add their own complexity. Prompts need examples. Validators need answer normalization. Routing policies need thresholds. Evaluation needs slices where compression fails. If a draft hides a missing premise, the product becomes cheaper and worse at the same time.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat Chain of Draft as proof that hidden or terse reasoning is always enough. A short trace can omit the exact fact that would reveal a bug. Do not use it as the only reasoning mode for high-stakes legal, medical, financial, or code-modifying workflows without independent checks.',
        'Also avoid comparing CoD and CoT only by average accuracy. Look at token usage, latency, task slices, answer format failures, calibration, and cases routed to tools or humans. Benchmark Variance & Model Selection applies here: one aggregate score can hide where compression breaks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Chain of Draft at https://arxiv.org/abs/2502.18600 and the code/data repository at https://github.com/sileix/chain-of-draft. Practical deployment discussion: AWS Chain-of-Draft on Bedrock at https://aws.amazon.com/blogs/machine-learning/move-beyond-chain-of-thought-with-chain-of-draft-on-amazon-bedrock/. Software-engineering caveat: https://arxiv.org/abs/2506.10987. Related training direction: Draft-Thinking at https://arxiv.org/html/2603.00578v1.',
        'Study Self-Consistency Reasoning Vote, Tree of Thoughts Search Case Study, Process Reward Models & Verifier Search, Verifier-Guided Inference Control Plane Case Study, LLM Inference Cost Stack Case Study, LLM Unit Economics Ledger Case Study, RAG Context Packing Token Budget Case Study, LLM Evaluation Harnesses, Benchmark Variance & Model Selection, and Softmax & Temperature next.',
      ],
    },
  ],
};
