// Private RAG in a confidential enclave: protect queries, embeddings, vector
// index access, retrieved chunks, citations, and audit traces.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'private-rag-confidential-enclave-case-study',
  title: 'Private RAG Confidential Enclave Case Study',
  category: 'AI & ML',
  summary: 'A privacy-preserving retrieval case study: attested RAG workers, encrypted indexes, scoped data release, protected embeddings, chunk provenance, redacted telemetry, and leakage controls.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rag path', 'leakage map'], defaultValue: 'rag path' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function ragGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.5, note: 'private' },
      { id: 'attest', label: 'attest', x: 2.1, y: 2.0, note: 'worker' },
      { id: 'keys', label: 'keys', x: 2.1, y: 5.0, note: 'scoped' },
      { id: 'embed', label: 'embed', x: 3.8, y: 3.5, note: 'inside' },
      { id: 'index', label: 'index', x: 5.3, y: 2.0, note: 'enc' },
      { id: 'chunks', label: 'chunks', x: 5.3, y: 5.0, note: 'docs' },
      { id: 'rank', label: 'rank', x: 6.9, y: 3.5, note: 'filter' },
      { id: 'llm', label: 'LLM', x: 8.2, y: 2.0, note: 'answer' },
      { id: 'cite', label: 'cite', x: 8.2, y: 5.0, note: 'proof' },
      { id: 'audit', label: 'audit', x: 9.5, y: 3.5, note: 'redact' },
    ],
    edges: [
      { id: 'e-query-attest', from: 'query', to: 'attest' },
      { id: 'e-attest-keys', from: 'attest', to: 'keys' },
      { id: 'e-keys-embed', from: 'keys', to: 'embed' },
      { id: 'e-query-embed', from: 'query', to: 'embed' },
      { id: 'e-embed-index', from: 'embed', to: 'index' },
      { id: 'e-index-chunks', from: 'index', to: 'chunks' },
      { id: 'e-chunks-rank', from: 'chunks', to: 'rank' },
      { id: 'e-rank-llm', from: 'rank', to: 'llm' },
      { id: 'e-rank-cite', from: 'rank', to: 'cite' },
      { id: 'e-llm-audit', from: 'llm', to: 'audit' },
      { id: 'e-cite-audit', from: 'cite', to: 'audit' },
    ],
  }, { title });
}

function leakGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 0.8, y: 3.5, note: 'query' },
      { id: 'emb', label: 'emb', x: 2.2, y: 1.6, note: 'vector' },
      { id: 'topk', label: 'top-k', x: 2.2, y: 3.5, note: 'ids' },
      { id: 'docs', label: 'docs', x: 2.2, y: 5.4, note: 'text' },
      { id: 'logs', label: 'logs', x: 4.0, y: 2.0, note: 'telemetry' },
      { id: 'cache', label: 'cache', x: 4.0, y: 5.0, note: 'reuse' },
      { id: 'policy', label: 'policy', x: 5.8, y: 3.5, note: 'gate' },
      { id: 'redact', label: 'redact', x: 7.4, y: 2.0, note: 'trace' },
      { id: 'deny', label: 'deny', x: 7.4, y: 5.0, note: 'scope' },
      { id: 'report', label: 'report', x: 9.0, y: 3.5, note: 'audit' },
    ],
    edges: [
      { id: 'e-input-emb', from: 'input', to: 'emb' },
      { id: 'e-input-topk', from: 'input', to: 'topk' },
      { id: 'e-input-docs', from: 'input', to: 'docs' },
      { id: 'e-emb-logs', from: 'emb', to: 'logs' },
      { id: 'e-topk-cache', from: 'topk', to: 'cache' },
      { id: 'e-docs-cache', from: 'docs', to: 'cache' },
      { id: 'e-logs-policy', from: 'logs', to: 'policy' },
      { id: 'e-cache-policy', from: 'cache', to: 'policy' },
      { id: 'e-policy-redact', from: 'policy', to: 'redact' },
      { id: 'e-policy-deny', from: 'policy', to: 'deny' },
      { id: 'e-redact-report', from: 'redact', to: 'report' },
      { id: 'e-deny-report', from: 'deny', to: 'report' },
    ],
  }, { title });
}

function* ragPath() {
  yield {
    state: ragGraph('Private RAG begins with attested retrieval workers'),
    highlight: { active: ['query', 'attest', 'keys', 'embed', 'e-query-attest', 'e-attest-keys', 'e-keys-embed', 'e-query-embed'], found: ['index'] },
    explanation: 'A private RAG worker first proves its measured state, receives scoped keys, and embeds the private query inside the protected boundary.',
    invariant: 'The retrieval worker is part of the trust boundary, not just a stateless API call.',
  };
  yield {
    state: labelMatrix(
      'RAG state',
      [
        { id: 'query', label: 'query' },
        { id: 'emb', label: 'emb' },
        { id: 'index', label: 'index' },
        { id: 'chunk', label: 'chunk' },
        { id: 'cite', label: 'cite' },
      ],
      [
        { id: 'protect', label: 'protect' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['session', 'user id'],
        ['inside', 'model id'],
        ['enc', 'version'],
        ['scoped', 'source'],
        ['redact', 'claim'],
      ],
    ),
    highlight: { active: ['query:protect', 'emb:protect', 'index:protect', 'chunk:proof'], compare: ['cite:protect'] },
    explanation: 'Private RAG has more protected state than ordinary RAG: query text, embedding vector, vector index access, retrieved chunk text, citations, and telemetry.',
  };
  yield {
    state: ragGraph('Retrieved chunks carry scope and provenance'),
    highlight: { active: ['index', 'chunks', 'rank', 'cite', 'e-embed-index', 'e-index-chunks', 'e-chunks-rank', 'e-rank-cite'], compare: ['llm'] },
    explanation: 'The retriever should return chunk ids, source ids, access scope, freshness, and provenance, not just text. The LLM context pack needs enough evidence to answer and enough policy to avoid leaking.',
  };
  yield {
    state: ragGraph('The answer trace is redacted but still auditable'),
    highlight: { active: ['rank', 'llm', 'cite', 'audit', 'e-rank-llm', 'e-rank-cite', 'e-llm-audit', 'e-cite-audit'], compare: ['query'] },
    explanation: 'Audit records should prove which sources supported the answer without dumping private query text or documents into ordinary logs.',
  };
}

function* leakageMap() {
  yield {
    state: leakGraph('Private RAG leaks through side ledgers first'),
    highlight: { active: ['input', 'emb', 'topk', 'docs', 'e-input-emb', 'e-input-topk', 'e-input-docs'], found: ['policy'] },
    explanation: 'The obvious secret is document text, but query embeddings, top-k ids, cache keys, logs, timings, and citation snippets can also reveal sensitive facts.',
  };
  yield {
    state: labelMatrix(
      'Leaks',
      [
        { id: 'logs', label: 'logs' },
        { id: 'cache', label: 'cache' },
        { id: 'ids', label: 'ids' },
        { id: 'time', label: 'time' },
        { id: 'cite', label: 'cite' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'control', label: 'control' },
      ],
      [
        ['raw text', 'redact'],
        ['key reuse', 'scope'],
        ['doc names', 'hash'],
        ['pattern', 'bucket'],
        ['snippet', 'policy'],
      ],
    ),
    highlight: { active: ['logs:control', 'cache:control', 'ids:control', 'cite:control'], compare: ['time:risk'] },
    explanation: 'The controls are data structures: scoped cache keys, redacted trace schemas, hashed ids, timing buckets, citation policies, and per-tenant index handles.',
  };
  yield {
    state: leakGraph('Policy routes redaction and denial separately'),
    highlight: { active: ['logs', 'cache', 'policy', 'redact', 'deny', 'e-logs-policy', 'e-cache-policy', 'e-policy-redact', 'e-policy-deny'], compare: ['docs'] },
    explanation: 'Some values are safe to keep after redaction. Others should be denied or omitted entirely. The policy should distinguish log safety from answer safety.',
  };
  yield {
    state: leakGraph('Reports keep evidence without raw private payloads'),
    highlight: { active: ['redact', 'deny', 'report', 'e-redact-report', 'e-deny-report'], compare: ['input'] },
    explanation: 'The final report should preserve counts, source ids, policy versions, quote ids, and citation support while keeping raw private payloads inside the confidential boundary.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rag path') yield* ragPath();
  else if (view === 'leakage map') yield* leakageMap();
  else throw new InputError('Pick a private RAG enclave view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the RAG path as a protected dataflow. Active nodes show private state being handled, compare nodes show state that should not leak, and found nodes show evidence that can support an answer. RAG means retrieval-augmented generation: retrieve relevant documents, place selected text in model context, and generate an answer grounded in those sources.',
        'The leakage map teaches that the secret is not only document text. Embeddings, top-k ids, cache keys, timing, snippets, and traces can also reveal what the user asked or which document mattered. The safe inference is that every artifact needs a release rule.',
        {type:'callout', text:'Private RAG only works when privacy follows every retrieval artifact: query, embedding, chunk, citation, cache key, and trace.'},
      ],
    },
    { heading: 'Why this exists', paragraphs: [
      'Private RAG lets a model answer from sensitive corpora such as legal matters, patient records, private code, or customer documents. Ordinary access control protects storage, but the retrieval worker eventually decrypts text, computes embeddings, ranks chunks, and writes telemetry. That is the moment data is in use.',
      'A confidential enclave narrows who and what must be trusted during that moment. The worker proves its measured code and configuration through attestation, receives scoped keys, and emits only policy-approved answer and audit fields.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious enterprise approach is TLS, encryption at rest, IAM checks, tenant ids, and an access-controlled vector database. Those controls are necessary and often sufficient for ordinary internal search. They do not protect raw text after the service decrypts it for retrieval.',
      'Another common approach is to redact logs after the fact. That misses embeddings, top-k ids, cache keys, and snippets that may already have left the protected path. Privacy needs to shape the state model before retrieval runs.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is side-channel data. A top-k id can reveal that a merger document, diagnosis note, or security incident matched the query. A cache hit can reveal repeated interest. A citation snippet can leak text that the user may read but the platform must not store.',
      'Policy checks at the final answer are too late. If chunks were logged, cached under broad keys, or sent to an external model route before policy ran, the leak already happened. The retrieval path itself must be inside the privacy boundary or under equivalent controls.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Treat every RAG artifact as typed security state. Query text, embedding vector, index handle, candidate id, chunk text, source id, citation span, model route, cache key, metric label, and trace field each need a release rule. Some can leave as hashes or buckets; others must not leave at all.',
      'The invariant is scoped release. A worker gets keys only after attestation matches policy, and every outbound field is checked against tenant, corpus, session, and purpose. The answer path and the log path are different release decisions.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The client sends a query to a worker that can produce an attestation document. A key service checks the measurement, signer, debug status, workload identity, tenant, and policy version. Only then does it release keys for the allowed corpus and operation.',
      'Embedding, vector search, reranking, chunk filtering, context packing, and citation mapping run inside the protected boundary or under the same data-in-use policy. The trace records source ids, quote ids, score buckets, model route, and denial counts instead of raw private text.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The security argument is trust reduction. Instead of trusting every host process, operator, log sink, cache, and debug tool, the system trusts a measured worker and a key-release policy. Data can be decrypted only inside the approved runtime.',
      'The audit argument is provenance without payload. An answer can point to source ids, chunk ids, quote ids, and policy versions without storing the query or full document outside the boundary. That gives reviewers evidence while avoiding a second leak through observability.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Private RAG adds attestation latency, key-service dependency, image measurement, stricter cache scopes, redacted tracing, enclave lifecycle work, and hardware constraints. Debugging becomes harder because the most useful fields are the fields the system is not allowed to log.',
      'Caching behavior changes. A normal cache key might use a query embedding and corpus id; a private cache key may also need tenant, policy version, measurement, release scope, and expiration. That lowers hit rate but prevents cross-scope reuse.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'A law firm can search matter files while ordinary platform logs keep only source ids and policy hashes. A healthcare assistant can retrieve patient notes under scoped keys and store redacted audit facts. A code assistant can search private repositories while preserving citation provenance.',
      'Data clean rooms use the same structure. One party brings data, another brings code, and secret release depends on measured execution rather than broad platform trust. The common pattern is protected computation plus narrow evidence export.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'An enclave does not make retrieval correct. It can protect stale chunks, irrelevant chunks, or prompt-injected chunks. Citation support, freshness, access control, and answer evaluation still need ordinary RAG tests.',
      'The design also fails through operational shortcuts. Debug enclaves, unsigned images, broad KMS policies, shared caches, unredacted traces, and emergency log dumps can collapse the trust story. Privacy must be tested in incident paths, not only in the happy path.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A legal tenant asks what contract C-184 says about termination fees. The enclave embeds the query, searches a scoped index, retrieves 5 candidate chunks, and selects 2 quote spans for the answer. The outside trace records tenant hash, policy version 17, source ids, quote ids, score buckets, and one denied chunk count.',
      'The raw query, embedding vector, full chunks, and prompt do not leave the protected boundary. An auditor can later see that quote Q2 from source S91 supported the answer and that policy 17 allowed release to this user. The audit path proves support without becoming a copy of the matter file.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Google Confidential Space at https://cloud.google.com/confidential-computing/confidential-space/docs, Azure confidential computing at https://learn.microsoft.com/en-us/azure/confidential-computing/overview, NVIDIA Confidential Computing at https://docs.nvidia.com/confidential-computing/latest/, AWS Nitro Enclaves overview at https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html, and AWS Nitro Enclaves attestation at https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html.',
      'Study RAG Pipeline, confidential GPU inference attestation, enclave secret release policy, PII redaction, claim-source ledgers, prompt-injection defense, and SLO-aware model routing before trusting this with sensitive production data.',
    ] },
  ],
};
