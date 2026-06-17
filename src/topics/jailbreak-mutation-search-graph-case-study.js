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
      heading: 'Why this exists',
      paragraphs: [
        'Jailbreak mutation search exists because manual red-teaming finds important failures but does not scale across model versions, policies, tools, retrieval contexts, and product surfaces. Once a team has a seed failure, it needs to know whether nearby variants also break the system and whether a fix actually closes the family of failures.',
        'The danger is volume without learning. A generator can produce thousands of strange prompts that look adversarial but test the same boundary again and again. A safety team can then drown in duplicates while missing the one mutation that crosses from harmless text into a real tool, data, or policy failure.',
        'A mutation search graph turns red-team exploration into a data structure. It records the seed, mutation operator, parent relationship, target surface, model response, tool behavior, judge result, dedupe family, severity, rerun rate, fix status, and regression case. The goal is reproducible safety evidence, not prompt weirdness.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to generate a lot of jailbreak prompts and count successes. That is easy to automate and impressive in a dashboard. It fails because raw success count rewards duplicate tricks, judge quirks, unrealistic prompts, and attacks that do not map to product risk.',
        'Another shortcut is to keep only the final prompt string. That loses the lineage that explains how the failure was found. Without the parent seed, mutation operator, run configuration, scorer version, and rerun evidence, the team cannot tell whether the case is new, reproducible, or fixed.',
        'A third shortcut is to treat every policy violation as equally useful. In production, a mild text-format failure, an unauthorized tool call, a hidden retrieved instruction, and a secret exposure have different operational meanings. The search has to preserve that difference.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is provenance plus novelty. Mutation search is only useful if each promoted case tells a clear story: what boundary was tested, how the prompt changed, what evidence proves failure, how often it reproduces, and whether it belongs to a new failure family.',
        'Dedupe is not a cleanup step; it is central to the objective. Five hundred variants of the same role-play trick are not five hundred risks. A useful family key includes intent, product surface, mutation operator, violated control, evidence shape, and the system boundary crossed.',
        'The search graph also separates adversarial creativity from safety impact. The best branch is not the weirdest text. It is the branch that exposes a real weakness in instruction hierarchy, retrieval trust, tool scope, output handling, data access, or policy enforcement.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The loop starts with seed cases. A seed may be a known prompt injection, a failed policy refusal, a tool-scope issue, a retrieval poisoning case, or a harmful instruction pattern. Mutation operators then branch the seed through role framing, encoding, split instructions, translation, hidden context, retrieved-document text, output-format pressure, or tool-use pressure.',
        'Each candidate is executed against a target system configuration. The run captures model output, tool calls, retrieved context, policy decisions, hidden-state metadata that is safe to log, and any blocked or allowed action. A scorer then checks the result against policy ids, tool authorization, secret exposure, harmful instruction compliance, and reproducibility.',
        'Promising failures are rerun because stochastic systems can produce one-off breaks. A case that reproduces two out of three times is different from a single lucky completion. After scoring, dedupe collapses near-identical cases, and only novel severe families are promoted into a regression queue.',
        'The promoted case should include the original seed, mutation path, final prompt, response quote, judge version, system version, tool trace, severity, fix owner, and rerun command. That packet is what lets future releases test the same boundary again.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The mutation graph proves that every adversarial prompt needs lineage. A seed branches into role-play, encoding, indirection, and tool-context variants. The highlighted path is not important because it is clever; it is important because it crosses a real control boundary.',
        'The operator table proves that not all mutations carry equal risk. Cosmetic role-play may test refusal wording. Hidden retrieved instructions and tool-scope pressure test whether the product separates data from authority. Those are more important because they map to actual deployment failures.',
        'The raw-hit plot proves why success count is a bad metric. Raw hits can rise while deduped severe families flatten. That means the search is spending budget rediscovering the same failure instead of finding new boundaries.',
        'The scoring loop proves why promotion requires evidence. A failure packet should include response quote, policy id, tool authorization result, secret status, rerun rate, and judge version. Without those fields, the case is hard to reproduce and easy to misinterpret.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Mutation search works because many failures are local in prompt space and system-boundary space. A model that refuses a direct request may fail when the request is split, embedded in a retrieved document, translated, wrapped in a tool workflow, or attached to a weaker instruction hierarchy.',
        'It also works because the search can spend compute where humans have already found weak signals. Seeds encode expert intuition. Mutation operators explore neighborhoods around those seeds. Dedupe and scoring keep the system focused on unique severe risk rather than endless variants.',
        'Regression promotion is what makes the work compound. A discovered failure family should become a release gate. Future model, policy, retrieval, and tool changes should have to prove they did not reopen the same boundary.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The costs are query budget, scorer maintenance, triage time, storage, and reviewer attention. A broad mutation search can be expensive, especially when it runs against tool-using agents with retrieval and external side effects. Safe sandboxes and trace capture are mandatory.',
        'There is also a realism tradeoff. More exotic mutations can find surprising gaps, but they may not represent plausible product use. More realistic cases are easier to prioritize, but they may miss emerging attacks. A healthy queue includes both boundary realism and exploratory pressure.',
        'Scorer drift is another cost. If the judge changes, old severity scores may not be comparable. The ledger should record judge version and rerun important cases when policies or scorers change.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern is strongest for AI products with tools, retrieval, memory, file access, code execution, policy enforcement, or multiple instruction sources. Those products have real boundaries that prompt mutations can probe.',
        'It is useful for release gates, red-team campaigns, guardrail regression suites, policy migration, model upgrades, and incident follow-up. A corrective-action ledger can feed new seeds into mutation search so real incidents expand future eval coverage.',
        'It also helps compare defenses. If a fix only blocks one exact prompt but not its family, the mutation graph will show nearby failures still surviving. That is more useful than a single pass/fail demo.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Automated jailbreak search can optimize for judge quirks, generate unrealistic prompts, or flood teams with duplicates. It can also miss real incidents if it never touches tools, retrieval, output handling, permissions, or the product surfaces where users actually interact.',
        'Do not let the mutation engine become the metric. The metric is unique severe failure families found, fixed, and kept in regression. Search is a way to populate a safety queue, not a safety program by itself.',
        'Another failure is unsafe execution. Red-team automation should run in a sandbox with fake secrets, scoped tools, rate limits, and trace review. The search should never be allowed to create the harm it is supposed to detect.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: OWASP LLM01 Prompt Injection at https://genai.owasp.org/llmrisk/llm01-prompt-injection/, MITRE ATLAS at https://atlas.mitre.org/, NCSC prompt injection guidance at https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection, NIST AI RMF Playbook at https://airc.nist.gov/airmf-resources/playbook/, and Google SAIF at https://saif.google/. Study LLM Red-Team Attack Taxonomy Queue Case Study, AI Safety Eval Slice Risk Register Case Study, LLM Guardrail Policy Engine, Capability Security & Attenuation, Prompt Injection Threat Model, and Evolutionary Search next.',
      ],
    },
  ],
};
