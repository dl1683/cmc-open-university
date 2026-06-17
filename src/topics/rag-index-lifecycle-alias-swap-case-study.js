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
      heading: 'Why this exists',
      paragraphs: [
        'A RAG index lifecycle exists because the retrieval corpus is not static. Documents change, permissions change, chunking rules change, embedding models change, citation extractors change, and customers expect the system to keep serving while all of that happens.',
        'Toy RAG systems usually treat the index as a batch artifact: parse files, chunk text, embed chunks, query vectors. Production systems need more. They need source document versions, stable chunk IDs, vector IDs, citation spans, metadata filters, tombstones, index snapshots, validation gates, and a serving alias that tells applications which physical index is live.',
        'This operational layer decides whether RAG can be changed safely. Re-embedding with a new model changes vector dimensions and ranking behavior. Re-chunking changes offsets and citations. Deletes must hide stale evidence before compaction finishes. A blue/green alias lets the system rebuild safely instead of mutating the only production index in place.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to update the live index in place. When a document changes, overwrite its chunks. When a new embedding model ships, start writing new vectors. When a document is deleted, remove it from whichever collection is convenient.',
        'That fails because retrieval has joins. Vector hits must join back to text, citation spans, source documents, ACL filters, freshness metadata, eval traces, and sometimes lexical search results. If one leg is old and another is new, the answer can cite stale or unauthorized evidence while the system looks healthy.',
        'Another shortcut is a full rebuild with downtime. That can work for small projects, but it does not scale to large corpora or customer-facing assistants. Rebuilds take time, and new edits keep arriving while the rebuild runs. Without a delta ledger or catch-up phase, the new index is stale before it becomes live.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is stable identity across changing artifacts. A RAG index is not just vectors. It is a graph of source documents, chunks, embeddings, spans, filters, versions, tombstones, and aliases. Every node needs an identity that survives rebuilds or clearly records why it changed.',
        'A vector id should be derived from embedding model version plus chunk identity, not from array position. A span id should preserve source offsets or a traceable mapping through re-chunking. A document version should make freshness explicit. ACL metadata should join to the same evidence the model sees.',
        'The alias is a pointer, not the safety mechanism by itself. The safety comes from building a shadow index, replaying deltas, validating gates, then moving the pointer atomically only after the new index is ready.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Ingestion emits stable records: document id, document version, chunk id, chunk hash, embedding model version, vector id, span ids, ACL metadata, and freshness state. Upserts and deletes enter a delta ledger. Deletes become tombstones so search can exclude stale chunks immediately while offline rebuilds later remove dead records from lexical, vector, and span indexes.',
        'For a risky change, the team builds a shadow index. It backfills old documents, replays deltas that arrived during the build, validates golden queries and access-control filters, then atomically moves a read alias from v1 to v2. If the new index fails in production, rollback is another alias move while v1 is still retained.',
        'Promotion gates should include golden-query recall, exact-policy recall, citation-span validity, ACL filtering, dedup behavior, index size, p95 latency, freshness lag, and slice-level regressions. A single aggregate retrieval score can hide severe failures in long-tail or restricted documents.',
        'Cleanup comes after stability. Old indexes, tombstones, and legacy span maps should be retained long enough for rollback, audit, and citation traceability. Compaction is a separate lifecycle step, not something to rush during cutover.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The lifecycle view proves that identity is the backbone of retrieval operations. Source documents become chunks, spans, vectors, tombstones, and aliases with versioned IDs. Those IDs keep citations, eval traces, caches, and ACL filters attached when the index changes.',
        'The stable-ID table proves why array position and ad hoc ids are dangerous. Re-chunking, re-embedding, and deleting documents all break naive joins unless ids carry document, chunk, model, span, and version information.',
        'The blue/green view proves the safe-change pattern. Build v2 out of band, replay deltas, validate it against slices that matter, then move the alias. If catch-up or validation is skipped, the final arrow becomes a risky production experiment instead of a controlled release.',
        'The tombstone plot proves that deletes need an immediate serving-layer effect even if physical compaction takes longer. Users should not see stale evidence just because offline cleanup has not finished.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The lifecycle works because it separates construction from serving. The live application reads through an alias while a new physical index is built, caught up, and tested. Users keep getting answers from the old index until the new one is proven.',
        'It also works because tombstones separate visibility from compaction. A deleted document can be hidden quickly from search while slower cleanup removes old vectors, lexical postings, cached snippets, and span records later.',
        'Stable identity makes evaluation meaningful. If a golden query regresses, engineers can tell whether the cause was parsing, chunking, embedding, filtering, ranking, citation extraction, or prompt packing. Without that identity, every regression becomes a vague retrieval failure.',
      ],
    },
    {
      heading: 'Complete case',
      paragraphs: [
        'A support assistant migrates from embed-v1 to embed-v2. The new model has a different vector dimension, so it cannot share the old vector collection. The team creates idx_v2, re-embeds canonical chunks, preserves span IDs, copies ACL metadata, and replays the delta ledger for edits and deletes that happened during the rebuild.',
        'Before promotion, the team compares v1 and v2 on held-out support questions, checks policy freshness, verifies that sealed documents are filtered, measures p95 latency, and inspects citation span support. Only then does the read alias switch from idx_v1 to idx_v2. The old index remains for rollback until v2 has survived production traffic and compaction has cleaned tombstones.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is duplicate storage during rebuild, extra writes during catch-up, validation infrastructure, and careful cleanup. The payoff is avoiding silent retrieval regressions. A RAG system that cannot replay, compare, and roll back its indexes cannot safely change chunking, embedding models, filters, or citation extraction.',
        'The hardest bugs are mixed-version bugs: some chunks embedded with one model, some with another; citations pointing to old offsets; tombstoned documents still visible through one retrieval leg; or a fusion layer comparing results from indexes with different freshness states. Stable IDs and explicit version fields are the antidote.',
        'There is also a freshness tradeoff. Full rebuilds are cleaner but slower. Delta updates are faster but can accumulate complexity. Many systems need both: deltas for day-to-day changes and periodic rebuilds to compact, re-score, and remove accumulated drift.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This pattern is useful whenever RAG evidence changes under production traffic: support documentation, legal policies, product catalogs, internal knowledge bases, code search, compliance assistants, research corpora, and customer-specific document stores.',
        'It is especially important when access control, citations, and freshness matter. If the assistant can cite sources or answer from restricted documents, the index lifecycle is part of the security and audit boundary.',
        'Alias swaps also make model migrations safer. Teams can compare embedding models, chunking policies, and rerankers on the same golden set before exposing users to the new retrieval behavior.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not treat reindexing as a background script with no product risk. It changes the evidence the model sees. Do not delete source records before citations and eval traces have migrated. Do not rely on a single aggregate recall metric; model migrations often help common queries while hurting exact-policy, multilingual, access-controlled, or long-tail slices.',
        'An alias swap is not magic consistency. The shadow index still has to catch up with writes that happened during the build. If the source of truth is changing quickly, use a delta ledger, CDC stream, or dual-write period with reconciliation before cutover.',
        'A third failure is forgetting rollback. If v1 is deleted immediately after promotion, every production regression becomes urgent surgery. Retain the previous index, span maps, and validation packet until the new index has survived real traffic.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Elastic zero-downtime mapping update guidance at https://www.elastic.co/blog/changing-mapping-with-zero-downtime, Elasticsearch aliases API at https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-update-aliases, OpenSearch index aliases at https://docs.opensearch.org/latest/im-plugin/index-alias/, Qdrant collection and embedding migration guidance at https://qdrant.tech/documentation/manage-data/collections/ and https://qdrant.tech/documentation/tutorials-operations/embedding-model-migration/, and Pinecone backup/restore guidance at https://docs.pinecone.io/guides/manage-data/backups-overview and https://docs.pinecone.io/guides/manage-data/restore-an-index. Study RAG Pipeline, Multi-Index RAG, RAG Dedup, MinHash, and Chunk Canonicalization, RAG Citation Span Index Case Study, Filtered Vector Search and Bitset Gates, Cache Invalidation & Versioning, Debezium CDC Case Study, and Lucene Segments Case Study next.',
      ],
    },
  ],
};
