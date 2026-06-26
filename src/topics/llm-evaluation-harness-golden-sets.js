// LLM evaluation harnesses: golden sets, judge rubrics, trace records, and
// regression gates for systems whose outputs are open-ended.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-evaluation-harness-golden-sets',
  title: 'LLM Evaluation Harnesses: Golden Sets and Judges',
  category: 'AI & ML',
  summary: 'Evaluate LLM systems with curated cases, rubric judges, traces, score matrices, holdouts, and regression gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['golden set', 'judge rubric'], defaultValue: 'golden set' },
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

function harnessGraph(title) {
  return graphState({
    nodes: [
      { id: 'traces', label: 'traces', x: 0.8, y: 3.5, note: 'real use' },
      { id: 'golden', label: 'golden set', x: 2.5, y: 2.0, note: 'curated' },
      { id: 'holdout', label: 'holdout', x: 2.5, y: 5.3, note: 'sealed' },
      { id: 'runner', label: 'runner', x: 4.5, y: 3.5, note: 'replay' },
      { id: 'variant', label: 'variant', x: 6.2, y: 2.0, note: 'model' },
      { id: 'scorers', label: 'scorers', x: 6.2, y: 5.3, note: 'metrics' },
      { id: 'matrix', label: 'score matrix', x: 8.1, y: 3.5, note: 'compare' },
      { id: 'gate', label: 'gate', x: 9.4, y: 5.3, note: 'ship?' },
    ],
    edges: [
      { id: 'e-traces-golden', from: 'traces', to: 'golden' },
      { id: 'e-traces-holdout', from: 'traces', to: 'holdout' },
      { id: 'e-golden-runner', from: 'golden', to: 'runner' },
      { id: 'e-holdout-runner', from: 'holdout', to: 'runner' },
      { id: 'e-runner-variant', from: 'runner', to: 'variant' },
      { id: 'e-runner-scorers', from: 'runner', to: 'scorers' },
      { id: 'e-variant-matrix', from: 'variant', to: 'matrix' },
      { id: 'e-scorers-matrix', from: 'scorers', to: 'matrix' },
      { id: 'e-matrix-gate', from: 'matrix', to: 'gate' },
    ],
  }, { title });
}

function judgeGraph(title) {
  return graphState({
    nodes: [
      { id: 'case', label: 'case', x: 0.8, y: 3.7, note: 'input' },
      { id: 'answer', label: 'answer', x: 2.7, y: 2.1, note: 'candidate' },
      { id: 'reference', label: 'reference', x: 2.7, y: 5.3, note: 'target' },
      { id: 'rubric', label: 'rubric', x: 4.9, y: 3.7, note: 'criteria' },
      { id: 'judge', label: 'judge', x: 6.7, y: 3.7, note: 'score' },
      { id: 'rationale', label: 'rationale', x: 8.5, y: 2.1, note: 'why' },
      { id: 'audit', label: 'audit', x: 8.5, y: 5.3, note: 'human' },
    ],
    edges: [
      { id: 'e-case-answer', from: 'case', to: 'answer' },
      { id: 'e-case-reference', from: 'case', to: 'reference' },
      { id: 'e-answer-rubric', from: 'answer', to: 'rubric' },
      { id: 'e-reference-rubric', from: 'reference', to: 'rubric' },
      { id: 'e-rubric-judge', from: 'rubric', to: 'judge' },
      { id: 'e-judge-rationale', from: 'judge', to: 'rationale' },
      { id: 'e-judge-audit', from: 'judge', to: 'audit' },
    ],
  }, { title });
}

function* goldenSet() {
  yield {
    state: harnessGraph('An eval harness replays real cases through variants'),
    highlight: { active: ['traces', 'golden', 'runner', 'variant', 'scorers', 'e-traces-golden', 'e-golden-runner', 'e-runner-variant', 'e-runner-scorers'], found: ['matrix'] },
    explanation: `An ${topic.category} eval harness is a replay system. Curated cases enter a runner, model or prompt variants produce outputs, scorers measure them, and a score matrix decides whether the change regressed the product.`,
  };

  yield {
    state: labelMatrix(
      'Eval case schema',
      [
        { id: 'input', label: 'input' },
        { id: 'context', label: 'context' },
        { id: 'expected', label: 'expected' },
        { id: 'metadata', label: 'metadata' },
      ],
      [
        { id: 'field', label: 'field' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['prompt or task', 'replay exact request'],
        ['retrieved docs or tools', 'freeze evidence'],
        ['answer, rubric, or property', 'define success'],
        ['domain, risk, cost', 'slice results'],
      ],
    ),
    highlight: { active: ['input:field', 'context:field', 'expected:field', 'metadata:field'] },
    explanation: `The case is the primary data structure in ${topic.category} evaluation. It should include enough state to reproduce the decision: input, retrieved context, tool trace, expected behavior, tags, and risk class.`,
    invariant: `An eval without replayable context is only a vibe check â€” ${topic.title.split(':')[0].toLowerCase()} demands reproducible evidence.`,
  };

  yield {
    state: harnessGraph('Separate dev set from sealed holdout'),
    highlight: { active: ['golden', 'holdout', 'runner', 'e-golden-runner', 'e-holdout-runner'], compare: ['gate'] },
    explanation: `Use a visible development set to tune prompts and models. Keep a sealed holdout for final checks. Repeatedly peeking at the same ${topic.id.includes('golden') ? 'golden set' : 'eval set'} wears it out, just like a test set in Cross-Validation & Honest Evaluation.`,
  };

  yield {
    state: labelMatrix(
      'Score matrix for a model upgrade',
      [
        { id: 'factual', label: 'factuality' },
        { id: 'format', label: 'format' },
        { id: 'safety', label: 'safety' },
        { id: 'latency', label: 'latency' },
      ],
      [
        { id: 'old', label: 'old model' },
        { id: 'new', label: 'new model' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['91%', '94%', 'pass'],
        ['99%', '98%', 'pass'],
        ['97%', '93%', 'block'],
        ['1.8s', '1.2s', 'pass'],
      ],
    ),
    highlight: { found: ['factual:new', 'latency:new'], removed: ['safety:gate'] },
    explanation: `Averages are not enough. The new model can be faster and more factual while still failing a safety or policy slice. Gates in an ${topic.category} harness should be per critical dimension, not only one blended score.`,
  };
}

function* judgeRubric() {
  yield {
    state: judgeGraph('A judge needs a rubric, not just an opinion'),
    highlight: { active: ['case', 'answer', 'reference', 'rubric', 'judge', 'e-answer-rubric', 'e-reference-rubric', 'e-rubric-judge'], found: ['rationale'] },
    explanation: `LLM-as-a-judge is useful when exact answers are too narrow, but the judge must receive a stable rubric. In ${topic.title.split(':')[1].trim()}, the output should include a score and a short rationale so humans can audit disagreements.`,
  };

  yield {
    state: labelMatrix(
      'Scorer types',
      [
        { id: 'exact', label: 'exact match' },
        { id: 'property', label: 'property check' },
        { id: 'rubric', label: 'rubric judge' },
        { id: 'pairwise', label: 'pairwise judge' },
        { id: 'human', label: 'human audit' },
      ],
      [
        { id: 'best', label: 'best for' },
        { id: 'failure', label: 'failure mode' },
      ],
      [
        ['known answer', 'too brittle'],
        ['schema or citation', 'misses nuance'],
        ['open text quality', 'judge bias'],
        ['A/B preference', 'position bias'],
        ['high-stakes slices', 'costly and slow'],
      ],
    ),
    highlight: { active: ['exact:best', 'property:best', 'rubric:best', 'pairwise:best'], compare: ['human:failure'] },
    explanation: `Different outputs need different scorers. A math answer can use exact or tolerance checks. A RAG answer needs citation and faithfulness checks. ${topic.category} systems may need rubric and human audit for open-ended replies.`,
  };

  yield {
    state: judgeGraph('Audit the judge like any other model'),
    highlight: { active: ['judge', 'rationale', 'audit', 'e-judge-rationale', 'e-judge-audit'], compare: ['rubric'] },
    explanation: `Judges are models too. They can prefer verbosity, familiar style, their own model family, or the first answer shown. ${topic.title.split(':')[0]} Judge Calibration & Drift Monitor turns that risk into anchor sets, bias probes, and slice gates.`,
    invariant: `A judge score is evidence, not truth â€” every ${topic.category} evaluation must treat it as one signal among many.`,
  };

  yield {
    state: labelMatrix(
      'Failure slices to keep visible',
      [
        { id: 'retrieval', label: 'retrieval miss' },
        { id: 'policy', label: 'policy edge' },
        { id: 'rare', label: 'rare entity' },
        { id: 'attack', label: 'attack case' },
      ],
      [
        { id: 'why', label: 'why special' },
        { id: 'linked topic', label: 'linked topic' },
      ],
      [
        ['answer absent from context', 'Multi-Index RAG'],
        ['must refuse or escalate', 'Prompt Injection Threat Model'],
        ['average hides tail', 'Benchmark Variance'],
        ['adaptive attacker', 'Adversarial Examples'],
      ],
    ),
    highlight: { active: ['retrieval:why', 'policy:why', 'rare:why', 'attack:why'] },
    explanation: `Great eval suites for ${topic.category} are not random samples only. They include failure slices that product teams care about: retrieval misses, policy edges, rare entities, adversarial prompts, and expensive regressions.`,
  };

  yield {
    state: labelMatrix(
      'Eval operating loop',
      [
        { id: 'collect', label: 'collect' },
        { id: 'label', label: 'label' },
        { id: 'run', label: 'run' },
        { id: 'inspect', label: 'inspect' },
        { id: 'refresh', label: 'refresh' },
      ],
      [
        { id: 'artifact', label: 'artifact' },
        { id: 'risk', label: 'risk if skipped' },
      ],
      [
        ['production traces', 'toy coverage'],
        ['rubrics and references', 'ambiguous scores'],
        ['versioned harness', 'unreproducible wins'],
        ['diffs and rationales', 'silent regressions'],
        ['new holdout cases', 'eval overfit'],
      ],
    ),
    highlight: { found: ['collect:artifact', 'label:artifact', 'run:artifact', 'inspect:artifact', 'refresh:artifact'] },
    explanation: `${topic.title.split(':')[0]} evals are a living system. As users, prompts, models, and attacks change, the suite must absorb new cases without turning the final holdout into the development set.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'golden set') yield* goldenSet();
  else if (view === 'judge rubric') yield* judgeRubric();
  else throw new InputError('Pick an LLM evaluation view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as an evidence pipeline. Traces become curated cases, cases enter a runner, candidate systems produce outputs, scorers measure behavior, and gates decide whether a change can ship. Active nodes show the artifact currently being transformed, while found nodes show evidence strong enough to affect a release decision.',
        {type: 'image', src: './assets/gifs/llm-evaluation-harness-golden-sets.gif', alt: 'Animated walkthrough of the llm evaluation harness golden sets visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        {type: 'callout', text: 'An eval case is a replayable evidence packet: input, context, expected behavior, scorer, trace, and risk slice travel together.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM applications produce open-ended behavior, not just exact return values. A support agent may retrieve documents, call tools, refuse unsafe requests, cite sources, and explain a decision. An evaluation harness exists because a normal unit test cannot capture that full behavior without replayable context and structured scoring.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'An eval harness is a directed evidence flow: traces become cases, cases enter runners, scorers produce release-gate evidence. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is manual spot checking. Read several outputs from the new model or prompt, decide whether they look better, and ship if the examples feel improved. This is useful for exploration because humans can notice failure types before a rubric exists.',
        'The next obvious approach is one blended score. It feels cleaner than anecdotes, but it can hide the failure that matters. A model can improve average helpfulness while getting worse on safety, citation support, latency, cost, or rare entities.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is multidimensional quality. LLM behavior has slices: topic, risk level, language, user type, retrieval condition, tool path, attack family, and cost class. Collapsing those slices into one number destroys the evidence needed to make a safe release decision.',
        'The second wall is eval overfitting. If engineers tune against the same visible cases every day, the cases stop measuring generalization. The harness needs a development set for debugging and a protected holdout for release confidence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The eval case is the primary data structure. It should carry the task input, retrieved context, expected behavior, scorer, trace, tags, and risk slice. The model, prompt, retriever, and judge can change, but the case preserves what the system was supposed to prove.',
        'The score matrix is the second key structure. Rows should preserve cases or slices, and columns should preserve dimensions such as factuality, format, policy, latency, and cost. A release gate should be allowed to block on one critical regression even when the average improves.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A harness starts by collecting real traces and turning them into cases. A runner replays each case through candidate systems such as old model, new model, old prompt, new prompt, changed retriever, or changed tool policy. Scorers then produce deterministic checks, rubric judgments, pairwise preferences, latency numbers, and cost measurements.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree model diagram', caption: 'A useful rubric behaves like a decision structure: each criterion narrows why an answer passed, failed, or needs audit. Source: Wikimedia Commons, CC BY-SA 4.0.'},
        'LLM-as-a-judge is useful when exact answers are too narrow, but the judge needs a stable rubric and audit trail. The output should include a score, rationale, and enough case context for humans to inspect disagreements. Judge scores are evidence, not ground truth.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because replay makes comparison fair. If the old and new systems see the same input, context, tool state, and scorer, a difference in score is more likely to reflect the changed system rather than a changed environment. Versioning turns the run into an experiment instead of a memory of what happened.',
        'Correctness comes from preserving the question each case asks. A citation case must freeze source context, a tool case must freeze expected tool behavior, and a safety case must freeze the policy expectation. When those fields travel with the case, failures can be reproduced and fixed rather than debated from screenshots.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost grows with case count, model calls, judge calls, retrieval replay, tool simulation, human labels, and variant count. If 500 cases run through 2 models and each output gets one judge call, the run can require 1,000 generation calls plus 1,000 judge calls. Cheap deterministic checks should run before expensive judges.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density curves', caption: 'Repeated eval runs should be read as sampled measurements, not single absolute truths; variance decides whether a score change is meaningful. Source: Wikimedia Commons, Inductiveload, public domain.'},
        'Variance is part of cost. A 1 point score lift on 40 cases may be noise, while the same lift on 4,000 stable cases may matter. Store case version, prompt version, model version, scorer version, judge version, random seed, and retrieval index version so later comparisons have a fixed reference.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Evaluation harnesses are useful for model upgrades, prompt changes, RAG retriever changes, tool-call policies, agent loops, safety policy updates, summarizers, extractors, and support copilots. They are strongest when production failures become durable cases, so the same mistake cannot quietly return. The harness turns incident memory into a regression test.',
        'They also create a release language. A team can say the new model improved factuality on normal support cases but failed the refund-policy edge slice. That sentence is more useful than a single leaderboard score because it maps directly to product risk.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when cases are toy prompts disconnected from real users. It fails when a judge model is treated as truth, when slices are averaged away, or when a protected holdout becomes a tuning target. It also fails when traces omit the retrieved documents or tool observations that explain why an answer passed.',
        'A harness can also become too expensive to run often. If every small prompt change requires a full slow suite, teams will skip it. Practical systems use tiers: fast smoke checks, changed-slice runs, nightly broader runs, and protected release gates.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support copilot has 200 refund-policy cases. The old model passes 184, while the new model passes 190, so the average pass rate rises from 92% to 95%. The slice matrix shows the dangerous detail: retrieval-missing cases fall from 38 of 40 passed to 30 of 40 passed.',
        'The failed cases show the new model answers confidently when the policy document is absent. The fix is to add a groundedness scorer and a gate requiring abstention when evidence is missing. The release decision changes because the harness kept the slice visible instead of hiding it inside the average.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the OpenAI Evals repository at https://github.com/openai/evals, HELM at https://crfm.stanford.edu/helm/, and the HELM paper at https://arxiv.org/abs/2211.09110. For judge risks, study LLM-as-a-judge calibration and compare model ratings with human anchor cases.',
        'Study cross-validation for holdout discipline, benchmark variance for confidence, calibration for probability claims, RAG evaluation for groundedness, and audit evidence packets for trace design. The next exercise is to write one eval case that includes input, context, expected behavior, scorer, and risk slice.',
      ],
    },
  ],
};
