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
      heading: 'Why this exists',
      paragraphs: [
        "RAG turns private data into model context. That is useful, but it widens the leak surface: the query, embedding, vector index access pattern, top-k ids, retrieved chunks, citations, prompt, answer, cache key, and trace can all reveal sensitive facts.",
        "The reasonable first attempt is ordinary enterprise security: TLS, encryption at rest, a private network, tenant ids, IAM checks, and access-controlled vector storage. Those controls matter. They do not protect the moment where the retrieval worker decrypts data, embeds the query, ranks chunks, and writes telemetry.",
        "A confidential-enclave RAG design protects data in use. The retrieval path runs inside an attested boundary, receives scoped keys only after policy approval, and emits an answer trace that can be audited without dumping raw private payloads into ordinary logs.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is not only document text. Embeddings can leak semantic content. Top-k ids can reveal which matter, patient, customer, or source was relevant. Timing and cache hits can expose repeated queries. Citation snippets can leak text that the user was allowed to use in context but the product was not allowed to store in telemetry.",
        "Policy checks after retrieval are too late. If raw chunks were already written to logs, cached under broad keys, or sent to a shared model endpoint, the leak happened before the final answer policy ran. Privacy has to be designed into the retrieval state model.",
      ],
    },
    {
      heading: 'Core insight and state model',
      paragraphs: [
        "The core record starts with an attestation result: measured worker image, runtime configuration, enclave or TEE identity, signing certificate or measurement, tenant, policy version, and key-release decision. Keys are scoped to the tenant, corpus, session, and operation.",
        "The protected RAG state includes query text, embedding vector, index handle, search parameters, candidate chunk ids, retrieved text, source provenance, ACL scope, freshness, rerank score, context-pack decision, model route, output, and citation map.",
        "The leakage ledger is just as important. It defines which fields may leave the boundary, which must be hashed, which must be bucketed, which must be redacted, and which must be omitted. A private RAG system without a trace schema usually leaks through its debugging tools first.",
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        "The worker first proves what code and configuration it is running. A key service checks the attestation document against policy and releases only the keys needed for this tenant and corpus. If the measurement, signer, debug mode, workload identity, or policy version is wrong, the request stops before private data is decrypted.",
        "Embedding, vector search, reranking, chunk filtering, and context packing run inside the protected boundary or under equivalent data-in-use controls. The retriever returns more than text: it returns source id, chunk id, ACL scope, quote id, freshness, and provenance so the answer can be checked later.",
        "The output path separates answer safety from log safety. A user may be allowed to see a citation, while the platform log may only keep a source id, quote id, policy hash, score bucket, and count. Those are different release decisions.",
        "The context pack should be treated as a structured object, not as a string blob. Each chunk needs a reason for release, a source pointer, a quote boundary, and a policy result. That makes later filtering possible. If the context is just concatenated text, the system has no clean place to remove a denied passage or prove which sentence supported a claim.",
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "The RAG path view separates the system into trust-boundary steps: query intake, attestation, key release, embedding, encrypted index access, chunk selection, LLM answer, citation proof, and redacted audit. The important lesson is that privacy is not one box on the edge. It has to stay attached to every state transition.",
        "The leakage map view shows why private RAG is a data-structure problem as much as a security problem. Logs, cache keys, top-k ids, embeddings, timing buckets, and citation snippets are all ledgers. If those ledgers are not typed and scoped, they become accidental side channels.",
        "The highlighted controls also show the difference between redaction and denial. Redaction keeps a safe derived fact, such as a source id or count. Denial prevents a value from leaving the boundary at all. Production systems need both because some fields can be summarized safely and others cannot.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The security argument is a narrowing of trust. Instead of trusting every host process, operator, log sink, cache, and model route, the system trusts a measured worker plus a key-release policy. The worker can only read the data its attestation and scope allow.",
        "The audit argument is provenance. Every released answer should point back to source ids, chunk ids, quote ids, policy versions, and model routes. The trace must let an auditor explain why an answer was allowed without exposing the private query or full documents again.",
        "This is not a correctness proof for RAG. The enclave can protect the wrong chunk just as well as the right one. Retrieval quality, citation support, prompt-injection defense, stale-index handling, and answer evaluation still need ordinary RAG controls.",
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        "Private RAG is slower and harder to operate than ordinary RAG. It adds attestation, key release, image measurement, stricter cache scopes, redacted tracing, enclave lifecycle management, and sometimes hardware or accelerator constraints.",
        "Caching becomes less efficient because keys must include tenant, corpus, policy, measurement, and release scope. Index management becomes harder because encrypted or enclave-local indexes are less flexible than a shared vector service. Observability becomes harder because the most useful debug fields are often the fields you cannot log.",
        "The production question is whether the narrower trust boundary is worth the latency, memory, and operational cost. It often is for regulated documents, high-value intellectual property, legal matter files, healthcare data, private code, and multi-party clean rooms.",
        "There is also a developer-productivity cost. Engineers lose the habit of dumping prompts, chunks, and model outputs into a log line. They need replay packets, synthetic fixtures, redaction-aware debug views, and separate break-glass procedures. Without those tools, teams either fly blind or quietly bypass the privacy design during incidents.",
      ],
    },
    {
      heading: 'Production uses',
      paragraphs: [
        "A law firm can let an assistant search matter files while keeping raw documents out of shared logs. A healthcare workflow can retrieve patient-specific notes under tenant-scoped keys and store only redacted audit facts. A code assistant can search private repositories and release only cited snippets allowed by policy.",
        "A concrete legal query might enter as raw text inside the enclave, become an embedding inside the boundary, retrieve three scoped chunks, and return two cited claims. The telemetry outside the boundary records tenant id, policy version, source ids, quote ids, score buckets, and denial counts. It does not record the query or full chunks.",
        "Data clean rooms use the same pattern. One party can bring data, another can bring model or analysis code, and the key-release policy can require attestation before either side's sensitive asset is decrypted for computation.",
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        "Start by classifying every field in the RAG path: query, embedding, index id, candidate id, chunk text, score, prompt, output, citation, trace, cache key, and metric label. Decide which fields are raw secrets, which are safe derived facts, and which are safe only after hashing, bucketing, or policy filtering.",
        "Make attestation failure boring and common in tests. The system should fail closed when the worker image changes, a debug flag is enabled, a signer is wrong, a policy version is stale, or a key request asks for a broader corpus than the session allows. If those cases are not exercised, the first real failure will happen during an upgrade.",
        "Keep quality evaluation separate from privacy evaluation. Retrieval recall, answer faithfulness, and citation coverage still need ordinary RAG tests, but privacy tests should inspect traces, cache keys, metrics, replay artifacts, and denial paths. A system can answer correctly and still leak through its observability layer.",
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        "The easiest failure is logging raw chunks for convenience. The second easiest is treating embeddings, top-k ids, and cache keys as harmless metadata. They are often enough to infer the user, corpus, or query class.",
        "Enclaves also do not remove application-level risk. Prompt injection can still steer the model. Stale evidence can still produce a wrong answer. Overbroad chunk release can still expose irrelevant private text. A model route outside the boundary can still receive context that policy should have denied.",
        "Operational details matter. Debug-mode enclaves, unsigned images, broad KMS policies, stale measurements, shared caches, and unredacted traces can collapse the trust story even when the retrieval algorithm is otherwise sound.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Confidential Space at https://cloud.google.com/confidential-computing/confidential-space/docs, Azure confidential computing at https://learn.microsoft.com/en-us/azure/confidential-computing/overview, NVIDIA Confidential Computing at https://docs.nvidia.com/confidential-computing/latest/, AWS Nitro Enclaves overview at https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave.html, and AWS Nitro Enclaves attestation at https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html.',
        'Study Confidential GPU Inference Attestation Case Study for protected model serving, Enclave Secret Release Policy Case Study for key gating, RAG Pipeline for retrieval basics, Claim Graph & Source Ledger for citation support, PII Redaction Token Span Pipeline for trace safety, and SLO-Aware LLM Request Router for production routing.',
      ],
    },
  ],
};
