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
    explanation: 'An LLM eval harness is a replay system. Curated cases enter a runner, model or prompt variants produce outputs, scorers measure them, and a score matrix decides whether the change regressed the product.',
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
    explanation: 'The case is the primary data structure. It should include enough state to reproduce the decision: input, retrieved context, tool trace, expected behavior, tags, and risk class.',
    invariant: 'An eval without replayable context is only a vibe check.',
  };

  yield {
    state: harnessGraph('Separate dev set from sealed holdout'),
    highlight: { active: ['golden', 'holdout', 'runner', 'e-golden-runner', 'e-holdout-runner'], compare: ['gate'] },
    explanation: 'Use a visible development set to tune prompts and models. Keep a sealed holdout for final checks. Repeatedly peeking at the same eval set wears it out, just like a test set in Cross-Validation & Honest Evaluation.',
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
    explanation: 'Averages are not enough. The new model can be faster and more factual while still failing a safety or policy slice. Gates should be per critical dimension, not only one blended score.',
  };
}

function* judgeRubric() {
  yield {
    state: judgeGraph('A judge needs a rubric, not just an opinion'),
    highlight: { active: ['case', 'answer', 'reference', 'rubric', 'judge', 'e-answer-rubric', 'e-reference-rubric', 'e-rubric-judge'], found: ['rationale'] },
    explanation: 'LLM-as-a-judge is useful when exact answers are too narrow, but the judge must receive a stable rubric. The output should include a score and a short rationale so humans can audit disagreements.',
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
    explanation: 'Different outputs need different scorers. A math answer can use exact or tolerance checks. A RAG answer needs citation and faithfulness checks. A support reply may need rubric and human audit.',
  };

  yield {
    state: judgeGraph('Audit the judge like any other model'),
    highlight: { active: ['judge', 'rationale', 'audit', 'e-judge-rationale', 'e-judge-audit'], compare: ['rubric'] },
    explanation: 'Judges are models too. They can prefer verbosity, familiar style, their own model family, or the first answer shown. LLM Judge Calibration & Drift Monitor turns that risk into anchor sets, bias probes, and slice gates.',
    invariant: 'A judge score is evidence, not truth.',
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
    explanation: 'Great eval suites are not random samples only. They include failure slices that product teams care about: retrieval misses, policy edges, rare entities, adversarial prompts, and expensive regressions.',
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
    explanation: 'LLM evals are a living system. As users, prompts, models, and attacks change, the suite must absorb new cases without turning the final holdout into the development set.',
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
      heading: 'What it is',
      paragraphs: [
        'An LLM evaluation harness is a repeatable way to score an LLM model, prompt, retrieval pipeline, agent, or full application against cases that matter. The goal is not to imitate conventional unit tests for every concept in this educational repo. The useful artifact is an eval case: a replayable task with input, context, expected behavior, metadata, scorer, and trace.',
        'OpenAI describes evals as tests that check whether model outputs meet specified style and content criteria: https://developers.openai.com/api/docs/guides/evals. OpenAI Evals provides a framework and registry for evaluating LLMs and systems built with LLMs: https://github.com/openai/evals. EleutherAI lm-evaluation-harness is a widely used framework for few-shot language-model benchmark evaluation: https://github.com/EleutherAI/lm-evaluation-harness.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A harness stores cases in a structured format. Each case may include the user task, retrieved documents, tool trace, expected facts, disallowed behavior, labels, and slices such as domain, risk, language, customer type, or attack family. A runner replays those cases through candidate systems. Scorers compute exact match, schema validity, citation support, faithfulness, latency, cost, refusal quality, rubric score, or pairwise preference. The result is a score matrix, not one magic number.',
        'RAG Evaluation: RAGAS, ARES, and the RAG Triad is the specialized version for retrieval-augmented systems. It splits retrieval recall, context precision, groundedness, and answer relevance so teams can see whether the index, reranker, generator, or judge failed.',
        'Golden sets are curated and visible enough for development. Holdouts are sealed and used sparingly. This mirrors Cross-Validation & Honest Evaluation and Data Leakage & Contamination: if teams tune every prompt against the final eval set, the eval stops measuring generalization. For agents, traces are crucial because a correct final answer can hide unsafe tool use, excessive retries, or missing evidence.',
      ],
    },
    {
      heading: 'Judges and rubrics',
      paragraphs: [
        'LLM-as-a-judge is useful when output quality is open-ended. The judge receives the case, candidate answer, reference material, and rubric, then returns a score and rationale. A survey on LLM-as-a-judge frames the field around what to judge, how to judge, and how to benchmark judges: https://arxiv.org/html/2411.15594v6. The practical rule is to treat the judge as another model with bias, variance, and calibration problems.',
        'Rubric design matters. A vague judge prompt rewards style. A good rubric names criteria: factual correctness, answer completeness, citation support, policy compliance, concision, tool-use correctness, and when to abstain. Use human audit on high-impact slices and periodically compare judge decisions to human labels.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Eval cost is shaped by case count, model calls per case, judge calls, retrieval replay, tool simulation, human labels, and repeated runs across variants. Cheap property checks should run first. Expensive judge calls and human review should focus on changed or risky slices. Benchmark Variance & Model Selection still applies: report confidence intervals, slice counts, model versions, prompt versions, and cost per task when the conclusion matters.',
        'The harness also needs versioning. Store case version, prompt version, retrieval index version, model version, scorer version, and random seed when sampling is involved. Without those fields, a score cannot be reproduced or compared fairly after the system changes. AI Engineering Stack: Five Parts Primer places this in the wider system: evaluation is one moving part beside data, model, compute, and serving.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LLM eval harnesses are used for model upgrades, prompt changes, RAG Pipeline changes, tool-call migrations, safety-policy changes, agent-loop updates, customer-support copilots, legal research assistants, code agents, summarizers, classifiers, and extraction systems. HELM is the research-scale version of this idea: it evaluates many models across scenarios and metrics for transparency, not only accuracy: https://arxiv.org/abs/2211.09110 and https://crfm.stanford.edu/helm/.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first trap is treating an LLM judge as ground truth. It is a noisy evaluator with preferences and blind spots. The second trap is averaging away important slices. A model can improve average helpfulness while getting worse on policy edges, rare entities, adversarial prompts, or expensive tool traces. The third trap is eval overfitting: once the team has seen a case too many times, it becomes training data.',
        'A good eval suite is therefore layered: exact checks where possible, rubric judges where useful, human review where stakes justify it, and a steady stream of fresh cases from production failures. The suite should explain regressions, not only announce them.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: OpenAI evals guide at https://developers.openai.com/api/docs/guides/evals, OpenAI Evals repository at https://github.com/openai/evals, EleutherAI lm-evaluation-harness at https://github.com/EleutherAI/lm-evaluation-harness, HELM paper at https://arxiv.org/abs/2211.09110, Stanford HELM at https://crfm.stanford.edu/helm/, and LLM-as-a-Judge survey at https://arxiv.org/html/2411.15594v6. Study Human Evaluation Labeling Queue Case Study, LLM Judge Calibration & Drift Monitor, LLM Model Rollout Shadow Canary Ledger, Benchmark Variance & Model Selection, Cross-Validation & Honest Evaluation, Data Leakage & Contamination, Calibration & Reliability Diagrams, Agentic AI Patterns: Planning, Tools, Memory, Prompt Injection Threat Model, AI Audit Evidence Packet Case Study, and Multi-Index RAG next.',
      ],
    },
  ],
};
