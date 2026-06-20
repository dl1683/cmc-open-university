// Confidential GPU inference: attest CPU and GPU trust state, release encrypted
// model weights, protect inference traffic, and audit the serving path.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'confidential-gpu-inference-attestation-case-study',
  title: 'Confidential GPU Inference Attestation Case Study',
  category: 'AI & ML',
  summary: 'A secure-AI deployment case study: CPU TEE, GPU attestation, driver trust, encrypted model release, protected inference traffic, tenant policy, and audit traces.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['gpu trust', 'inference path'], defaultValue: 'gpu trust' },
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

function gpuGraph(title) {
  return graphState({
    nodes: [
      { id: 'cpu', label: 'CPU TEE', x: 0.8, y: 3.5, note: 'VM' },
      { id: 'driver', label: 'drv', x: 2.4, y: 2.0, note: 'stack' },
      { id: 'gpu', label: 'GPU', x: 2.4, y: 5.0, note: 'device' },
      { id: 'quote', label: 'quote', x: 4.1, y: 3.5, note: 'CPU+GPU' },
      { id: 'root', label: 'root', x: 5.8, y: 2.0, note: 'vendor' },
      { id: 'policy', label: 'policy', x: 5.8, y: 5.0, note: 'tenant' },
      { id: 'keys', label: 'keys', x: 7.4, y: 3.5, note: 'release' },
      { id: 'model', label: 'model', x: 9.0, y: 2.0, note: 'weights' },
      { id: 'audit', label: 'audit', x: 9.0, y: 5.0, note: 'trace' },
    ],
    edges: [
      { id: 'e-cpu-driver', from: 'cpu', to: 'driver' },
      { id: 'e-cpu-gpu', from: 'cpu', to: 'gpu' },
      { id: 'e-driver-quote', from: 'driver', to: 'quote' },
      { id: 'e-gpu-quote', from: 'gpu', to: 'quote' },
      { id: 'e-root-policy', from: 'root', to: 'policy' },
      { id: 'e-quote-policy', from: 'quote', to: 'policy' },
      { id: 'e-policy-keys', from: 'policy', to: 'keys' },
      { id: 'e-keys-model', from: 'keys', to: 'model' },
      { id: 'e-keys-audit', from: 'keys', to: 'audit' },
    ],
  }, { title });
}

function inferGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 3.5, note: 'tenant' },
      { id: 'tls', label: 'TLS', x: 2.2, y: 3.5, note: 'channel' },
      { id: 'cpu', label: 'CPU', x: 3.7, y: 2.0, note: 'pre/post' },
      { id: 'gpu', label: 'GPU', x: 3.7, y: 5.0, note: 'tokens' },
      { id: 'kv', label: 'KV', x: 5.4, y: 1.6, note: 'tenant' },
      { id: 'batch', label: 'batch', x: 5.4, y: 5.4, note: 'mix' },
      { id: 'out', label: 'out', x: 7.1, y: 3.5, note: 'cipher' },
      { id: 'meter', label: 'meter', x: 8.6, y: 2.0, note: 'cost' },
      { id: 'log', label: 'log', x: 8.6, y: 5.0, note: 'redact' },
    ],
    edges: [
      { id: 'e-client-tls', from: 'client', to: 'tls' },
      { id: 'e-tls-cpu', from: 'tls', to: 'cpu' },
      { id: 'e-cpu-gpu', from: 'cpu', to: 'gpu' },
      { id: 'e-gpu-kv', from: 'gpu', to: 'kv' },
      { id: 'e-gpu-batch', from: 'gpu', to: 'batch' },
      { id: 'e-batch-out', from: 'batch', to: 'out' },
      { id: 'e-kv-out', from: 'kv', to: 'out' },
      { id: 'e-out-meter', from: 'out', to: 'meter' },
      { id: 'e-out-log', from: 'out', to: 'log' },
    ],
  }, { title });
}

function* gpuTrust() {
  yield {
    state: gpuGraph('Confidential inference needs CPU and GPU trust state'),
    highlight: { active: ['cpu', 'driver', 'gpu', 'quote', 'e-cpu-driver', 'e-cpu-gpu', 'e-driver-quote', 'e-gpu-quote'], found: ['policy'] },
    explanation: 'A GPU inference server has more than one trust boundary: confidential VM state, GPU device state, driver stack, fabric path, and model-release policy.',
    invariant: 'A trusted CPU VM is not enough if model weights run on an untrusted accelerator path.',
  };
  yield {
    state: labelMatrix(
      'GPU attn',
      [
        { id: 'cpu', label: 'CPU' },
        { id: 'gpu', label: 'GPU' },
        { id: 'drv', label: 'drv' },
        { id: 'model', label: 'model' },
        { id: 'tenant', label: 'tenant' },
      ],
      [
        { id: 'claim', label: 'claim' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['VM meas', 'host'],
        ['device', 'firmware'],
        ['version', 'shim'],
        ['digest', 'wrong wts'],
        ['policy', 'mixup'],
      ],
    ),
    highlight: { active: ['cpu:claim', 'gpu:claim', 'drv:claim', 'model:claim'], compare: ['tenant:risk'] },
    explanation: 'The verifier wants a joined evidence row: CPU measurement, GPU attestation, driver and firmware versions, model digest, tenant policy, and session public key.',
  };
  yield {
    state: gpuGraph('Policy releases model keys only to approved accelerator state'),
    highlight: { active: ['quote', 'root', 'policy', 'keys', 'model', 'e-root-policy', 'e-quote-policy', 'e-policy-keys', 'e-keys-model'], compare: ['audit'] },
    explanation: 'Encrypted model weights should remain unusable until the verifier accepts both workload state and accelerator trust state. The released key should be scoped to that model and deployment.',
  };
  yield {
    state: gpuGraph('Audit links model release to exact hardware evidence'),
    highlight: { active: ['quote', 'policy', 'keys', 'audit', 'e-keys-audit'], compare: ['model'] },
    explanation: 'A later incident investigation needs to know which CPU image, GPU device state, driver stack, model digest, tenant, and policy version received the decryption key.',
  };
}

function* inferencePath() {
  yield {
    state: inferGraph('Inference traffic crosses protected and shared resources'),
    highlight: { active: ['client', 'tls', 'cpu', 'gpu', 'e-client-tls', 'e-tls-cpu', 'e-cpu-gpu'], found: ['out'] },
    explanation: 'Confidential inference must protect prompts, responses, model weights, and per-tenant runtime state while still using high-throughput batching and GPU memory.',
  };
  yield {
    state: labelMatrix(
      'State',
      [
        { id: 'prompt', label: 'prompt' },
        { id: 'weights', label: 'weights' },
        { id: 'kv', label: 'KV' },
        { id: 'batch', label: 'batch' },
        { id: 'logs', label: 'logs' },
      ],
      [
        { id: 'protect', label: 'protect' },
        { id: 'leak', label: 'leak' },
      ],
      [
        ['TLS/session', 'host'],
        ['enc at rest', 'key scope'],
        ['tenant map', 'cross req'],
        ['policy', 'side channel'],
        ['redact', 'PII'],
      ],
    ),
    highlight: { active: ['prompt:protect', 'weights:protect', 'kv:protect', 'logs:protect'], compare: ['batch:leak'] },
    explanation: 'The serving data structures need tenant tags on KV cache, batch entries, logs, metering rows, and output buffers. Confidential hardware does not remove ordinary isolation bookkeeping.',
  };
  yield {
    state: inferGraph('Batching must preserve tenant and policy boundaries'),
    highlight: { active: ['gpu', 'kv', 'batch', 'out', 'e-gpu-kv', 'e-gpu-batch', 'e-batch-out', 'e-kv-out'], compare: ['client'] },
    explanation: 'Continuous batching is useful, but protected serving must keep tenant ownership and policy state attached to every token stream, KV block, and output chunk.',
  };
  yield {
    state: inferGraph('Telemetry should meter without leaking payloads'),
    highlight: { active: ['out', 'meter', 'log', 'e-out-meter', 'e-out-log'], compare: ['client'] },
    explanation: 'Operators still need latency, tokens, errors, and cost. The telemetry ledger should prefer ids, hashes, counters, and redacted summaries over raw prompts or outputs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'gpu trust') yield* gpuTrust();
  else if (view === 'inference path') yield* inferencePath();
  else throw new InputError('Pick a confidential GPU inference view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `Modern inference moves sensitive material through the accelerator path. Proprietary weights, user prompts, retrieved documents, KV cache, logits, outputs, and telemetry may all touch GPU memory or buffers next to it. CPU-only confidential computing leaves a gap if plaintext data is protected while it enters the VM and then exposed when it moves into an ordinary accelerator runtime.`,
        `Confidential GPU inference exists to close that gap without giving up GPU throughput. The tenant or model owner wants evidence that the confidential VM, GPU device state, driver stack, model artifact, key-release policy, and serving path match an approved deployment before encrypted weights or private prompts become usable.`,
        {type:'callout', text:'Confidential GPU inference only holds if key release and every serving queue bind CPU evidence, accelerator state, model identity, and tenant labels together.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is TLS for requests, encrypted storage for weights, and a normal GPU VM with access controls around the service. That protects data in transit and at rest, and it may be enough when the infrastructure owner, model owner, and data owner are the same party.`,
        `The confidential-computing baseline improves the CPU side: release encrypted model weights only after the VM attests. But if the actual tokens and weights run through a GPU path that policy did not measure, the system still trusts firmware, driver state, host buffers, profiling tools, and shared serving data structures outside the evidence boundary.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is that AI serving is not one trust boundary. It is a chain: confidential VM, GPU firmware and mode, driver, model artifact, key-release policy, request router, batch queue, KV cache, output buffer, metering row, and log pipeline. Evidence for only one link does not secure the whole path.`,
        `The second wall is application bookkeeping. If a shared data structure drops tenant or policy state, confidential hardware cannot repair the leak. A correct launch can still produce cross-tenant KV reuse, raw prompt logs, a debug snapshot containing weights, or a batch entry that routes one tenant's output to another.`,
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        `The key-release invariant is: encrypted weights remain unusable until the verifier accepts both workload state and accelerator state for the requested tenant and model. CPU attestation alone is not enough. GPU evidence alone is not enough. The decision must bind the whole serving state to the key that will unwrap the model.`,
        `The runtime invariant is: confidentiality labels move with data. Prompt buffers, KV blocks, batch slots, output chunks, metering rows, and logs need tenant id, model id, policy id, session id, and lifetime. Once a request enters a high-throughput server, every queue and cache must preserve the boundary that the attestation step established.`,
      ],
    },
    {
      heading: 'Trust record',
      paragraphs: [
        `A useful data model is a joined trust row. It contains the CPU confidential-VM quote, GPU attestation evidence, vendor root, driver and firmware versions, GPU mode, model digest, tenant policy, session public key, key-release decision, and audit span. The verifier evaluates this row before KMS releases the model key.`,
        `The row also gives operators something to investigate later. If a driver version is revoked, a GPU firmware issue appears, or a model digest is found to be wrong, the audit trail can identify which key releases used that state. Without the joined row, the system can say "a key was released" but not whether the accelerator path matched the policy people thought they were enforcing.`,
      ],
    },
    {
      heading: 'Boot and release flow',
      paragraphs: [
        `A typical deployment boots a confidential VM, starts a measured serving stack, establishes a protected session, gathers CPU evidence, gathers GPU evidence, and sends the combined evidence to a verifier. Policy checks measurement, device state, firmware, driver version, model digest, tenant, and session public key. If the row passes, the service releases a model key wrapped to the accepted environment.`,
        `Only then do encrypted weights become usable. The unwrap step should be scoped to the model and session, not a standing ability to decrypt every model artifact. When the service rotates model versions or moves to different hardware, the verifier should see a different trust row and either accept it deliberately or deny release with a clear reason.`,
      ],
    },
    {
      heading: 'Serving path',
      paragraphs: [
        `The serving path still needs the usual high-performance machinery: request routing, tokenization, prefill, decode, continuous batching, KV cache allocation, output streaming, metering, error handling, and logging. Confidential hardware does not remove those structures. It raises the cost of losing ownership metadata inside them.`,
        `Continuous batching is the pressure point. Batching improves throughput by mixing token streams, but each stream must retain tenant, model, policy, and session identity. KV cache blocks need ownership. Output buffers need ownership. Scheduler rows need ownership. If those labels are missing or mutable in the wrong place, the leak is in the software even if the GPU attests correctly.`,
      ],
    },
    {
      heading: 'Telemetry and logs',
      paragraphs: [
        `Operators still need latency, token counts, errors, saturation, queue depth, cost, and hardware health. Confidential inference should not mean blind inference. The design goal is telemetry that explains performance and billing without copying raw prompts, retrieved documents, completions, or plaintext model material into broad log systems.`,
        `Good telemetry prefers ids, hashes, counters, redacted summaries, policy ids, and audit spans. Raw payload logging should be off by default and treated as a separate high-risk capability. Metering rows must keep tenant and model identity, but they do not need full prompts. Debug dumps must be scoped, time-limited, and reviewed because they can bypass the care taken in the main path.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The release side works because encrypted model material stays unusable until the verifier accepts an evidence row that includes the accelerator path. A copied model file, a wrong GPU mode, or an unapproved driver stack does not receive the key. The session public key binding prevents the host from becoming the real decrypting party.`,
        `The runtime side works only when labels stay attached. If each prompt, KV block, batch slot, output chunk, and telemetry row carries tenant and policy identity until deletion, the server can use throughput optimizations without confusing ownership. The hardware boundary and the software ownership model have to agree.`,
      ],
    },
    {
      heading: 'Costs',
      paragraphs: [
        `The deployment cost is high. Teams now care about supported GPU SKUs, confidential-computing modes, firmware, driver versions, VM images, verifier availability, launch latency, key-policy rollout, audit storage, and fallback behavior when attestation is unavailable. A normal GPU upgrade can become a security-policy rollout.`,
        `The engineering cost is also high. Low-level profiling, custom kernels, crash dumps, and performance debugging may be harder under confidential modes. Some optimizations rely on shared buffers or global caches that were not designed to carry tenant labels. Those optimizations need redesign or stronger isolation before they belong in a protected serving path.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `It wins when the model owner, data owner, and infrastructure owner are not the same party. A model provider can serve encrypted weights on cloud GPUs with less trust in the host. A healthcare, finance, or legal tenant can require attested inference for regulated prompts and require redacted telemetry as part of the service contract.`,
        `It also fits data clean rooms, private RAG, sensitive evaluation, and private fine-tuning. The performance question becomes not merely tokens per second. It becomes tokens per second under an auditable boundary, with evidence that the requested model and serving stack were the ones actually used.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Confidential GPU inference is not a model-safety system. It does not prove the model is correct, fair, non-toxic, or resistant to prompt injection. It proves claims about platform state, release policy, and deployment evidence. Application-level safety and data-governance checks still need their own mechanisms.`,
        `It also fails when the surrounding system is sloppy. Retrieval documents outside the protected path, raw prompts in logs, cross-tenant KV reuse, unscoped output buffers, permissive debug endpoints, and unredacted error reports can leak the same sensitive data that the confidential serving path was meant to protect.`,
      ],
    },
    {
      heading: 'Concrete failures',
      paragraphs: [
        `A policy that accepts CPU attestation but ignores GPU state can release weights to a VM that later runs plaintext work on an untrusted accelerator path. A model-release rule without a model digest can decrypt the wrong weights under an otherwise valid deployment. A verifier that ignores driver or firmware version can miss a known-bad stack.`,
        `A batch scheduler that strips tenant ids can mix requests and KV blocks across customers. A metering pipeline that logs raw prompts or completions can leak payloads after inference is done. A fallback path that silently disables confidential mode during capacity pressure can turn an availability event into a confidentiality incident.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Start by listing the assets: weights, prompts, retrieval context, KV cache, logits, outputs, logs, metrics, and debug artifacts. For each asset, write where it is plaintext, who owns it, how long it lives, and which evidence row allows it to exist. Then make the serving code carry tenant and policy fields through request queues, cache allocators, batch records, output streams, and telemetry.`,
        `For release policy, require joined CPU and GPU evidence, model digest, tenant policy, driver and firmware allowlists, session public key binding, and explicit denial reasons. For validation, test wrong model digest, wrong tenant, stale evidence, untrusted GPU mode, revoked driver version, missing label on a KV block, mixed-tenant batch entries, and raw prompt logging.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: NVIDIA Trusted Computing Solutions at https://docs.nvidia.com/nvtrust/index.html, NVIDIA Attestation at https://docs.nvidia.com/attestation/index.html, and Azure Confidential GPU options at https://learn.microsoft.com/en-us/azure/confidential-computing/gpu-options.`,
        `Study Enclave Secret Release Policy Case Study for key-release policy, Confidential Computing Attestation Chain Case Study for evidence validation, Private RAG Confidential Enclave Case Study for retrieval boundaries, LLM Continuous Batching and KV Cache for serving data structures, and SLO-Aware LLM Request Router for routing under policy.`,
      ],
    },
  ],
};
