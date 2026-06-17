// LLM training-data extraction: generate many samples, rank suspicious
// memorized strings, and verify whether outputs match training data.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'llm-training-data-extraction-case-study',
  title: 'LLM Training Data Extraction Case Study',
  category: 'AI & ML',
  summary: 'How memorized text escapes through generation: prompt sweeps, likelihood ranking, duplicate search, canaries, and release gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['extraction loop', 'memorization controls'], defaultValue: 'extraction loop' },
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

function extractionGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompts', label: 'prompts', x: 0.7, y: 3.5, note: 'many' },
      { id: 'model', label: 'LM', x: 2.4, y: 3.5, note: 'sample' },
      { id: 'samples', label: 'samples', x: 4.0, y: 2.0, note: 'raw' },
      { id: 'ranker', label: 'ranker', x: 4.0, y: 5.0, note: 'score' },
      { id: 'dedupe', label: 'dedupe', x: 5.9, y: 3.5, note: 'match' },
      { id: 'review', label: 'review', x: 7.6, y: 3.5, note: 'verify' },
      { id: 'gate', label: 'gate', x: 9.0, y: 3.5, note: 'release' },
    ],
    edges: [
      { id: 'e-prompts-model', from: 'prompts', to: 'model' },
      { id: 'e-model-samples', from: 'model', to: 'samples' },
      { id: 'e-samples-ranker', from: 'samples', to: 'ranker' },
      { id: 'e-ranker-dedupe', from: 'ranker', to: 'dedupe' },
      { id: 'e-dedupe-review', from: 'dedupe', to: 'review' },
      { id: 'e-review-gate', from: 'review', to: 'gate' },
    ],
  }, { title });
}

function* extractionLoop() {
  yield {
    state: extractionGraph('Extraction is generate, rank, verify'),
    highlight: { active: ['prompts', 'model', 'samples', 'e-prompts-model', 'e-model-samples'], compare: ['gate'] },
    explanation: 'Read the graph as an extraction pipeline, not a single prompt trick. The attacker generates many continuations, ranks suspicious strings, checks near matches, verifies provenance, and only then calls something extracted.',
  };

  yield {
    state: labelMatrix(
      'Why some strings memorize',
      [
        { id: 'dup', label: 'duplicate' },
        { id: 'rare', label: 'rare token' },
        { id: 'format', label: 'fixed format' },
        { id: 'secret', label: 'secret-like' },
      ],
      [
        { id: 'reason', label: 'reason' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['many copies', 'high'],
        ['stands out', 'medium'],
        ['easy prefix', 'medium'],
        ['unique value', 'high'],
      ],
    ),
    highlight: { active: ['dup:risk', 'secret:risk'], compare: ['rare:reason', 'format:reason'] },
    explanation: 'Memorization risk rises when strings are duplicated, rare, structured, or secret-like. The model may learn a sequence as a fact to continue, not just a distributional pattern.',
    invariant: 'Never put real secrets in a canary or demo. Use synthetic markers for measurement.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'duplicate count', min: 0, max: 20 }, y: { label: 'extraction risk', min: 0, max: 100 } },
      series: [
        { id: 'small', label: 'small LM', points: [{ x: 1, y: 4 }, { x: 3, y: 7 }, { x: 6, y: 12 }, { x: 12, y: 23 }, { x: 20, y: 35 }] },
        { id: 'large', label: 'large LM', points: [{ x: 1, y: 9 }, { x: 3, y: 18 }, { x: 6, y: 34 }, { x: 12, y: 61 }, { x: 20, y: 79 }] },
      ],
      markers: [{ id: 'dedupe', x: 3, y: 18, label: 'dedupe' }],
    }),
    highlight: { active: ['small', 'large'], found: ['dedupe'] },
    explanation: 'The plot shows why duplicates matter. As repeated strings accumulate, extraction risk rises, especially for larger models. Deduplication is a privacy control, not just a storage cleanup.',
  };

  yield {
    state: labelMatrix(
      'Ranking suspicious samples',
      [
        { id: 'perp', label: 'low perplex' },
        { id: 'ratio', label: 'ratio test' },
        { id: 'near', label: 'near match' },
        { id: 'pii', label: 'PII shape' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'review', label: 'review' },
      ],
      [
        ['model too sure', 'inspect'],
        ['beats ref', 'inspect'],
        ['matches crawl', 'verify'],
        ['PII shape', 'block'],
      ],
    ),
    highlight: { active: ['perp:signal', 'ratio:signal', 'near:signal'], found: ['pii:review'] },
    explanation: 'Extraction papers use ranking to turn millions of generations into a review set. Low perplexity, high likelihood-ratio scores, near-duplicate matches, and PII-shaped strings move a sample to manual or automated review.',
  };

  yield {
    state: labelMatrix(
      'Verification states',
      [
        { id: 'sample', label: 'sample' },
        { id: 'match', label: 'match' },
        { id: 'context', label: 'context' },
        { id: 'incident', label: 'incident' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'state', label: 'state' },
      ],
      [
        ['emitted?', 'candidate'],
        ['source found?', 'maybe extract'],
        ['is it unique?', 'confirmed risk'],
        ['sensitive?', 'response path'],
      ],
    ),
    highlight: { active: ['sample:state', 'match:state'], compare: ['context:state'], found: ['incident:state'] },
    explanation: 'A sample becomes a confirmed risk only after verification. The release process needs provenance: prompt, sample, rank score, match evidence, sensitivity classification, and remediation.',
  };
}

function* memorizationControls() {
  yield {
    state: graphState({
      nodes: [
        { id: 'crawl', label: 'crawl', x: 0.7, y: 3.5, note: 'raw' },
        { id: 'license', label: 'license', x: 2.2, y: 1.7, note: 'rights' },
        { id: 'pii', label: 'PII scan', x: 2.2, y: 5.3, note: 'spans' },
        { id: 'dedupe', label: 'dedupe', x: 4.0, y: 3.5, note: 'near' },
        { id: 'train', label: 'train', x: 5.7, y: 3.5, note: 'model' },
        { id: 'extract', label: 'extract', x: 7.3, y: 1.8, note: 'red team' },
        { id: 'canary', label: 'canary', x: 7.3, y: 5.2, note: 'synthetic' },
        { id: 'gate', label: 'gate', x: 9.0, y: 3.5, note: 'ship' },
      ],
      edges: [
        { id: 'e-crawl-license', from: 'crawl', to: 'license' },
        { id: 'e-crawl-pii', from: 'crawl', to: 'pii' },
        { id: 'e-license-dedupe', from: 'license', to: 'dedupe' },
        { id: 'e-pii-dedupe', from: 'pii', to: 'dedupe' },
        { id: 'e-dedupe-train', from: 'dedupe', to: 'train' },
        { id: 'e-train-extract', from: 'train', to: 'extract' },
        { id: 'e-train-canary', from: 'train', to: 'canary' },
        { id: 'e-extract-gate', from: 'extract', to: 'gate' },
        { id: 'e-canary-gate', from: 'canary', to: 'gate' },
      ],
    }, { title: 'Privacy work starts before training' }),
    highlight: { active: ['license', 'pii', 'dedupe', 'extract', 'canary'], found: ['gate'] },
    explanation: 'Memorization control is an end-to-end pipeline. Data rights, PII scanning, dedupe, synthetic canaries, extraction red-team runs, and a release gate all happen before public deployment.',
  };

  yield {
    state: labelMatrix(
      'Controls by stage',
      [
        { id: 'ingest', label: 'ingest' },
        { id: 'prep', label: 'prep' },
        { id: 'train', label: 'train' },
        { id: 'serve', label: 'serve' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'evidence', label: 'evidence' },
      ],
      [
        ['rights + min', 'source ledger'],
        ['PII + dedupe', 'span log'],
        ['DP or reg', 'budget report'],
        ['output filter', 'block log'],
        ['extract eval', 'risk report'],
      ],
    ),
    highlight: { active: ['prep:control', 'audit:control'], found: ['audit:evidence'] },
    explanation: 'No single filter solves extraction. The strongest release story combines data minimization, near-deduplication, PII redaction, training regularization, output filtering, and explicit extraction tests.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'redaction + dedupe effort', min: 0, max: 5 }, y: { label: 'retained utility / risk', min: 0, max: 100 } },
      series: [
        { id: 'utility', label: 'utility', points: [{ x: 0, y: 96 }, { x: 1, y: 94 }, { x: 2, y: 91 }, { x: 3, y: 86 }, { x: 4, y: 75 }, { x: 5, y: 58 }] },
        { id: 'risk', label: 'risk', points: [{ x: 0, y: 88 }, { x: 1, y: 62 }, { x: 2, y: 39 }, { x: 3, y: 24 }, { x: 4, y: 17 }, { x: 5, y: 14 }] },
      ],
      markers: [{ id: 'knee', x: 3, y: 86, label: 'knee' }],
    }),
    highlight: { active: ['utility', 'risk'], found: ['knee'] },
    explanation: 'Data cleaning has a frontier. The early wins are usually cheap: exact dedupe, near-dedupe, secret patterns, emails, phone numbers, keys, and low-value boilerplate. Past the knee, utility can fall faster than risk.',
  };

  yield {
    state: labelMatrix(
      'Synthetic canary ledger',
      [
        { id: 'insert', label: 'insert' },
        { id: 'train', label: 'train' },
        { id: 'prompt', label: 'prompt' },
        { id: 'expose', label: 'exposure' },
      ],
      [
        { id: 'record', label: 'record' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['fake marker', 'no real secret'],
        ['known count', 'track dupes'],
        ['prefix test', 'measure rank'],
        ['low is good', 'gate threshold'],
      ],
    ),
    highlight: { active: ['insert:rule', 'train:rule', 'expose:rule'], compare: ['prompt:record'] },
    explanation: 'Canaries measure memorization without planting real secrets. The ledger records the synthetic string, insertion count, prompt prefixes, extraction rank, and release threshold.',
  };

  yield {
    state: labelMatrix(
      'Release outcomes',
      [
        { id: 'pass', label: 'pass' },
        { id: 'warn', label: 'warn' },
        { id: 'hold', label: 'hold' },
        { id: 'recall', label: 'recall' },
      ],
      [
        { id: 'trigger', label: 'trigger' },
        { id: 'action', label: 'action' },
      ],
      [
        ['low exposure', 'ship'],
        ['one weak hit', 'monitor'],
        ['PII extract', 'retrain/scrub'],
        ['post-ship hit', 'incident'],
      ],
    ),
    highlight: { found: ['pass:action', 'warn:action'], removed: ['hold:action', 'recall:action'] },
    explanation: 'The gate needs predeclared outcomes. If extraction finds confirmed sensitive text, release pauses. If a deployed system emits sensitive memorized text, that is an incident, not an interesting demo.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'extraction loop') yield* extractionLoop();
  else if (view === 'memorization controls') yield* memorizationControls();
  else throw new InputError('Pick an LLM-extraction view.');
}

export const article = {
  sections: [
    {
      heading: 'Why it exists',
      paragraphs: [
        'Training-data extraction exists as a topic because generative models can memorize and emit pieces of their training data. A language model is trained to predict the next token. If a rare string appears many times, appears in a rigid format, or is strongly associated with a prefix, the model may learn to continue that string exactly. That is not only a theoretical privacy issue. It matters for support tickets, emails, logs, medical notes, source code, private chats, copyrighted text, API keys, and any corpus that mixes useful examples with sensitive records.',
        'The case study is about the full loop, not a clever prompt. An attacker generates many samples, ranks the suspicious ones, searches for matches, and verifies whether an output corresponds to training data or a reference corpus. A defender needs the same structure in reverse: source ledgers, dedupe records, PII span logs, canaries, red-team extraction runs, and release gates. Without evidence, a team cannot distinguish harmless fluent text from memorized sensitive text.',
      ],
    },
    {
      heading: 'The naive baseline',
      paragraphs: [
        'The naive safety check is to ask the model a few scary questions and see whether it refuses. That proves very little. Extraction is a search problem. A model can reject direct requests for secrets and still emit memorized strings when sampled under many prefixes, temperatures, prompt templates, or continuation tasks. Small demos miss low-probability events because the base rate is low and the attack benefits from scale.',
        'Another naive defense is to add an output filter and call the model safe. Filters help, but they are the last line of defense. They can miss unusual formats, partial secrets, rare personal data, or copyrighted passages. They also do not prove the model lacks memorized content; they only try to block some emissions. The deeper wall is provenance. If the team cannot compare outputs against source data, canaries, and dedupe evidence, it cannot measure extraction risk.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that memorization is easier to find after narrowing. Millions of raw generations are mostly useless. A ranker turns that haystack into a review queue. Suspicious candidates include strings with unusually low perplexity, outputs that a target model assigns much higher likelihood than a reference model, near matches to a crawl, rigid secret-like formats, long exact spans, rare names, UUID-like values, keys, emails, phone numbers, and copied code.',
        'The second insight is that extraction is not confirmed until it is verified. A generated string might be public, guessed, synthetic, or coincidentally similar. A confirmed risk needs provenance: prompt, sample, model settings, rank score, match location, source date, uniqueness, sensitivity class, and remediation. That evidence record is what turns an alarming anecdote into an actionable release decision.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The extraction-loop visual proves that the attacker is running a pipeline. Prompts create a large sample pool. The ranker orders the pool by memorization signals. Dedupe and corpus search test whether candidates match known text. Review checks whether the match is sensitive and whether the evidence is strong enough. The graph ends at a gate because extraction findings should affect whether a model ships, not merely become an interesting screenshot.',
        'The memorization-controls visual proves that defense starts before training. The crawl is filtered for rights and sensitive spans. Near duplicates are removed or reduced. Synthetic canaries are inserted only for measurement, never as real secrets. After training, extraction tests and canary exposure scores feed the release gate. The plots show the tradeoff: cleaning and dedupe often reduce risk quickly at first, but aggressive removal can eventually cut into useful data.',
      ],
    },
    {
      heading: 'How the attack works',
      paragraphs: [
        'A basic extraction run starts with prompt families. Some prompts ask the model to continue common prefixes. Some use formatting bait, such as email headers, code comments, log lines, URLs, markdown tables, or chat transcripts. Some sample many completions from high-entropy prefixes to expose memorized tails. The attacker keeps prompt, seed, temperature, model version, and output so the result can be reproduced.',
        'The next stage is ranking. Low perplexity can mean the model is too confident in a long continuation. A likelihood-ratio test compares the target model with a smaller or differently trained reference model; a string that the target strongly prefers can indicate memorization. Near-duplicate search compares samples against crawls, training shards if available, or known sensitive corpora. Pattern detectors catch PII shapes and secret shapes. The review stage then checks whether the match is real, unique, sensitive, and covered by policy.',
      ],
    },
    {
      heading: 'How defenses work',
      paragraphs: [
        'Defenses begin with data minimization. Do not train on records the model does not need. Rights filtering removes data the system is not allowed to use. PII detection records sensitive spans and either removes, masks, or routes them through a stricter process. Exact dedupe removes repeated copies. Near dedupe reduces templated repeats and copied pages. This matters because duplication increases the chance that a rare string becomes learnable as an exact continuation.',
        'Canaries measure memorization without planting real secrets. A canary is a synthetic marker with known insertion count and known prefixes. After training, the team tests whether the model can recover it and records an exposure score or rank. Differential privacy, regularization, data filtering, and training recipes can reduce memorization, but they bring utility and cost tradeoffs. Output filters, rate limits, and abuse detection belong at serving time, but they should not replace pretraining controls.',
        'The core data structures are a source ledger, near-duplicate index, PII span log, canary ledger, sample ranking table, match evidence table, incident record, and release decision record. Those structures make the policy auditable. They show what was removed, what remained, what was tested, and why the model was allowed or blocked.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Extraction works when training has made a sequence unusually easy for the model to continue. Duplicates raise exposure by repeating the same signal. Rare strings stand out because there are few plausible alternatives. Structured strings are easy to complete after a prefix. Large models can have enough capacity to memorize more rare sequences while still learning useful general patterns. None of these conditions guarantees extraction, but they raise the search yield.',
        'Defenses work by lowering those conditions and by measuring what remains. Dedupe reduces repeated exposure. Redaction removes sensitive spans before the model can learn them. Canaries create known probes. Extraction red-team runs approximate what an attacker would do at scale. Release gates force the team to act on evidence rather than relying on confidence that training probably generalized.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The attacker pays for generations, ranking, search indexes, and review. The defender pays earlier and more continuously: source tracking, data licensing, PII detection, dedupe, canary design, extraction evaluation, and incident response. The expensive part is not only compute. It is evidence management. If the model emits a suspicious paragraph, someone must determine whether it came from a source, whether the source was allowed, whether it is sensitive, and what action follows.',
        'Cleaning also has utility costs. Aggressive dedupe can remove useful examples. PII detectors can miss spans or over-remove legitimate text. Differential privacy can reduce memorization but may hurt quality or require more data and compute. Source ledgers can contain sensitive metadata and need access control. The goal is not zero risk by slogan. The goal is measured residual risk with a clear release threshold.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A team trains a domain model over support tickets, product docs, issue history, and internal runbooks. Before training, it filters licensing, removes raw secrets, runs PII span detection, performs exact and near dedupe, and records source IDs. It inserts synthetic canaries at controlled counts. After training, a red team runs prompt sweeps over ticket-like prefixes, code-comment prefixes, email-like formats, and random high-volume sampling. A ranker surfaces a candidate that nearly matches a support ticket after redaction.',
        'The release gate blocks shipment because the match is long, unique, and sensitive. The team traces the source shard, finds a dedupe miss caused by templated copies with small edits, improves the near-duplicate threshold, expands the span recognizer, retrains, and repeats the extraction run. The final release packet includes the canary exposure report, the extraction sample ledger, the remediation note, and the decision record. That is the difference between privacy theater and an auditable safety process.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'Do not test extraction by inserting real secrets. Use synthetic canaries. Do not treat exact dedupe as enough; near duplicates, templates, boilerplate, and copied logs still matter. Do not rely on refusal behavior alone. Do not assume that a model with no access to the original training corpus can prove a suspicious output is not memorized. Absence of a match is weaker than confirmed non-exposure when the corpus is incomplete.',
        'This case study is related to membership inference and model inversion but not identical. Membership inference asks whether a record was in the training set. Model inversion asks what hidden attribute or representative input can be reconstructed. Training-data extraction asks whether the model can emit training content. A system can be weak on one axis and stronger on another, so each needs its own evaluation.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Start with Carlini et al., Extracting Training Data from Large Language Models, at https://arxiv.org/abs/2012.07805 and the USENIX Security version at https://www.usenix.org/system/files/sec21-carlini-extracting.pdf. Then study PII Redaction Token Span Pipeline, Membership Inference Shadow Model Case Study, Model Inversion, Differential Privacy SGD, Data Leakage & Contamination, MinHash LSH, Content-Defined Chunking, RAG Dedup MinHash Canonicalization, Claim Graph & Source Ledger, Source Authority Triage Priority Queue, and LLM Guardrail Policy Engine. The practical next question is whether your training pipeline can produce the evidence packet needed to decide a real extraction finding.',
      ],
    },
  ],
};
