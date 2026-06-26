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
        'Read the animation as a budget ledger for reasoning tokens. A token is a small unit of model text, and output tokens are expensive because the model generates them one after another. The active row shows the current decision: write a compact draft, check the answer, route to a larger reasoning mode, or ship.',
        'In the draft-trace view, the important state is not the prose around the solution. It is the variables, operation, intermediate value, and final answer. In the production-budget view, a compact answer is accepted only when the verifier proves that the saved tokens did not remove a fact needed for correctness.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Chain of Draft exists because Chain of Thought often spends output tokens explaining simple state updates. Chain of Thought means asking a model to write intermediate reasoning before the final answer. That helps on hard reasoning tasks, but it can turn a three-number arithmetic problem into a paragraph.',
        'The cost is behavioral, not cosmetic. More output tokens raise latency, billable spend, and KV-cache pressure, where a KV cache is the stored attention state used while a model generates text. A serving system that writes 120 tokens when 12 verified tokens would solve the same task is buying explanation instead of accuracy.',
        {type:'callout', text:'Chain of Draft is safe only when compression removes narration while preserving every load-bearing piece of decision state.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious cheap approach is direct answering: ask for the answer and nothing else. It is fast and easy to parse because the model emits only the final value. It works when the task is factual recall, simple extraction, or a pattern the model already handles reliably.',
        'The obvious accurate approach is full Chain of Thought. It gives the model room to decompose the task and gives a verifier more surface to inspect. The problem is that this surface often contains repeated problem text, transition words, and human-facing explanation that do not change the computed state.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Direct answering hits an observability wall. If the answer is wrong, the system cannot see whether the model extracted the wrong number, chose the wrong operation, or made an arithmetic slip. There is no useful state to verify or debug.',
        'Full Chain of Thought hits a scaling wall. If one million requests each write 100 unnecessary output tokens, that is 100 million extra tokens of latency and cost. The deeper wall is that token count and reasoning quality are different variables: some tokens are state, and some are narration.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to store the decision state, not the explanation around it. A draft is safe when it keeps every variable, operation, condition, and final value that determines the answer. It is unsafe when brevity drops a unit, exception, source, or constraint.',
        'A good Chain of Draft trace behaves like a small state-machine log. For arithmetic it may contain numbers and operators. For date reasoning it may contain the start day, offset, calendar rule, and result. For code or policy work the state is larger, so the trace must grow or the router must choose a different reasoning mode.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The prompt gives examples of terse draft notes and a clear answer marker. The model still reasons step by step, but each visible step is limited to the state needed for the next step. A parser then separates the draft from the final answer.',
        'A production loop treats Chain of Draft as one tier, not as a universal replacement. The router tries a compact trace for tasks with compact state, runs a verifier, and ships only if the verifier passes. If parsing fails, verification fails, or the task type is known to need provenance, the request escalates to verbose reasoning, a tool, or human review.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant: the accepted answer must preserve the same load-bearing state as the longer baseline. Removing a sentence such as "therefore we subtract" is harmless if the trace still records "20-12=8." Removing "gave away" or the number 12 is not harmless because the operation can no longer be checked.',
        'The verifier enforces that invariant at the system boundary. For arithmetic it recomputes the expression; for extraction it checks schema and source fields; for code it runs tests. Token savings count only after the answer clears the same quality gate used for the larger reasoning mode.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Suppose full Chain of Thought emits 120 output tokens and Chain of Draft emits 12. At 50 tokens per second, generation time falls from about 2.4 seconds to about 0.24 seconds before network overhead. At $15 per million output tokens, one million requests cost $1,800 with 120-token traces and $180 with 12-token traces.',
        'The system cost moves into routing and verification. Engineers must maintain task classifiers, prompt examples, parsers, verifier code, failure-slice dashboards, and escalation policies. The useful metric is cost per accepted answer, because a cheap trace that triggers many retries can cost more than a longer trace that passes once.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Chain of Draft is a good fit for arithmetic word problems, calendar offsets, symbolic state updates, structured extraction, and low-risk routing decisions. These tasks have compact decision state and cheap verifiers. The trace can be short because the answer is determined by a small number of fields.',
        'It is also useful inside model-serving systems that already have multiple reasoning tiers. A request can start in the compact tier, escalate when the verifier rejects it, and log the reason for that escalation. That lets the operator save tokens on easy slices without pretending every slice is easy.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the task needs evidence that cannot be compressed safely. Legal analysis, medical advice, financial decisions, repository-wide code edits, and multi-document synthesis often require provenance, exceptions, and long-range context. A five-word step can hide the very fact that makes the answer valid.',
        'It also fails when teams optimize average token savings instead of failure slices. A benchmark can show strong average accuracy while the compressed trace fails on the high-stakes minority. Without a verifier and slice-level monitoring, Chain of Draft can turn visible reasoning errors into invisible concise errors.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take the problem: a store starts with 45 apples, sells 12, receives 30, then sells 18. A verbose trace restates the story before each arithmetic step. The load-bearing state is only "45-12=33; +30=63; -18=45; answer 45."',
        'If the full trace is 75 tokens and the draft is 12 tokens, the draft uses 16 percent of the output tokens. The verifier parses 45, evaluates 45 - 12 + 30 - 18, and gets 45. The answer ships because the compressed record preserved every number and operation needed to prove it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with Xu et al., "Chain of Draft: Thinking Faster by Writing Less" (2025), and the reference implementation at github.com/sileix/chain-of-draft. Read the paper for the compression results, but read the examples as state records rather than as prompt tricks. The important question is which task families keep their decision state small.',
        'Study Chain of Thought prompting as the baseline, then verifier-guided inference for the quality gate. Study LLM inference cost models to connect output tokens to latency and spend. Study self-consistency, tool use, and tree search as alternatives for tasks where compact state is not enough.',
      ],
    },
  ],
};
