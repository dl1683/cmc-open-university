// RAG index lifecycle: stable chunk ids, tombstones, shadow indexes, validation
// gates, and alias swaps for zero-downtime corpus/model refreshes.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rag-index-lifecycle-alias-swap-case-study',
  title: 'RAG Index Lifecycle and Alias Swap',
  category: 'AI & ML',
  summary: 'How production RAG indexes survive updates: stable IDs, delta ledgers, tombstones, shadow rebuilds, validation gates, and atomic alias swaps.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['delta ingest', 'blue green swap'], defaultValue: 'delta ingest' },
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

function lifecycleGraph(title) {
  return graphState({
    nodes: [
      { id: 'doc', label: 'doc', x: 0.6, y: 3.6, note: 'source' },
      { id: 'parse', label: 'parse', x: 1.9, y: 3.6, note: 'text' },
      { id: 'chunk', label: 'chunk', x: 3.2, y: 2.1, note: 'stable ids' },
      { id: 'embed', label: 'embed', x: 4.7, y: 2.1, note: 'vectors' },
      { id: 'delta', label: 'delta', x: 3.2, y: 5.2, note: 'updates' },
      { id: 'tomb', label: 'tomb', x: 4.7, y: 5.2, note: 'deletes' },
      { id: 'shadow', label: 'shadow', x: 6.3, y: 3.6, note: 'vNext' },
      { id: 'alias', label: 'alias', x: 7.9, y: 3.6, note: 'pointer' },
      { id: 'serve', label: 'serve', x: 9.3, y: 3.6, note: 'queries' },
    ],
    edges: [
      { id: 'e-doc-parse', from: 'doc', to: 'parse' },
      { id: 'e-parse-chunk', from: 'parse', to: 'chunk' },
      { id: 'e-chunk-embed', from: 'chunk', to: 'embed' },
      { id: 'e-parse-delta', from: 'parse', to: 'delta' },
      { id: 'e-delta-tomb', from: 'delta', to: 'tomb' },
      { id: 'e-embed-shadow', from: 'embed', to: 'shadow' },
      { id: 'e-tomb-shadow', from: 'tomb', to: 'shadow' },
      { id: 'e-shadow-alias', from: 'shadow', to: 'alias' },
      { id: 'e-alias-serve', from: 'alias', to: 'serve' },
    ],
  }, { title });
}

function swapGraph(title) {
  return graphState({
    nodes: [
      { id: 'old', label: 'idx v1', x: 1.0, y: 2.2, note: 'live' },
      { id: 'new', label: 'idx v2', x: 1.0, y: 5.3, note: 'shadow' },
      { id: 'alias', label: 'alias', x: 3.2, y: 3.7, note: 'read ptr' },
      { id: 'dual', label: 'dual write', x: 5.1, y: 3.7, note: 'catch up' },
      { id: 'checks', label: 'checks', x: 6.9, y: 3.7, note: 'gates' },
      { id: 'swap', label: 'swap', x: 8.4, y: 3.7, note: 'atomic' },
      { id: 'serve', label: 'serve', x: 9.6, y: 3.7, note: 'v2' },
    ],
    edges: [
      { id: 'e-old-alias', from: 'old', to: 'alias' },
      { id: 'e-new-alias', from: 'new', to: 'alias' },
      { id: 'e-alias-dual', from: 'alias', to: 'dual' },
      { id: 'e-dual-checks', from: 'dual', to: 'checks' },
      { id: 'e-checks-swap', from: 'checks', to: 'swap' },
      { id: 'e-swap-serve', from: 'swap', to: 'serve' },
    ],
  }, { title });
}

function* deltaIngest() {
  yield {
    state: lifecycleGraph('RAG indexes need stable identity, not just vectors'),
    highlight: { active: ['doc', 'parse', 'chunk', 'embed', 'e-doc-parse', 'e-parse-chunk', 'e-chunk-embed'], compare: ['alias'] },
    explanation: 'Read the pipeline as the operational wrapper around retrieval. The embedding table is only one artifact; stable IDs, spans, filters, tombstones, snapshots, and aliases decide whether it can be changed safely.',
  };

  yield {
    state: labelMatrix(
      'Stable IDs keep joins alive',
      [
        { id: 'doc', label: 'doc id' },
        { id: 'chunk', label: 'chunk id' },
        { id: 'vec', label: 'vec id' },
        { id: 'span', label: 'span id' },
        { id: 'ver', label: 'version' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['source key', 'dedupe'],
        ['text slice', 'retrieval'],
        ['model+chunk', 'refresh'],
        ['offsets', 'citations'],
        ['snapshot', 'rollback'],
      ],
    ),
    highlight: { active: ['chunk:stores', 'vec:stores', 'span:stores'], found: ['ver:why'] },
    explanation: 'Stable IDs let lexical, vector, span, ACL, freshness, and eval records join to the same evidence. Without them, re-chunking or re-embedding breaks citations, caches, and regression tests.',
    invariant: 'A vector id should be derived from model version plus chunk identity, not from array position.',
  };

  yield {
    state: lifecycleGraph('Deletes enter as tombstones before compaction'),
    highlight: { active: ['delta', 'tomb', 'shadow', 'e-delta-tomb', 'e-tomb-shadow'], found: ['alias'] },
    explanation: 'Deletes should not mean "forget immediately." A tombstone lets the serving layer hide stale chunks, lets rebuilds remove them later, and lets audits explain why an older citation is no longer valid.',
  };

  yield {
    state: labelMatrix(
      'Delta ledger operations',
      [
        { id: 'upsert', label: 'upsert' },
        { id: 'delete', label: 'delete' },
        { id: 'rechunk', label: 'rechunk' },
        { id: 'model', label: 'model v' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'hazard', label: 'hazard' },
      ],
      [
        ['new chunk', 'dup ids'],
        ['tombstone', 'stale hit'],
        ['new ids', 'lost cite'],
        ['new vec ids', 'mixed dims'],
      ],
    ),
    highlight: { active: ['delete:action', 'rechunk:action', 'model:action'], compare: ['rechunk:hazard', 'model:hazard'] },
    explanation: 'The delta ledger is the catch-up contract. It records every change that must be replayed so a shadow index is not already stale when validation starts.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'hours since source change', min: 0, max: 24 }, y: { label: 'visible stale chunks', min: 0, max: 100 } },
      series: [
        { id: 'none', label: 'no tombs', points: [{ x: 0, y: 100 }, { x: 4, y: 96 }, { x: 12, y: 83 }, { x: 24, y: 70 }] },
        { id: 'tombs', label: 'tombstones', points: [{ x: 0, y: 100 }, { x: 1, y: 24 }, { x: 4, y: 8 }, { x: 12, y: 3 }, { x: 24, y: 0 }] },
      ],
    }),
    highlight: { found: ['tombs'], compare: ['none'] },
    explanation: 'The plot is conceptual. Tombstones reduce user-visible stale evidence before the expensive full rebuild or compaction finishes.',
  };
}

function* blueGreenSwap() {
  yield {
    state: swapGraph('Build a shadow index behind the live alias'),
    highlight: { active: ['old', 'alias'], compare: ['new'], found: ['serve'] },
    explanation: 'The serving application should query an alias, not a physical index name. That lets the team build idx v2 in the background while idx v1 keeps serving production traffic.',
  };

  yield {
    state: swapGraph('Catch up live changes before the swap'),
    highlight: { active: ['dual', 'new', 'e-alias-dual'], found: ['checks'], compare: ['old'] },
    explanation: 'A rebuild can take minutes or days. During that window, new documents, edits, and deletes still happen. A catch-up phase replays deltas or dual-writes so the shadow index is not stale at cutover.',
    invariant: 'A zero-downtime swap is only correct if the shadow index includes changes made during the rebuild.',
  };

  yield {
    state: labelMatrix(
      'Promotion gates',
      [
        { id: 'recall', label: 'recall' },
        { id: 'p95', label: 'p95' },
        { id: 'acl', label: 'ACL' },
        { id: 'cite', label: 'citations' },
        { id: 'dupes', label: 'dupes' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail if' },
      ],
      [
        ['golden qs', 'miss facts'],
        ['latency', 'slow tail'],
        ['filter set', 'leak risk'],
        ['span map', 'bad cites'],
        ['top-k mix', 'dup flood'],
      ],
    ),
    highlight: { found: ['recall:check', 'acl:check', 'cite:check'], compare: ['p95:fail', 'dupes:fail'] },
    explanation: 'The alias should move only after validation. Golden-query recall, p95 latency, ACL filters, citation spans, dedup hygiene, and index size all need to pass before v2 becomes live.',
  };

  yield {
    state: swapGraph('Alias swap makes v2 live atomically'),
    highlight: { active: ['checks', 'swap', 'serve', 'e-checks-swap', 'e-swap-serve'], found: ['new'], removed: ['old'] },
    explanation: 'The swap frame is deliberately boring: the application reads an alias, not a physical index. Promotion and rollback are metadata moves only because the shadow index was fully built and validated first.',
  };

  yield {
    state: labelMatrix(
      'Complete case: embedding model migration',
      [
        { id: 'old', label: 'v1 model' },
        { id: 'new', label: 'v2 model' },
        { id: 'eval', label: 'eval set' },
        { id: 'swap', label: 'alias' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['live', 'stale dims'],
        ['shadow', 'bad recall'],
        ['pass gates', 'slice loss'],
        ['switch', 'rollback'],
      ],
    ),
    highlight: { active: ['new:state', 'eval:state', 'swap:state'], compare: ['old:risk'] },
    explanation: 'Case study: a company moves from one embedding model to another. The new vectors have different dimensions and ranking behavior, so the team builds a shadow index, replays deltas, checks golden questions, then swaps the alias when v2 is proven better on the right slices.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'delta ingest') yield* deltaIngest();
  else if (view === 'blue green swap') yield* blueGreenSwap();
  else throw new InputError('Pick a RAG index lifecycle view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the physical index versions as build artifacts and the serving alias as the pointer the application queries. The alias is small, but it decides which whole evidence graph is live.',
        'Read tombstones as visibility controls. A deleted document can be hidden from search before offline compaction removes its old vectors, spans, and lexical postings.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A RAG index is not static. Documents change, permissions change, chunking rules change, embedding models change, citation extractors change, and users still expect answers during the rebuild.',
        'The lifecycle layer exists to keep construction, validation, promotion, rollback, and cleanup separate. Without it, reindexing becomes a production experiment that can silently change evidence.',
        {type:'callout', text:'A safe RAG index rebuild depends on stable identities and an atomic serving alias, so construction, validation, promotion, rollback, and compaction stay separate.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to mutate the live index in place. When a document changes, overwrite its chunks; when a new embedding model ships, start writing new vectors.',
        'That looks simple because each write is local. It fails because retrieval joins vector hits to text, spans, source documents, ACL filters, freshness metadata, caches, and evaluation traces.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is mixed versions. A vector from embed-v2 can point to text from old chunking, while a citation span still uses old offsets and an ACL filter reads different metadata.',
        'Downtime rebuilds have their own wall. Large corpora take time to rebuild, and new edits keep arriving while the new index is being constructed.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat the index as a versioned evidence graph. Source documents, chunks, embeddings, spans, tombstones, ACL rows, and aliases all need identities and versions that explain how they connect.',
        'The serving alias should move only after the shadow index has been built, caught up with deltas, and validated. Rollback is then another alias move instead of emergency surgery.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Ingestion emits stable document ids, document versions, chunk ids, chunk hashes, span ids, embedding model versions, vector ids, ACL metadata, and freshness state. Writes and deletes go into a delta ledger so a shadow build can catch up.',
        'For a risky change, the team builds index v2 out of band, replays deltas, validates golden queries and access filters, then atomically moves the read alias from v1 to v2. Old v1 stays available until rollback risk is low and audits are safe.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is version consistency. A query through one alias should join vectors, text, spans, filters, and freshness records from a compatible index snapshot.',
        'Tombstones preserve delete correctness during slow cleanup. If a document is deleted at t=10, search can exclude it immediately even if physical vector deletion finishes at t=600.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Alias-based rebuilds require duplicate storage during construction. If v1 has 80 GB of vectors and v2 has 96 GB because the new embedding is larger, the system needs about 176 GB plus metadata during the overlap period.',
        'The behavioral cost is extra operational machinery. Delta replay, validation gates, rollback retention, span-map migration, and tombstone compaction all add work, but they keep retrieval changes observable.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern fits support documentation, product catalogs, internal knowledge bases, legal policies, code search, compliance assistants, and customer-specific document stores. It is most important when citations, freshness, and access control are part of the product contract.',
        'It also supports embedding-model migration. A team can compare v1 and v2 on the same golden queries before exposing users to changed retrieval behavior.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'An alias swap fails if the shadow index is not caught up. Moving the pointer to an index missing the last hour of edits is still a stale release.',
        'It also fails if validation is only aggregate recall. A model migration can improve common questions while breaking exact policy IDs, access-controlled documents, multilingual slices, or citation offsets.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team migrates from 768-dimensional embeddings to 1536-dimensional embeddings for 10 million chunks. If each float is 4 bytes, raw vector storage moves from about 30.7 GB to about 61.4 GB before index overhead.',
        'They build idx_v2, replay 120,000 delta events that arrived during the build, validate 500 golden queries, confirm zero restricted-document leaks, and switch alias prod_docs from idx_v1 to idx_v2. If p95 latency regresses from 80 ms to 180 ms, rollback is a pointer move back to idx_v1 while v2 is investigated.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Elasticsearch alias update guidance, OpenSearch index aliases, Qdrant collection and embedding migration documentation, and Pinecone backup and restore documentation. These show the same production pattern in different vector and search systems.',
        'Study RAG deduplication, citation span indexes, filtered vector search, cache invalidation, CDC streams, Lucene segments, and blue-green deployment next. Index lifecycle is retrieval operations, not only data preprocessing.',
      ],
    },
  ],
};
