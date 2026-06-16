// Jailbreak mutation search: generate adversarial prompt variants, score
// failures, dedupe near-duplicates, and preserve the route that found a break.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'jailbreak-mutation-search-graph-case-study',
  title: 'Jailbreak Mutation Search Graph Case Study',
  category: 'AI & ML',
  summary: 'A red-team automation case study: mutate prompts through a search graph, score guardrail failures, prune duplicates, and promote reproducible jailbreak cases.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['mutation graph', 'scoring loop'], defaultValue: 'mutation graph' },
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

function searchGraph(title) {
  return graphState({
    nodes: [
      { id: 'seed', label: 'seed', x: 0.7, y: 3.4, note: 'case' },
      { id: 'role', label: 'role', x: 2.3, y: 1.5, note: 'mut' },
      { id: 'enc', label: 'enc', x: 2.3, y: 3.4, note: 'mut' },
      { id: 'ind', label: 'ind', x: 2.3, y: 5.3, note: 'mut' },
      { id: 'run1', label: 'run', x: 4.0, y: 2.2, note: 'model' },
      { id: 'run2', label: 'run', x: 4.0, y: 4.6, note: 'model' },
      { id: 'score', label: 'score', x: 5.8, y: 3.4, note: 'judge' },
      { id: 'dedupe', label: 'dup', x: 7.3, y: 2.2, note: 'hash' },
      { id: 'promote', label: 'keep', x: 7.3, y: 4.6, note: 'case' },
      { id: 'queue', label: 'queue', x: 9.0, y: 3.4, note: 'red' },
    ],
    edges: [
      { id: 'e-seed-role', from: 'seed', to: 'role' },
      { id: 'e-seed-enc', from: 'seed', to: 'enc' },
      { id: 'e-seed-ind', from: 'seed', to: 'ind' },
      { id: 'e-role-run1', from: 'role', to: 'run1' },
      { id: 'e-enc-run1', from: 'enc', to: 'run1' },
      { id: 'e-ind-run2', from: 'ind', to: 'run2' },
      { id: 'e-run1-score', from: 'run1', to: 'score' },
      { id: 'e-run2-score', from: 'run2', to: 'score' },
      { id: 'e-score-dedupe', from: 'score', to: 'dedupe' },
      { id: 'e-score-promote', from: 'score', to: 'promote' },
      { id: 'e-dedupe-queue', from: 'dedupe', to: 'queue' },
      { id: 'e-promote-queue', from: 'promote', to: 'queue' },
    ],
  }, { title });
}

function* mutationGraph() {
  yield {
    state: searchGraph('Jailbreak mutation search graph'),
    highlight: { active: ['seed', 'role', 'enc', 'ind', 'e-seed-role', 'e-seed-enc', 'e-seed-ind'], compare: ['run1', 'run2'], found: ['queue'] },
    explanation: 'Automated red-teaming is a search problem. Start with a seed case, mutate it through role-play, encoding, indirection, translation, or tool-context variants, then score which branches break controls.',
    invariant: 'Mutation search should discover reproducible failures, not maximize prompt weirdness.',
  };

  yield {
    state: labelMatrix(
      'Mutation operators',
      [
        { id: 'role', label: 'role' },
        { id: 'enc', label: 'enc' },
        { id: 'split', label: 'split' },
        { id: 'rag', label: 'RAG' },
        { id: 'tool', label: 'tool' },
      ],
      [
        { id: 'op', label: 'op' },
        { id: 'risk', label: 'risk' },
        { id: 'keep', label: 'keep' },
      ],
      [
        ['persona', 'low', 'some'],
        ['base64', 'med', 'some'],
        ['parts', 'med', 'yes'],
        ['hidden', 'high', 'yes'],
        ['scope', 'crit', 'yes'],
      ],
    ),
    highlight: { active: ['split:keep', 'rag:keep', 'tool:keep'], compare: ['role:keep', 'enc:keep'], found: ['tool:risk'] },
    explanation: 'Useful operators target real boundaries: hidden retrieved text, split instructions, tool scopes, output handling, or secret access. Cosmetic obfuscation has lower value unless it exposes a real control gap.',
  };

  yield {
    state: searchGraph('Dedupe prevents prompt spam from faking coverage'),
    highlight: { active: ['score', 'dedupe', 'promote', 'e-score-dedupe', 'e-score-promote'], compare: ['role', 'enc'], found: ['queue'] },
    explanation: 'A search can generate thousands of near-identical strings. Dedupe by normalized intent, attack surface, failure mode, and output evidence so one trick does not masquerade as broad coverage.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'search budget', min: 0, max: 1000 }, y: { label: 'unique severe failures', min: 0, max: 40 } },
      series: [
        { id: 'raw', label: 'raw hits', points: [{ x: 50, y: 4 }, { x: 200, y: 17 }, { x: 500, y: 31 }, { x: 800, y: 36 }, { x: 1000, y: 38 }] },
        { id: 'deduped', label: 'deduped', points: [{ x: 50, y: 3 }, { x: 200, y: 9 }, { x: 500, y: 15 }, { x: 800, y: 17 }, { x: 1000, y: 18 }] },
      ],
      markers: [
        { id: 'flat', x: 760, y: 17, label: 'plateau' },
      ],
    }),
    highlight: { active: ['deduped', 'flat'], compare: ['raw'] },
    explanation: 'Raw hit count can keep rising after novelty plateaus. The metric that matters is unique severe failure families per budget, not the number of prompt variants generated.',
  };
}

function* scoringLoop() {
  yield {
    state: searchGraph('Scoring loop promotes reproducible breaks'),
    highlight: { active: ['run1', 'run2', 'score', 'promote', 'queue', 'e-run1-score', 'e-run2-score', 'e-score-promote', 'e-promote-queue'], compare: ['dedupe'] },
    explanation: 'The scorer decides whether a response actually violates policy, exposes secrets, crosses tool scope, or creates harmful instructions. A promoted case needs rerun evidence, not one lucky response.',
  };

  yield {
    state: labelMatrix(
      'Failure scoring packet',
      [
        { id: 'out', label: 'out' },
        { id: 'pol', label: 'pol' },
        { id: 'tool', label: 'tool' },
        { id: 'sec', label: 'sec' },
        { id: 'rep', label: 'rep' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'value', label: 'value' },
      ],
      [
        ['text', 'quote'],
        ['rule', 'LLM01'],
        ['scope', 'bad'],
        ['secret', 'none'],
        ['rerun', '2/3'],
      ],
    ),
    highlight: { active: ['pol:value', 'tool:value', 'rep:value'], compare: ['sec:value'], found: ['out:value'] },
    explanation: 'A score packet stores response evidence, policy id, tool authorization result, secret exposure status, rerun rate, and judge version. That makes failures reproducible and debuggable.',
  };

  yield {
    state: labelMatrix(
      'Complete case: tool-scope bypass',
      [
        { id: 'a', label: 'seed' },
        { id: 'b', label: 'mut1' },
        { id: 'c', label: 'mut2' },
        { id: 'd', label: 'fix' },
      ],
      [
        { id: 'prompt', label: 'prompt' },
        { id: 'result', label: 'res' },
        { id: 'act', label: 'act' },
      ],
      [
        ['ask', 'deny', 'mut'],
        ['role', 'deny', 'drop'],
        ['RAG', 'tool', 'keep'],
        ['scope', 'deny', 'pass'],
      ],
    ),
    highlight: { active: ['a:act', 'c:act', 'd:act'], removed: ['b:act'], found: ['d:result'] },
    explanation: 'A normal prompt is denied. A role-play mutation is also denied. An indirect RAG mutation triggers an unauthorized tool call, so it is promoted. The fix adds capability scoping and the rerun passes.',
  };

  yield {
    state: searchGraph('Promoted cases feed regression gates'),
    highlight: { active: ['promote', 'queue', 'e-promote-queue'], found: ['score', 'dedupe'], compare: ['seed'] },
    explanation: 'A promoted jailbreak becomes a regression case in the red-team queue. Future releases must pass it or explicitly document why the system boundary changed.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'mutation graph') yield* mutationGraph();
  else if (view === 'scoring loop') yield* scoringLoop();
  else throw new InputError('Pick a jailbreak mutation-search view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A jailbreak mutation search graph is an automated red-team data structure. It starts from seed cases, applies mutation operators, evaluates model and tool behavior, scores failures, dedupes near-duplicates, and promotes reproducible severe cases.',
        'LLM Red-Team Attack Taxonomy Queue Case Study explains what should be tested. This module explains how adversarial cases can be expanded without losing provenance or inflating coverage with duplicates.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The graph stores seed case id, mutation operator, parent prompt, target surface, generated prompt, model output, tool calls, scorer result, severity, dedupe key, rerun count, and promoted regression id.',
        'Dedupe is essential. A search that produces 500 variants of the same role-play trick has not found 500 risks. Family hashes should include intent, surface, control bypass, and evidence shape.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Mutation operators transform seed cases through role framing, encoding, split instructions, retrieved-document instructions, tool-scope pressure, or output-format pressure. The runtime executes candidates, scores outputs, reruns promising failures, and promotes only reproducible novel families.',
        'A good search balances exploration and realism. Weird strings are not automatically useful. The strongest cases usually expose real boundaries: data vs instruction, user vs tool authority, trusted vs untrusted retrieval, and policy vs execution.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A seed asks for a forbidden action and is denied. Role-play mutations also fail. An indirect RAG mutation hides instructions in a retrieved document and causes the agent to call an unauthorized tool. The scorer flags tool-scope violation, reruns the case, dedupes it as a new failure family, and promotes it to the regression queue.',
        'The mitigation is capability scoping, not just better wording. After the fix, the same mutation is rerun and the tool call is denied. The graph keeps both the break and the fix proof.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Automated jailbreak search can optimize for judge quirks, generate unrealistic prompts, or flood teams with duplicates. It can also miss real incidents if it never touches tools, retrieval, output handling, or permissions.',
        'Do not let the mutation engine become the metric. The metric is unique severe failure families found, fixed, and kept in regression. Search is a way to populate a safety queue, not a safety program by itself.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OWASP LLM01 Prompt Injection at https://genai.owasp.org/llmrisk/llm01-prompt-injection/, MITRE ATLAS at https://atlas.mitre.org/, NCSC prompt injection guidance at https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection, NIST AI RMF Playbook at https://airc.nist.gov/airmf-resources/playbook/, and Google SAIF at https://saif.google/.',
        'Study next: LLM Red-Team Attack Taxonomy Queue Case Study, AI Safety Eval Slice Risk Register Case Study, LLM Guardrail Policy Engine, Capability Security & Attenuation, Prompt Injection Threat Model, and Evolutionary Search.',
      ],
    },
  ],
};
