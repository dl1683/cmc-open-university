// Research contradiction resolution graph: classify source disagreement by
// time, scope, method, metric, definition, and incentive before synthesis.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'research-contradiction-resolution-graph-case-study',
  title: 'Research Contradiction Resolution Graph',
  category: 'AI & ML',
  summary: 'Represent source disagreements as typed graph edges so deep research can explain conflicts instead of smoothing them into false balance.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['conflict graph', 'resolution rubric'], defaultValue: 'conflict graph' },
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

function conflictGraph(title) {
  return graphState({
    nodes: [
      { id: 'claim', label: 'claim', x: 0.8, y: 3.8, note: 'target' },
      { id: 'srcA', label: 'src A', x: 2.8, y: 2.0, note: 'new' },
      { id: 'srcB', label: 'src B', x: 2.8, y: 5.6, note: 'old' },
      { id: 'spanA', label: 'span A', x: 4.4, y: 2.0, note: 'quote' },
      { id: 'spanB', label: 'span B', x: 4.4, y: 5.6, note: 'quote' },
      { id: 'conflict', label: 'conf', x: 5.9, y: 3.8, note: 'typed' },
      { id: 'class', label: 'class', x: 7.3, y: 2.2, note: 'why' },
      { id: 'test', label: 'test', x: 7.3, y: 5.4, note: 'probe' },
      { id: 'ledger', label: 'ledger', x: 8.8, y: 3.8, note: 'record' },
      { id: 'answer', label: 'answer', x: 10.0, y: 3.8, note: 'scoped' },
    ],
    edges: [
      { id: 'e-claim-srcA', from: 'claim', to: 'srcA' },
      { id: 'e-claim-srcB', from: 'claim', to: 'srcB' },
      { id: 'e-srcA-spanA', from: 'srcA', to: 'spanA' },
      { id: 'e-srcB-spanB', from: 'srcB', to: 'spanB' },
      { id: 'e-spanA-conflict', from: 'spanA', to: 'conflict', weight: 'says' },
      { id: 'e-spanB-conflict', from: 'spanB', to: 'conflict', weight: 'diff' },
      { id: 'e-conflict-class', from: 'conflict', to: 'class' },
      { id: 'e-conflict-test', from: 'conflict', to: 'test' },
      { id: 'e-class-ledger', from: 'class', to: 'ledger' },
      { id: 'e-test-ledger', from: 'test', to: 'ledger' },
      { id: 'e-ledger-answer', from: 'ledger', to: 'answer' },
    ],
  }, { title });
}

function* conflictGraphView() {
  yield {
    state: conflictGraph('Contradictions should be first-class graph nodes'),
    highlight: { active: ['claim', 'srcA', 'srcB', 'spanA', 'spanB', 'conflict', 'e-claim-srcA', 'e-claim-srcB', 'e-spanA-conflict', 'e-spanB-conflict'], compare: ['answer'] },
    explanation: 'A contradiction is not a formatting problem. It is a typed relation between source spans. The graph should preserve both sides, the exact spans, and the unresolved question before any synthesis happens.',
  };

  yield {
    state: labelMatrix(
      'Conflict types',
      [
        { id: 'time', label: 'time' },
        { id: 'scope', label: 'scope' },
        { id: 'method', label: 'method' },
        { id: 'metric', label: 'metric' },
        { id: 'defn', label: 'defn' },
        { id: 'bias', label: 'bias' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'move', label: 'move' },
      ],
      [
        ['chg', 'new'],
        ['slice', 'narrow'],
        ['meth', 'why'],
        ['score', 'norm'],
        ['term', 'def'],
        ['bias', 'down'],
      ],
    ),
    highlight: { active: ['time:move', 'scope:move', 'metric:move', 'defn:move'], compare: ['bias:move'] },
    explanation: 'Most disagreements have a reason: time, scope, method, metric, definition, or incentives. The graph classifies the reason so the final report can explain why sources differ instead of pretending they are equally comparable.',
    invariant: 'Do not average incompatible claims.',
  };

  yield {
    state: conflictGraph('The resolver may need a probe or calculation'),
    highlight: { active: ['conflict', 'test', 'ledger', 'e-conflict-test', 'e-test-ledger'], compare: ['class'], found: ['answer'] },
    explanation: 'Some conflicts cannot be resolved by reading another page. They need a probe: reproduce the calculation, compare benchmark settings, inspect release dates, or ask whether two sources define the term differently.',
  };

  yield {
    state: conflictGraph('Resolution creates a scoped answer, not a winner'),
    highlight: { active: ['class', 'test', 'ledger', 'answer', 'e-class-ledger', 'e-test-ledger', 'e-ledger-answer'], compare: ['srcA', 'srcB'] },
    explanation: 'The output is often not "source A wins." It is a scoped statement: for this version, workload, jurisdiction, metric, and date, this claim is best supported; outside that scope, the conflict remains open.',
  };
}

function* resolutionRubric() {
  yield {
    state: labelMatrix(
      'Resolution ledger',
      [
        { id: 'c1', label: 'c1' },
        { id: 'c2', label: 'c2' },
        { id: 'c3', label: 'c3' },
        { id: 'c4', label: 'c4' },
        { id: 'c5', label: 'c5' },
      ],
      [
        { id: 'type', label: 'type' },
        { id: 'probe', label: 'probe' },
        { id: 'scope', label: 'scope' },
        { id: 'act', label: 'act' },
      ],
      [
        ['time', 'date', 'v2', 'new'],
        ['metric', 'calc', 'p95', 'norm'],
        ['scope', 'slice', 'EU', 'narrow'],
        ['method', 'read', 'lab', 'split'],
        ['bias', 'rank', 'vend', 'warn'],
      ],
    ),
    highlight: { active: ['c1:act', 'c2:probe', 'c3:scope'], compare: ['c5:act'], found: ['c4:type'] },
    explanation: 'Each conflict ledger row stores the type, probe, scope, selected action, and residual uncertainty. This gives reviewers something concrete to inspect.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'conflicts examined', min: 0, max: 12 }, y: { label: 'answer confidence', min: 0, max: 1 } },
      series: [
        { id: 'polish', label: 'ignore conflicts', points: [{ x: 1, y: 0.78 }, { x: 3, y: 0.76 }, { x: 6, y: 0.72 }, { x: 12, y: 0.65 }] },
        { id: 'resolve', label: 'resolve graph', points: [{ x: 1, y: 0.5 }, { x: 3, y: 0.62 }, { x: 6, y: 0.76 }, { x: 12, y: 0.86 }] },
      ],
      markers: [
        { id: 'turn', x: 6, y: 0.76, label: 'scope fixed' },
      ],
    }),
    highlight: { active: ['resolve', 'turn'], compare: ['polish'] },
    explanation: 'Ignoring contradictions can make early prose sound confident. Resolving them may lower initial certainty, but it produces a stronger answer once scope, method, and freshness are explicit.',
  };

  yield {
    state: labelMatrix(
      'Synthesis moves',
      [
        { id: 'prefer', label: 'prefer' },
        { id: 'split', label: 'split' },
        { id: 'range', label: 'range' },
        { id: 'defer', label: 'defer' },
        { id: 'remove', label: 'remove' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'text', label: 'text' },
      ],
      [
        ['newer', 'as of'],
        ['scope', 'in X'],
        ['metric', 'range'],
        ['weak', 'open'],
        ['nocit', 'omit'],
      ],
    ),
    highlight: { active: ['prefer:text', 'split:text', 'range:text'], compare: ['defer:text'], removed: ['remove:text'] },
    explanation: 'The resolver does not only pick evidence. It chooses a writing move: prefer current evidence, split by scope, report a range, defer conclusion, or remove an unsupported claim.',
  };

  yield {
    state: conflictGraph('Contradiction handling links back into planning'),
    highlight: { active: ['ledger', 'conflict', 'class', 'test', 'e-conflict-class', 'e-conflict-test'], found: ['answer'], compare: ['claim'] },
    explanation: 'If the conflict cannot be resolved, the research DAG should reopen with a new question. A good agent says what would settle the issue instead of manufacturing a settled answer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'conflict graph') yield* conflictGraphView();
  else if (view === 'resolution rubric') yield* resolutionRubric();
  else throw new InputError('Pick a contradiction-resolution view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A research contradiction resolution graph is a data structure for preserving, classifying, and resolving source disagreement. Nodes are claims, sources, spans, conflict classes, probes, and scoped conclusions. Edges say supports, contradicts, supersedes, narrows, defines, or weakens.',
        'This module extends Claim Graph & Source Ledger. The claim ledger records the disagreement. The contradiction graph gives the disagreement a type and a resolution path. It is also the concrete version of the deep-research rubric item called critical reasoning.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A contradiction should be attached to exact spans, not whole documents. The system stores both spans, source metadata, dates, methods, metric definitions, and authority rank. It then classifies why the spans differ. Temporal conflicts prefer current evidence only when the fact is date-sensitive. Scope conflicts narrow the claim. Metric conflicts require normalization. Method conflicts may need separate conclusions.',
        'WebGPT is relevant because it trained browsing answers to collect references, making factual feedback easier: https://openai.com/index/webgpt/ and https://arxiv.org/abs/2112.09332. STORM is relevant because its multi-perspective question asking pushes the system to discover viewpoints before writing: https://storm-project.stanford.edu/research/storm/ and https://arxiv.org/abs/2402.14207. Contradiction handling is the next layer after collecting references and perspectives.',
      ],
    },
    {
      heading: 'Resolution classes',
      paragraphs: [
        'The most useful classes are temporal change, scope mismatch, method mismatch, metric mismatch, definition mismatch, and incentive bias. Temporal change asks which source is current and whether older evidence is still useful historically. Scope mismatch asks whether both sources are true for different populations, products, geographies, or workloads. Method mismatch asks whether procedures differ enough to prevent direct comparison.',
        'Metric mismatch is common in AI reports. One source may report exact-match accuracy, another rubric pass rate, another cost-normalized performance. The answer should not average them. It should explain the metric difference and, where possible, normalize or report them separately. Benchmark Variance & Model Selection and RAG Claim Verification Support Ledger are natural companion topics.',
      ],
    },
    {
      heading: 'Complete case study: long-context versus RAG',
      paragraphs: [
        'A user asks whether long-context models make RAG obsolete. One source says long context removes retrieval engineering for many document tasks. Another shows lost-in-the-middle behavior and distractor sensitivity. A vendor post claims a large context window solves document analysis. A benchmark paper shows that evidence position and task structure still matter.',
        'The contradiction graph classifies the disagreement as scope and method, not simple factual opposition. The scoped conclusion is: long context can reduce retrieval needs for some whole-document workflows, but RAG remains useful when cost, citation auditability, source freshness, access control, or targeted evidence selection matter. The answer links conditions to evidence instead of choosing a tribe.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'A resolver can use a cascade. Deterministic checks compare dates, versions, URLs, and metric names. Lightweight classifiers label conflict type. Calculators normalize comparable numbers. LLM judges can propose explanations for ambiguous conflicts, but their outputs should be stored as hypotheses until backed by source spans or calculations.',
        'W3C PROV-DM is useful background for modeling entities, activities, agents, and provenance relationships: https://www.w3.org/TR/prov-dm/. OpenLineage shows a production lineage pattern with runs, jobs, datasets, and facets: https://openlineage.io/docs/spec/object-model/. A contradiction graph is the research-report analogue: provenance plus typed disagreement plus resolution state.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not hide contradictions because they make the answer less clean. Do not treat older as worse unless the fact is time-sensitive. Do not downrank a source only because it disagrees with the draft. Do not overuse false balance when one source is clearly weak. Do not let the model invent a synthesis that no span supports.',
        'Study Claim Graph & Source Ledger, Deep Research Question Decomposition DAG, Source Authority Triage Priority Queue, Evidence Freshness Refresh Scheduler, RAG Claim Verification Support Ledger, Deep Research Evaluation Harness, Benchmark Variance & Model Selection, Lost in the Middle, STORM, WebGPT, ReAct at https://arxiv.org/abs/2210.03629, Anthropic multi-agent research system at https://www.anthropic.com/engineering/multi-agent-research-system, and NIST AI RMF at https://www.nist.gov/itl/ai-risk-management-framework.',
      ],
    },
  ],
};
