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
      heading: 'What it is',
      paragraphs: [
        'Private RAG in a confidential enclave protects the retrieval path: user query, embedding, vector index access, retrieved chunks, citations, model context, output, and telemetry.',
        'It is not just RAG plus encryption at rest. The retrieval worker, embedding model, index handle, chunk release policy, and trace schema all become part of the trust boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The worker attests its measured state and receives scoped keys. It embeds the query inside the boundary, searches an encrypted or access-controlled vector index, retrieves scoped chunks, reranks, builds a context pack, and returns an answer with citations.',
        'The trace keeps source ids, policy versions, quote ids, and redacted evidence. Raw query text, raw retrieved documents, embeddings, and cache keys should not spill into ordinary logs unless policy explicitly allows it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Private RAG is slower and more operationally complex than ordinary RAG. It adds attestation, key release, encrypted index loading, stricter cache scopes, redacted tracing, and sometimes hardware constraints.',
        'The payoff is a narrower trust story for enterprise retrieval, data clean rooms, regulated documents, legal research, healthcare search, and private codebase agents.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'Google Confidential Space docs describe confidential workloads with attestation and workload identity: https://cloud.google.com/confidential-computing/confidential-space/docs. Azure confidential computing docs describe trusted execution environments for protecting data in use: https://learn.microsoft.com/en-us/azure/confidential-computing/overview.',
        'NVIDIA confidential computing docs describe protecting accelerated workloads: https://docs.nvidia.com/confidential-computing/latest/. AWS Nitro Enclaves docs describe isolated compute environments and attestation: https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A legal-search product can answer over confidential matter files while keeping raw documents out of shared logs. A healthcare assistant can retrieve patient-specific documents under tenant-scoped keys. A code assistant can search private repos while returning only cited snippets allowed by policy.',
        'The same design supports data clean rooms where one party brings model logic and another brings data, and neither wants to expose raw assets to the cloud host.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not ignore embeddings. Embedding vectors and top-k ids can leak information about the query or corpus. Do not put raw chunks into traces for convenience.',
        'Do not assume an enclave makes bad retrieval safe. Prompt injection, stale evidence, wrong citations, and overbroad chunk release still need normal RAG evaluation and policy gates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Confidential Space at https://cloud.google.com/confidential-computing/confidential-space/docs, Azure confidential computing at https://learn.microsoft.com/en-us/azure/confidential-computing/overview, NVIDIA Confidential Computing at https://docs.nvidia.com/confidential-computing/latest/, and AWS Nitro Enclaves attestation at https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html. Study Confidential GPU Inference Attestation Case Study, Enclave Secret Release Policy Case Study, RAG Pipeline, Claim Graph & Source Ledger, PII Redaction Token Span Pipeline, and SLO-Aware LLM Request Router next.',
      ],
    },
  ],
};
