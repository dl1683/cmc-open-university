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
      heading: 'Why this exists',
      paragraphs: [
        "Reasoning prompts often buy accuracy with output tokens. A verbose chain-of-thought answer may help on some tasks, but every extra token adds latency, cost, parsing work, and more surface area for irrelevant prose.",
        "The reasonable first attempts are direct answering and verbose Chain of Thought. Direct answering is cheap but gives the system little intermediate state to check. Verbose reasoning exposes more state, but it can spend hundreds of tokens explaining steps that a solver could represent in a few symbols.",
        "Chain of Draft exists as a token-budget control surface. It asks the model to keep compact draft notes: the facts, transformations, checks, and final answer needed for the task, without turning the intermediate work into a prose tutorial.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is that shorter reasoning can omit the exact premise that would reveal a mistake. A draft trace that says \"20-12=8\" is enough for a simple arithmetic problem. A draft trace that says \"edit parser; tests pass\" is not enough to justify a repository patch.",
        "The mechanism works best when the useful state is compact: arithmetic, dates, symbolic transformations, simple commonsense checks, and constrained formats. It weakens when correctness depends on broad evidence, repository context, legal scope, medical nuance, citations, or style.",
        "The production wall is accepted-answer quality, not token count. A method that saves 70 percent of output tokens and loses the cases users care about is not an optimization. It is a cheaper failure mode.",
      ],
    },
    {
      heading: 'Core state model',
      paragraphs: [
        'A useful draft record stores task type, extracted facts, operations, updated state, lightweight checks, final answer, route id, token count, confidence, and verifier result. For arithmetic, "20 -> 12; 20-12=8; ans 8" preserves the whole state. For a date task, the record might store offset, weekday, calendar rule, and answer.',
        "For code, the record has to be richer: failing symptom, suspected file, edit intent, compatibility constraint, and required verification. The draft is still compact, but it cannot erase the repo-specific state that makes the patch safe.",
        "The final answer must be separate from the draft. That separation lets downstream code normalize the answer, count tokens, run validators, compare routes, and decide whether the trace should be expanded or rejected.",
        'The core insight is that compression is safe only when it preserves the decision state. A good draft is not short because it is vague. It is short because it stores the few variables that determine the answer. The moment a task needs provenance, source support, policy interpretation, or codebase context, the draft format must grow or the router must leave Chain of Draft.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        "A prompt usually gives a few examples of terse intermediate notes and a clear answer separator. The examples teach the model to preserve state without explaining every step in full sentences. A word cap helps, but the real contract is state preservation.",
        "A production router chooses the reasoning mode. Easy tasks can answer directly. Compact reasoning tasks can use Chain of Draft. Ambiguous or high-stakes tasks should route to fuller reasoning, retrieval, calculators, code execution, citation checks, process reward models, or human review.",
        "The verifier closes the loop. The verifier may be answer normalization, a calculator, unit tests, schema validation, citation support, a reward model, or a human. Without a verifier, a shorter trace can hide errors instead of reducing cost.",
      ],
    },
    {
      heading: 'Reliability argument',
      paragraphs: [
        "The reliability claim is narrow: if the task's necessary state can be represented compactly, and a verifier can check the final answer, then verbose reasoning is often wasted output. The draft keeps the state; the verifier checks the result.",
        "The invariant is accepted-answer quality at the target risk level. Token savings count only after the answer passes the same quality gate as the baseline. A draft that fails verification should expand, call a tool, or escalate.",
        "This is why Chain of Draft belongs in a routing system rather than a global prompt. It is one tier between direct answers and expensive reasoning modes.",
      ],
    },
    {
      heading: 'Costs',
      paragraphs: [
        "The original Chain of Draft paper reports near Chain-of-Thought accuracy on several reasoning tasks while using as little as 7.6 percent of the tokens. The strongest savings appear where the intermediate state is small and structured.",
        "A software-engineering follow-up is the useful caution. Across 300 SWE-bench samples, Chain of Draft variants used fewer tokens than Chain of Thought, with a baseline variant at 55.4 percent of CoT token usage. The savings were smaller because code work needs repository context, compatibility checks, and validation detail.",
        "The operational cost is policy work. Prompts need examples, outputs need parsing, validators need maintenance, and evaluation must include the slices where compression fails. The right metric is cost per accepted answer, not shortest trace.",
      ],
    },
    {
      heading: 'Production uses',
      paragraphs: [
        "Chain of Draft is useful for arithmetic, date reasoning, symbolic transformations, simple logic, constrained extraction, and support flows where the state fits in a compact record. It also helps when the system needs a cheap first pass before deciding whether to spend more.",
        'A concrete arithmetic trace can be "given 20, left 12; subtract; ans 8." A concrete date trace can be "start Tue; +3 business; Fri." A concrete code trace should not be that terse; it might be "symptom import fail; file cli.py; guard None; run parser tests."',
        "In a serving stack, CoD is a budget tier. The router tries a compact trace, runs the verifier, and ships only if the answer clears the quality gate. Otherwise it expands the trace, calls a tool, or escalates.",
        'A practical deployment should log which tasks use the compact tier and why. The useful report is not average token savings alone. It is accepted answers, rejected drafts, escalation rate, verifier failures, and latency by task slice. That lets teams keep the method where it helps and remove it where it hides too much reasoning state.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "The main failure is overcompression. The model keeps the arithmetic-looking part and drops the condition, unit, exception, citation, or compatibility constraint that determines correctness.",
        "Another failure is using CoD as a blanket replacement for Chain of Thought. High-stakes legal, medical, financial, or code-modifying workflows need independent checks and often need evidence that cannot be compressed into a few tokens.",
        "Aggregate benchmark accuracy can hide the damage. Track token usage, latency, answer format failures, calibration, verifier failures, task slices, and escalation rate. The important question is where compression breaks.",
        'A subtle failure is optimizing for hidden traces instead of user value. The user usually needs a clear final answer, not proof that the model used the shortest possible private scratchpad. If compact reasoning saves tokens but creates more retries, more wrong answers, or less useful final communication, the serving system has optimized the wrong layer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Chain of Draft at https://arxiv.org/abs/2502.18600 and the code/data repository at https://github.com/sileix/chain-of-draft. Practical deployment discussion: AWS Chain-of-Draft on Bedrock at https://aws.amazon.com/blogs/machine-learning/move-beyond-chain-of-thought-with-chain-of-draft-on-amazon-bedrock/. Software-engineering caveat: https://arxiv.org/abs/2506.10987. Related training direction: Draft-Thinking at https://arxiv.org/html/2603.00578v1.',
        'Study Self-Consistency Reasoning Vote for sampling-based checks, Tree of Thoughts Search Case Study for broader exploration, Process Reward Models & Verifier Search for step scoring, Verifier-Guided Inference Control Plane Case Study for routing, LLM Inference Cost Stack Case Study for economics, RAG Context Packing Token Budget Case Study for context tradeoffs, LLM Evaluation Harnesses for measurement, Benchmark Variance & Model Selection for slice analysis, and Softmax & Temperature for sampling behavior.',
      ],
    },
  ],
};
