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
    explanation: 'The search graph treats automated red-teaming as branching exploration. A seed case mutates through role-play, encoding, indirection, translation, or tool context, and only branches that expose control failures earn attention.',
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
    explanation: 'The operator matrix separates boundary tests from cosmetic weirdness. Hidden retrieved text, split instructions, tool scopes, output handling, and secret access matter because they test where the system can actually fail.',
  };

  yield {
    state: searchGraph('Dedupe prevents prompt spam from faking coverage'),
    highlight: { active: ['score', 'dedupe', 'promote', 'e-score-dedupe', 'e-score-promote'], compare: ['role', 'enc'], found: ['queue'] },
    explanation: 'Dedupe protects the coverage invariant. Thousands of near-identical strings should collapse to one family keyed by intent, surface, failure mode, and evidence shape.',
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
    explanation: 'The plot shows why raw hits are a bad reward. After novelty plateaus, more variants may only rediscover the same break; the useful metric is unique severe failure families per budget.',
  };
}

function* scoringLoop() {
  yield {
    state: searchGraph('Scoring loop promotes reproducible breaks'),
    highlight: { active: ['run1', 'run2', 'score', 'promote', 'queue', 'e-run1-score', 'e-run2-score', 'e-score-promote', 'e-promote-queue'], compare: ['dedupe'] },
    explanation: 'The scorer turns a model response into evidence. It checks policy violation, secret exposure, tool scope, harmful instruction, and reproducibility before a case can be promoted.',
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
    explanation: 'The score packet stores the proof fields that make a failure replayable: response quote, policy id, tool authorization result, secret status, rerun rate, and judge version.',
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
    explanation: 'The complete case shows promotion by evidence, not novelty. The plain and role-play prompts fail to bypass controls; the indirect RAG mutation triggers an unauthorized tool call, so the fix narrows capability and the rerun must pass.',
  };

  yield {
    state: searchGraph('Promoted cases feed regression gates'),
    highlight: { active: ['promote', 'queue', 'e-promote-queue'], found: ['score', 'dedupe'], compare: ['seed'] },
    explanation: 'Promotion sends the failure into the regression queue. Future releases must pass the same family or document why the boundary changed enough that the old case no longer applies.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a mutation search graph for AI safety testing. A seed is an initial failure or risky prompt. A mutation operator changes the seed, for example by splitting instructions, changing context, adding retrieval text, or applying tool pressure. A node is one candidate test case with evidence attached.',
        'Active nodes are candidates being generated, executed, scored, deduplicated, or promoted. Found nodes are reproducible severe cases or regression tests. Compare nodes show near-duplicates, weak failures, or cases that do not cross a real product boundary. The graph matters because lineage explains how a failure family was found.',
        {type:'callout', text:'A mutation graph turns red-team exploration from prompt volume into reproducible evidence about families of failures and fixes.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Manual red-teaming finds important failures, but it does not scale across model versions, policies, retrieval systems, tools, and product surfaces. Once a team has one seed failure, it needs to know whether nearby variants still break the system and whether a fix closes the family.',
        'Jailbreak here means an input or context pattern that causes the system to violate its intended policy or authority boundary. Mutation search exists to explore related cases with provenance, not to celebrate strange prompts.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to generate thousands of adversarial prompts and count successes. That creates an impressive chart and may find real failures. It also rewards duplicates, unrealistic phrasing, and judge quirks.',
        'Another shortcut is to keep only the final prompt string. That loses the seed, mutation path, system version, scorer version, response evidence, tool trace, and rerun rate. Without those fields, the team cannot tell whether a case is new, reproducible, or fixed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that prompt volume is not safety evidence. Five hundred variants of the same role-play trick are one failure family if they cross the same boundary in the same way. A single prompt that triggers an unauthorized tool call may be more important than many text-only refusal misses.',
        'The second wall is reproducibility. Models can be stochastic, judges can drift, policies change, and tool environments differ. A case that fails once without a rerun packet is weak evidence for release gating.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat red-team exploration as a graph with provenance and novelty. Each candidate records parent, operator, target surface, model response, tool behavior, policy result, judge version, severity, family key, and fix status. The search promotes failure families, not raw prompt count.',
        'The invariant is evidence before promotion. A case should move into the regression queue only when it has a clear boundary crossed, a reproducible trace, and enough metadata for a future release to rerun it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The loop starts with seed cases from incidents, manual red teams, known prompt-injection patterns, policy misses, tool-scope issues, or retrieval poisoning. Mutation operators create children by changing language, splitting instructions, placing text in retrieved documents, adding format pressure, or routing through tools.',
        'Each candidate runs in a sandboxed target configuration. The trace captures prompt, retrieved context, model output, tool calls, permission decisions, policy ids, and safe metadata. A scorer labels outcome and severity, reruns promising cases, deduplicates by family, and promotes only novel reproducible failures.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works because failures often have neighborhoods. A direct unsafe request may be refused, while the same intent embedded in retrieved text, split across messages, or paired with a tool workflow may cross a weaker boundary. Seeds focus compute on neighborhoods with known risk.',
        'Dedupe and rerun protect the result. Dedupe prevents the search from spending budget on the same trick. Reruns separate a stable failure from one lucky completion. Regression promotion makes discoveries compound across model and policy releases.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is model budget, tool sandboxing, scorer maintenance, storage, and human triage. If 10,000 candidates cost $0.03 each to run and score, one sweep costs $300 before review time. Tool-using agents cost more because safe execution and trace capture are required.',
        'Cost also appears as attention pressure on the safety team. A queue of 2,000 near-duplicates can hide 5 severe novel failures. The graph must optimize for unique severe families found, fixed, and kept in regression, not for raw hits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits AI products with tools, retrieval, memory, file access, code execution, policy enforcement, or multiple instruction sources. Those systems have boundaries that prompt mutations can probe: data versus authority, user versus developer instruction, retrieval versus trusted control, and tool permission versus model desire.',
        'It is useful for release gates, incident follow-up, model upgrades, policy migrations, guardrail comparisons, and regression suites. A fix is stronger when the mutation graph shows nearby variants closed, not just one exact prompt blocked.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The search fails when it optimizes for judge quirks or unrealistic prompts. It also fails when it never touches the real product surfaces where harm occurs, such as tools, retrieved documents, hidden system instructions, file outputs, or permission checks.',
        'It can become unsafe if automation is allowed to execute real harmful actions. Runs should use fake secrets, scoped tools, rate limits, blocked external effects, and trace review. The test harness must not create the harm it is measuring.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with 20 seed prompt-injection cases against a document QA agent. Each seed creates 30 mutations, so the first generation has 600 candidates. At $0.02 per candidate, the run costs $12 before human review.',
        'The raw scorer finds 90 hits. Dedupe collapses them into 7 families. Reruns show that 3 families reproduce at least 2 out of 3 times. One family causes an unauthorized tool call when the instruction is hidden in retrieved text, with severity high. That case enters regression with seed, mutation path, final prompt, retrieved document, tool trace, judge version, and fix owner.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OWASP LLM01 Prompt Injection at https://genai.owasp.org/llmrisk/llm01-prompt-injection/, MITRE ATLAS at https://atlas.mitre.org/, NCSC prompt injection guidance at https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection, NIST AI RMF Playbook at https://airc.nist.gov/airmf-resources/playbook/, and Google SAIF at https://saif.google/.',
        'Study prompt injection threat models, capability security, tool permission design, AI safety evals, mutation testing, evolutionary search, deduplication, trace logging, and regression testing next. The practical exercise is to convert one seed failure into a rerunnable family packet.',
      ],
    },
  ],
};