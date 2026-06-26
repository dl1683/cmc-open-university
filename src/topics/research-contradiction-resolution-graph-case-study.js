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
    explanation: 'The naive baseline is to smooth disagreement into neutral prose. A contradiction graph treats disagreement as a typed relation between exact source spans, preserving both sides and the unresolved question before synthesis.',
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
    explanation: 'Most disagreements have a reason: time, scope, method, metric, definition, or incentives. Classifying the reason lets the report explain the difference instead of averaging incompatible claims.',
    invariant: 'Do not average incompatible claims.',
  };

  yield {
    state: conflictGraph('The resolver may need a probe or calculation'),
    highlight: { active: ['conflict', 'test', 'ledger', 'e-conflict-test', 'e-test-ledger'], compare: ['class'], found: ['answer'] },
    explanation: 'Some conflicts cannot be resolved by reading another page. They need a probe: reproduce a calculation, compare benchmark settings, inspect release dates, or check whether two sources define the term differently.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as an evidence state machine. A claim is the statement the report might make, a source span is exact text or data from one source, and a conflict node means two spans cannot be combined without explanation.',
        'Active nodes show the disagreement being inspected. Compare nodes show evidence that disagrees or needs scoping. A safe inference is allowed only after the conflict type, probe, and scope have been recorded.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Research systems break when they turn disagreement into smooth prose. A model may read two sources, average them into a vague sentence, and hide whether the gap came from date, scope, method, metric, definition, or incentive.',
        'A contradiction resolution graph keeps the disagreement explicit until it is explained. It stores claims, source spans, conflict types, probes, scoped decisions, and final writing moves so a reader can see why one answer is supported.',
        {type:'callout', text:'A contradiction graph preserves disagreement as typed evidence until scope, method, metric, or freshness explains the conflict.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to pick the newest source or the source with the strongest brand. That works when the fact is time-sensitive and the newer source is actually measuring the same thing.',
        'The other obvious approach is false balance. It puts both claims side by side and says the issue is disputed, which sounds careful but leaves the reader without a usable conclusion.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Most contradictions are not simple yes-or-no fights. One source may report p50 latency while another reports p99 latency, or one may describe a 2024 product while another describes a 2026 release.',
        'Whole-document comparison is too coarse for this job. The system needs span-level evidence because a contradiction between two quoted claims is much easier to classify than a vague mismatch between two pages.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make contradiction a first-class graph node. The conflict node connects the target claim to the exact spans that disagree, then stores the kind of disagreement and the work needed to resolve it.',
        'The main question is not which source wins. The main question is what explains the difference, because a temporal conflict, a metric conflict, and an incentive conflict require different writing moves.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The system extracts a candidate claim, then links it to supporting and opposing source spans. A span is a bounded piece of evidence, such as one sentence, table row, benchmark number, or legal clause.',
        'When spans disagree, the resolver assigns a conflict type and a probe. The probe can be a date check, unit conversion, benchmark normalization, definition check, incentive review, or fresh source search.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant: no incompatible spans are merged until their conflict type and scope are recorded. If the invariant holds, the final answer cannot silently average claims that use different dates, populations, methods, or metrics.',
        'The graph also makes review possible. A reviewer can inspect the source span, the conflict classification, the probe result, and the final writing move instead of trusting a paragraph that merely sounds balanced.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is slower synthesis and more stored metadata. A claim with 12 sources may create 20 span links and several conflict nodes before the report can write one sentence.',
        'That cost changes behavior. The system becomes less likely to publish clean but unsupported certainty, and more likely to defer, split, or narrow a claim when evidence does not support a single answer.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Market research uses this structure when company filings, analyst notes, customer reports, and vendor benchmarks disagree. Legal and policy research use the same pattern when laws, guidance, cases, and agency statements apply under different scopes.',
        'Medical reviews, AI benchmark reports, and technical due diligence also fit. In each case the hard task is not collecting sources; it is explaining why apparently incompatible evidence can or cannot support one conclusion.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The graph fails when every wording difference becomes a conflict node. The resolver should create nodes only for disagreements that change a conclusion, risk, number, recommendation, or scope boundary.',
        'It also fails when conflict labels are assigned without domain knowledge. A metric mismatch in model benchmarking, a jurisdiction mismatch in law, and a population mismatch in medicine require different probes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose one source says a model serves 120 tokens per second and another says it serves 70 tokens per second. The graph records both spans, then classifies the conflict as a metric and hardware mismatch because the first number is batch throughput on 8 GPUs and the second is single-user p95 speed on 1 GPU.',
        'The scoped answer becomes precise: on the 8-GPU batch setup the reported throughput is 120 tokens per second, while the single-user p95 setup reports 70 tokens per second. The contradiction disappears because the graph proved that the two numbers answer different questions.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study provenance and research-agent systems next: W3C PROV-DM at https://www.w3.org/TR/prov-dm/, OpenLineage at https://openlineage.io/docs/spec/object-model/, WebGPT at https://arxiv.org/abs/2112.09332, STORM at https://arxiv.org/abs/2402.14207, and ReAct at https://arxiv.org/abs/2210.03629.',
        'Inside this curriculum, study Claim Graph and Source Ledger, Deep Research Question Decomposition DAG, Source Authority Triage Priority Queue, Evidence Freshness Refresh Scheduler, RAG Claim Verification Support Ledger, and Benchmark Variance and Model Selection.',
      ],
    },
  ],
};
