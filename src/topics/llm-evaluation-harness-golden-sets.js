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
    invariant: `An eval without replayable context is only a vibe check — ${topic.title.split(':')[0].toLowerCase()} demands reproducible evidence.`,
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
    invariant: `A judge score is evidence, not truth — every ${topic.category} evaluation must treat it as one signal among many.`,
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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/llm-evaluation-harness-golden-sets.gif', alt: 'Animated walkthrough of the llm evaluation harness golden sets visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LLM systems do not only return exact values. They summarize, retrieve, call tools, write explanations, refuse unsafe requests, cite sources, ask clarifying questions, and sometimes take many steps before producing an answer. A normal unit test can check a parser or function. An LLM evaluation suite has to check behavior under uncertainty.',
        {type: 'callout', text: 'An eval case is a replayable evidence packet: input, context, expected behavior, scorer, trace, and risk slice travel together.'},
        'The useful artifact is an eval case: a replayable task with the input, relevant context, expected behavior, scorer, metadata, trace, and risk slice. A good case is not just a prompt and a score. It is enough evidence to rerun the system and understand why it passed or failed.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'An eval harness is a directed evidence flow: traces become cases, cases enter runners, scorers produce release-gate evidence. Source: Wikimedia Commons, David W., public domain.'},
        'The evaluation system is the machinery around those cases: runners, model or prompt variants, retrieval snapshots, tool traces, scorers, judge prompts, score matrices, and release gates.',
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious approach is to read a handful of outputs and decide whether the new prompt feels better. That is useful during early exploration, but it is not a regression gate. Humans remember the examples they just fixed, miss rare slices, and overvalue polished wording.',
        'The second naive approach is one blended benchmark score. That can hide the failure that matters. A model can improve average helpfulness while getting worse on safety refusals, rare entities, citation support, latency, cost, or tool-use correctness.',
        'The wall is that LLM quality is multidimensional. The eval suite must preserve slices and traces, not collapse everything into one comforting number.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the golden-set view, follow production traces into curated cases, then into the runner. The important data structure is the case record: input, context, expected behavior, tags, and enough trace material to reproduce the decision.',
        'The holdout node is there to remind you that evals wear out. A visible development set helps engineers improve the system. A sealed holdout checks whether those improvements generalize beyond the examples everyone has been staring at.',
        'In the judge-rubric view, watch how the candidate answer, reference material, rubric, judge score, rationale, and human audit fit together. The judge is not truth. It is another model producing evidence that needs calibration.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An eval system stores structured cases. A case may include the user task, retrieved documents, tool trace, expected facts, disallowed behavior, reference answer, rubric, labels, and slices such as domain, risk, language, customer type, or attack family.',
        'A runner replays each case through candidate systems: old model, new model, old prompt, new prompt, changed retriever, changed tool policy, or changed agent loop. Scorers then measure exact match, schema validity, citation support, groundedness, latency, cost, refusal quality, rubric score, or pairwise preference.',
        'The output should be a score matrix. Rows are cases or slices. Columns are dimensions and variants. A release gate should be able to block on a critical regression even when the average score improves.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The case is the primary data structure. The judge, model, and prompt can all change, but the case preserves what behavior the system was supposed to exhibit and why.',
        'The trace is the second key structure. For a RAG system, it records retrieved sources and citations. For an agent, it records tool calls, observations, costs, retries, and final answer. Without the trace, a pass may hide unsafe or expensive behavior.',
        'The score is the third structure, and it must stay sliced. An overall score is a dashboard summary, not the evidence needed to ship a change.',
      ],
    },
    {
      heading: 'Judges and rubrics',
      paragraphs: [
        'LLM-as-a-judge is useful when output quality is open-ended. The judge receives the case, candidate answer, reference material, and rubric, then returns a score and rationale. That is appropriate for qualities like completeness, helpfulness, faithfulness, tone, and refusal quality.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree model diagram', caption: 'A useful rubric behaves like a decision structure: each criterion narrows why an answer passed, failed, or needs audit. Source: Wikimedia Commons, CC BY-SA 4.0.'},
        'Rubric design matters. A vague judge prompt rewards style. A useful rubric names criteria: factual correctness, answer completeness, citation support, policy compliance, concision, tool-use correctness, and when to abstain.',
        'Judges need calibration. They can prefer verbosity, familiar wording, their own model family, or the answer shown first. Keep anchor cases, compare judge scores with human labels, randomize answer order for pairwise tests, and audit high-stakes slices.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A support copilot is upgraded to a cheaper faster model. The average helpfulness score rises. The latency and cost columns improve. But the safety slice for refund-policy edge cases drops from 97% to 90%. A single blended score would hide the regression; a sliced score matrix blocks the rollout.',
        'The team opens the failed cases and sees that the new model answers confidently when the retrieved policy document is missing. The fix is not only a prompt tweak. The evaluation runner needs a groundedness scorer, a retrieval-miss slice, and a gate that requires abstention when the context does not support the answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Eval cost is shaped by case count, model calls per case, judge calls, retrieval replay, tool simulation, human labels, and repeated runs across variants. Cheap deterministic checks should run first. Expensive judge calls and human review should focus on changed or risky slices.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density curves', caption: 'Repeated eval runs should be read as sampled measurements, not single absolute truths; variance decides whether a score change is meaningful. Source: Wikimedia Commons, Inductiveload, public domain.'},
        'The eval system also needs versioning. Store case version, prompt version, retrieval index version, model version, scorer version, judge version, tool simulator version, and random seed when sampling is involved. Without those fields, a score cannot be reproduced or compared fairly.',
        'Benchmark variance still applies. Report slice counts, confidence intervals where appropriate, and cost per task when using evals to make product or vendor decisions.',
      ],
    },
    {
      heading: 'Operating rules',
      paragraphs: [
        'Keep the suite close to production. Add cases from real failures, customer escalations, red-team prompts, tool-call mistakes, citation errors, and policy disputes. Tag each case by risk and product surface so a regression can be routed to the right owner.',
        'Separate exploration from release gates. Engineers need visible cases for debugging, but shipping decisions need protected cases that were not tuned directly. When a protected case becomes a teaching example, mark it as visible and replace it with fresh holdout coverage.',
        'Review failures as artifacts, not anecdotes. A failed case should show input, context, output, trace, scorer result, judge rationale when used, and owner decision. That makes the suite a curriculum for the product team as well as a gate for code changes.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'LLM eval suites win for model upgrades, prompt migrations, RAG changes, tool-call policies, agent-loop changes, safety-policy updates, support copilots, legal research assistants, code agents, summarizers, classifiers, and extraction systems.',
        'They are especially useful when the team has recurring production failures. A good suite turns failures into durable cases so the same mistake cannot quietly return.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the cases are toy examples disconnected from real usage. It fails when the judge is treated as ground truth. It fails when scores are averaged across slices that have different risk.',
        'It also fails when teams overfit the development set. Once engineers tune against the same cases repeatedly, those cases stop measuring generalization. Keep a holdout, add fresh cases, and mark which cases have become visible training material.',
        'The suite should explain regressions, not only announce them. If a failing score cannot be traced back to input, context, output, scorer, and rationale, the evaluation system is not yet an engineering tool.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: OpenAI evals guide at https://developers.openai.com/api/docs/guides/evals, OpenAI Evals repository at https://github.com/openai/evals, HELM paper at https://arxiv.org/abs/2211.09110, Stanford HELM at https://crfm.stanford.edu/helm/, and LLM-as-a-Judge survey at https://arxiv.org/html/2411.15594v6. Study Human Evaluation Labeling Queue Case Study, LLM Judge Calibration & Drift Monitor, LLM Model Rollout Shadow Canary Ledger, Benchmark Variance & Model Selection, Cross-Validation & Honest Evaluation, Data Leakage & Contamination, Calibration & Reliability Diagrams, Agentic AI Patterns: Planning, Tools, Memory, Prompt Injection Threat Model, AI Audit Evidence Packet Case Study, and Multi-Index RAG next.',
      ],
    },
  ],
};
