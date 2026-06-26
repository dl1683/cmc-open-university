// LLM red-team taxonomy queue: turn attack classes into runnable tests,
// severity labels, coverage gaps, and guardrail regression evidence.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-red-team-attack-taxonomy-queue-case-study',
  title: 'LLM Red-Team Attack Taxonomy Queue Case Study',
  category: 'AI & ML',
  summary: 'A safety-evaluation case study: map OWASP and MITRE-style attack classes into red-team queues, severity labels, coverage matrices, and release gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['taxonomy queue', 'coverage matrix'], defaultValue: 'taxonomy queue' },
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

function redTeamGraph(title) {
  return graphState({
    nodes: [
      { id: 'tax', label: 'tax', x: 0.7, y: 3.4, note: 'risks' },
      { id: 'seed', label: 'seed', x: 2.2, y: 2.0, note: 'cases' },
      { id: 'queue', label: 'queue', x: 2.2, y: 4.8, note: 'work' },
      { id: 'run', label: 'run', x: 4.0, y: 3.4, note: 'eval' },
      { id: 'score', label: 'score', x: 5.7, y: 2.0, note: 'judge' },
      { id: 'sev', label: 'sev', x: 5.7, y: 4.8, note: 'risk' },
      { id: 'gate', label: 'gate', x: 7.4, y: 3.4, note: 'ship' },
      { id: 'fix', label: 'fix', x: 9.0, y: 2.0, note: 'ctrl' },
      { id: 'log', label: 'log', x: 9.0, y: 4.8, note: 'proof' },
    ],
    edges: [
      { id: 'e-tax-seed', from: 'tax', to: 'seed' },
      { id: 'e-tax-queue', from: 'tax', to: 'queue' },
      { id: 'e-seed-run', from: 'seed', to: 'run' },
      { id: 'e-queue-run', from: 'queue', to: 'run' },
      { id: 'e-run-score', from: 'run', to: 'score' },
      { id: 'e-run-sev', from: 'run', to: 'sev' },
      { id: 'e-score-gate', from: 'score', to: 'gate' },
      { id: 'e-sev-gate', from: 'sev', to: 'gate' },
      { id: 'e-gate-fix', from: 'gate', to: 'fix' },
      { id: 'e-gate-log', from: 'gate', to: 'log' },
    ],
  }, { title });
}

function* taxonomyQueue() {
  yield {
    state: redTeamGraph('Red-team taxonomy queue'),
    highlight: { active: ['tax', 'seed', 'queue', 'run', 'e-tax-seed', 'e-tax-queue', 'e-seed-run', 'e-queue-run'], found: ['gate'] },
    explanation: 'The graph starts from a taxonomy so prompts do not become loose anecdotes. Each risk class turns into runnable cases, queue priority, severity, and release evidence.',
    invariant: 'Unlabeled adversarial prompts are anecdotes; taxonomy-linked cases are test assets.',
  };

  yield {
    state: labelMatrix(
      'Attack class queue',
      [
        { id: 'inj', label: 'inject' },
        { id: 'leak', label: 'leak' },
        { id: 'tool', label: 'tool' },
        { id: 'rag', label: 'rag' },
        { id: 'poison', label: 'poison' },
      ],
      [
        { id: 'src', label: 'src' },
        { id: 'sev', label: 'sev' },
        { id: 'act', label: 'act' },
      ],
      [
        ['OWASP', 'high', 'run'],
        ['ATLAS', 'high', 'run'],
        ['OWASP', 'crit', 'run'],
        ['OWASP', 'med', 'add'],
        ['ATLAS', 'high', 'add'],
      ],
    ),
    highlight: { active: ['inj:act', 'leak:act', 'tool:act'], compare: ['rag:act', 'poison:act'], found: ['tool:sev'] },
    explanation: 'The queue row adds the metadata the prompt cannot carry: taxonomy source, severity, status, owner, and freshness. Tool misuse and prompt injection rise in priority because failure can cross from text into real authority.',
  };

  yield {
    state: redTeamGraph('Scoring turns failures into release gates'),
    highlight: { active: ['run', 'score', 'sev', 'gate', 'e-run-score', 'e-run-sev', 'e-score-gate', 'e-sev-gate'], found: ['fix', 'log'] },
    explanation: 'A failed case now reaches the gate instead of staying in a report. The release decision must deny, mitigate, escalate, or accept the risk with written rationale.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'coverage age, days', min: 0, max: 90 }, y: { label: 'open severe cases', min: 0, max: 20 } },
      series: [
        { id: 'base', label: 'baseline', points: [{ x: 0, y: 3 }, { x: 20, y: 4 }, { x: 45, y: 8 }, { x: 70, y: 13 }, { x: 90, y: 18 }] },
        { id: 'refresh', label: 'refresh queue', points: [{ x: 0, y: 3 }, { x: 20, y: 3 }, { x: 45, y: 4 }, { x: 70, y: 5 }, { x: 90, y: 7 }] },
      ],
      markers: [
        { id: 'stale', x: 45, y: 8, label: 'stale' },
      ],
    }),
    highlight: { active: ['refresh', 'stale'], compare: ['base'] },
    explanation: 'The plot shows coverage decay. Products gain tools, policies change, and attackers adapt, so stale cases undercount risk even when yesterday\'s report looked complete.',
  };
}

function* coverageMatrix() {
  yield {
    state: labelMatrix(
      'Coverage by risk and surface',
      [
        { id: 'chat', label: 'chat' },
        { id: 'rag', label: 'RAG' },
        { id: 'tool', label: 'tool' },
        { id: 'code', label: 'code' },
        { id: 'admin', label: 'admin' },
      ],
      [
        { id: 'inj', label: 'inj' },
        { id: 'leak', label: 'leak' },
        { id: 'misuse', label: 'mis' },
        { id: 'drift', label: 'drift' },
      ],
      [
        ['pass', 'pass', 'gap', 'old'],
        ['fail', 'pass', 'gap', 'old'],
        ['fail', 'fail', 'gap', 'new'],
        ['pass', 'pass', 'pass', 'old'],
        ['fail', 'fail', 'fail', 'new'],
      ],
    ),
    highlight: { removed: ['rag:inj', 'tool:inj', 'tool:leak', 'admin:inj', 'admin:leak', 'admin:misuse'], compare: ['chat:misuse', 'rag:misuse', 'tool:misuse'], active: ['admin:drift'] },
    explanation: 'The matrix makes missing coverage visible by surface. Admin and tool rows need stricter gates than plain chat because a failed test can trigger real actions.',
  };

  yield {
    state: redTeamGraph('Coverage gaps generate new queue work'),
    highlight: { active: ['tax', 'queue', 'gate', 'fix', 'e-tax-queue', 'e-gate-fix'], compare: ['score'], found: ['log'] },
    explanation: 'A gap becomes work only when it enters the queue. The row records the missing risk class, affected surface, owner, due date, and proof required to close it.',
  };

  yield {
    state: labelMatrix(
      'Complete case: indirect prompt injection',
      [
        { id: 'doc', label: 'doc' },
        { id: 'rag', label: 'RAG' },
        { id: 'agent', label: 'agent' },
        { id: 'gate', label: 'gate' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'score', label: 'score' },
        { id: 'act', label: 'act' },
      ],
      [
        ['bad doc', 'fail', 'block'],
        ['cite', 'weak', 'fix'],
        ['tool', 'fail', 'least'],
        ['rerun', 'pass', 'ship'],
      ],
    ),
    highlight: { active: ['doc:act', 'rag:act', 'agent:act', 'gate:act'], removed: ['doc:score', 'agent:score'], found: ['gate:score'] },
    explanation: 'The indirect-injection row shows a boundary failure: untrusted retrieved text steers a privileged tool call. The fix needs source trust labels, least-privilege tooling, and a rerun proof, not just a better refusal phrase.',
  };

  yield {
    state: redTeamGraph('Taxonomy links into audit evidence'),
    highlight: { active: ['tax', 'gate', 'log', 'e-gate-log'], found: ['fix'], compare: ['seed', 'queue'] },
    explanation: 'The queue finally feeds audit evidence. A useful record says which risk class was tested, which surface failed, what changed, and which rerun proved the control worked.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'taxonomy queue') yield* taxonomyQueue();
  else if (view === 'coverage matrix') yield* coverageMatrix();
  else throw new InputError('Pick an LLM red-team queue view.');
}


export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a queue of red-team prompts. A red-team prompt is a test input written to make a language model behave unsafely, such as revealing secrets, following hidden instructions, or giving harmful guidance. Active means the prompt being triaged now, visited means it already has a taxonomy label, and found means the system has enough evidence to assign owner, severity, and rerun status.',
        'The safe inference rule is simple: a prompt is not evidence until it is attached to a failure class and a reproducible test. If two prompts look different but hit the same model weakness, they should land in the same bucket; if one prompt hits a new weakness, it deserves a new queue item and a new coverage gap.',
        {type: 'callout', text: 'A red-team prompt becomes durable safety evidence only when it is linked to a taxonomy, surface, severity, owner, and rerun proof.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A large language model, or LLM, turns text input into text output by predicting tokens. Because it follows patterns rather than human intent, a user can sometimes steer it toward unsafe behavior with carefully shaped input. Red-team testing exists to find those cases before real users or attackers do.',
        'A taxonomy is a controlled set of labels for failure types. Without it, one team calls a case prompt injection, another calls it data leakage, and a third files it as policy bypass. The queue turns scattered examples into a worklist that can be measured and rerun.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to collect bad prompts in a spreadsheet and read them one by one. That works when there are 20 examples and one engineer remembers every case. Each row can hold the prompt, model answer, and a short note about what went wrong.',
        'This is not a foolish start. Early safety work is exploratory, and the first need is often to see concrete failures. A spreadsheet makes failure visible before the team has enough structure to automate anything.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when examples multiply faster than judgment. One attack family may have 300 phrasings, while a new failure type may have only one. Counting rows then rewards noisy duplication instead of coverage.',
        'The second wall is ownership. A jailbreak against the chat surface, a retrieval poisoning case, and a tool-call exfiltration case need different fixes. If the queue does not encode surface and severity, urgent work waits behind low-value duplicates.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat each prompt as a candidate observation, not as the unit of safety work. The unit of work is the pair of taxonomy class and system surface, backed by at least one reproducible example. That changes the queue from a pile of text into a coverage map.',
        'The invariant is that every accepted item must answer four questions: what failed, where it failed, how bad it is, and whether the fix was rerun. If any field is missing, the item stays in triage rather than becoming evidence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First, normalize the prompt and attach the output that proved the failure. Normalization removes accidental differences such as whitespace while preserving the attack content. The queue then checks whether an existing taxonomy class already explains the behavior.',
        'Next, the item gets a surface label such as chat, retrieval, tool call, memory, or file upload. Severity is assigned from impact and exploitability, not from how dramatic the prompt sounds. The highest-priority items are those that combine high harm, easy reproduction, and broad surface exposure.',
        'Finally, the queue records owner and rerun proof. Owner means the team responsible for changing the system, not the person who found the prompt. Rerun proof means the same test was executed after the fix and the unsafe behavior no longer appears.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant argument. If every closed queue item has a taxonomy class, surface, severity, owner, and rerun result, then the closed set is not just a story about testing; it is a set of checkable claims. Auditors can sample any item and reconstruct why it was closed.',
        'The queue also preserves monotonic coverage. Adding a new prompt can increase evidence for an existing class or open a new class, but it should not erase previous labels without review. That makes trend lines meaningful across model releases.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For n prompts and k taxonomy classes, naive manual classification costs about O(nk) reading effort if every prompt is compared with every class. A practical queue reduces the average by using keyword hints, embeddings, or prior examples, but humans still review the boundary cases. When n doubles, review cost doubles unless deduplication improves.',
        'The dominant cost is expert attention. Cheap automation can sort obvious duplicates, but mislabeling a severe case as a duplicate is more expensive than reviewing it. Storage is small; the real operating cost is the rerun matrix across models, policies, and product surfaces.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LLM product teams use this pattern to manage jailbreak reports, prompt-injection tests, tool-use abuse cases, and privacy leakage checks. The fit is real because each failure needs a durable link between an example and a fixable control. A queue gives security, policy, and engineering teams one shared state machine.',
        'It also fits compliance work. A customer or regulator may not care about every prompt string, but they can inspect whether high-severity classes are covered and rerun after release. The queue becomes safety regression testing rather than incident folklore.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The queue fails when the taxonomy becomes a hiding place. If labels are too broad, prompt injection absorbs unrelated failures and coverage looks better than it is. If labels are too narrow, every paraphrase becomes a new class and the team drowns in duplicates.',
        'It also fails when severity is assigned from embarrassment instead of harm. A weird answer may be low risk, while a quiet tool-call leak may be severe. The queue needs calibration examples and periodic review or its numbers become theater.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a team tests 200 prompts against a support chatbot. The first pass finds 80 unsafe outputs. Deduplication groups 50 of them into prompt-injection variants, 20 into sensitive-data exposure, and 10 into tool misuse. The raw failure rate is 40 percent, but the worklist is really three failure classes across several surfaces.',
        'Now assign severity. If 15 of the prompt-injection cases can trigger external tool calls, those outrank 35 cases that only produce disallowed text. If a fix blocks all 15 tool-call cases and reruns pass on two model versions, the queue can close one high-risk slice while leaving the lower-risk text cases open. Cost follows behavior: one owner fixes the tool boundary once, instead of debating 15 prompt strings separately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the OWASP Top 10 for LLM Applications for failure categories, MITRE ATLAS for adversarial technique framing, and the NIST AI Risk Management Framework for governance language. These sources help separate a prompt example from the risk claim it supports. Use product incident reviews to learn how ownership and rerun evidence work in practice.',
        'Next, study prompt injection, guardrail policy engines, judge calibration, and audit evidence packets. Those topics cover the attack surface, the runtime control, the scoring layer, and the evidence package that this queue feeds.',
      ],
    },
  ],
};
