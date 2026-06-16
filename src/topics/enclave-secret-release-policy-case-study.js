// Enclave secret release policy: verify attestation claims, bind a public key,
// release only scoped secrets, and seal derived state for later resumes.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'enclave-secret-release-policy-case-study',
  title: 'Enclave Secret Release Policy Case Study',
  category: 'Security',
  summary: 'A key-release case study: attestation claims, nonce freshness, public-key binding, KMS policy predicates, scoped decrypt, sealed state, rotation, and audit.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['secret gate', 'sealed state'], defaultValue: 'secret gate' },
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

function releaseGraph(title) {
  return graphState({
    nodes: [
      { id: 'enc', label: 'enc', x: 0.8, y: 3.5, note: 'workload' },
      { id: 'quote', label: 'quote', x: 2.2, y: 2.0, note: 'claims' },
      { id: 'pk', label: 'pubkey', x: 2.2, y: 5.0, note: 'wrap' },
      { id: 'kms', label: 'KMS', x: 4.0, y: 3.5, note: 'policy' },
      { id: 'meas', label: 'meas', x: 5.6, y: 1.5, note: 'allow' },
      { id: 'iam', label: 'IAM', x: 5.6, y: 3.5, note: 'caller' },
      { id: 'scope', label: 'scope', x: 5.6, y: 5.5, note: 'secret' },
      { id: 'wrap', label: 'wrap', x: 7.4, y: 3.5, note: 'cipher' },
      { id: 'secret', label: 'secret', x: 9.0, y: 2.0, note: 'inside' },
      { id: 'audit', label: 'audit', x: 9.0, y: 5.0, note: 'event' },
    ],
    edges: [
      { id: 'e-enc-quote', from: 'enc', to: 'quote' },
      { id: 'e-enc-pk', from: 'enc', to: 'pk' },
      { id: 'e-quote-kms', from: 'quote', to: 'kms' },
      { id: 'e-pk-kms', from: 'pk', to: 'kms' },
      { id: 'e-kms-meas', from: 'kms', to: 'meas' },
      { id: 'e-kms-iam', from: 'kms', to: 'iam' },
      { id: 'e-kms-scope', from: 'kms', to: 'scope' },
      { id: 'e-scope-wrap', from: 'scope', to: 'wrap' },
      { id: 'e-wrap-secret', from: 'wrap', to: 'secret' },
      { id: 'e-wrap-audit', from: 'wrap', to: 'audit' },
    ],
  }, { title });
}

function sealGraph(title) {
  return graphState({
    nodes: [
      { id: 'secret', label: 'secret', x: 0.8, y: 3.5, note: 'key' },
      { id: 'derive', label: 'derive', x: 2.4, y: 3.5, note: 'session' },
      { id: 'state', label: 'state', x: 4.0, y: 1.8, note: 'cache' },
      { id: 'seal', label: 'seal', x: 4.0, y: 5.2, note: 'bind' },
      { id: 'store', label: 'store', x: 5.8, y: 3.5, note: 'disk' },
      { id: 'resume', label: 'resume', x: 7.4, y: 2.0, note: 'same meas' },
      { id: 'rotate', label: 'rotate', x: 7.4, y: 5.0, note: 'new key' },
      { id: 'audit', label: 'audit', x: 9.0, y: 3.5, note: 'why' },
    ],
    edges: [
      { id: 'e-secret-derive', from: 'secret', to: 'derive' },
      { id: 'e-derive-state', from: 'derive', to: 'state' },
      { id: 'e-derive-seal', from: 'derive', to: 'seal' },
      { id: 'e-state-store', from: 'state', to: 'store' },
      { id: 'e-seal-store', from: 'seal', to: 'store' },
      { id: 'e-store-resume', from: 'store', to: 'resume' },
      { id: 'e-store-rotate', from: 'store', to: 'rotate' },
      { id: 'e-resume-audit', from: 'resume', to: 'audit' },
      { id: 'e-rotate-audit', from: 'rotate', to: 'audit' },
    ],
  }, { title });
}

function* secretGate() {
  yield {
    state: releaseGraph('Secret release joins attestation and key wrapping'),
    highlight: { active: ['enc', 'quote', 'pk', 'kms', 'e-enc-quote', 'e-enc-pk', 'e-quote-kms', 'e-pk-kms'], found: ['wrap'] },
    explanation: 'The enclave sends attestation claims and a public key. The key service verifies the quote and wraps the secret so only the attested enclave can unwrap it.',
    invariant: 'The secret is released to a measured state, not to a host process.',
  };
  yield {
    state: labelMatrix(
      'Policy',
      [
        { id: 'img', label: 'image' },
        { id: 'role', label: 'role' },
        { id: 'tenant', label: 'tenant' },
        { id: 'secret', label: 'secret' },
        { id: 'ttl', label: 'ttl' },
      ],
      [
        { id: 'claim', label: 'claim' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['hash', 'allow'],
        ['caller', 'IAM'],
        ['id', 'match'],
        ['key id', 'scope'],
        ['expiry', 'short'],
      ],
    ),
    highlight: { active: ['img:rule', 'role:rule', 'tenant:rule', 'secret:rule'], compare: ['ttl:rule'] },
    explanation: 'Secret-release policy should bind image measurement, caller identity, tenant, secret scope, and time. Broad decrypt access defeats the point of attestation.',
  };
  yield {
    state: releaseGraph('Only scoped decrypt produces wrapped secret material'),
    highlight: { active: ['meas', 'iam', 'scope', 'wrap', 'secret', 'e-kms-meas', 'e-kms-iam', 'e-kms-scope', 'e-scope-wrap', 'e-wrap-secret'], compare: ['audit'] },
    explanation: 'A successful decision returns ciphertext bound to the enclave public key or session. The host can transport it but should not be able to read it.',
  };
  yield {
    state: releaseGraph('Audit records the exact claims and policy version'),
    highlight: { active: ['quote', 'kms', 'wrap', 'audit', 'e-wrap-audit'], compare: ['secret'] },
    explanation: 'The audit row should store quote digest, policy version, requested secret, caller, tenant, decision, and reason. That is what lets operators prove why a key was released.',
  };
}

function* sealedState() {
  yield {
    state: sealGraph('Derived state can be sealed to a measurement'),
    highlight: { active: ['secret', 'derive', 'state', 'seal', 'e-secret-derive', 'e-derive-state', 'e-derive-seal'], found: ['store'] },
    explanation: 'After release, the workload may derive session keys, cache decrypted model shards, or write resumable state. Sealing binds stored state to an expected enclave measurement or key ladder.',
  };
  yield {
    state: labelMatrix(
      'Seal',
      [
        { id: 'model', label: 'model' },
        { id: 'index', label: 'index' },
        { id: 'cache', label: 'cache' },
        { id: 'token', label: 'token' },
      ],
      [
        { id: 'bind', label: 'bind' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['image hash', 'stale'],
        ['tenant', 'leak'],
        ['version', 'reuse'],
        ['ttl', 'replay'],
      ],
    ),
    highlight: { active: ['model:bind', 'index:bind', 'cache:bind', 'token:bind'], compare: ['token:risk'] },
    explanation: 'Sealed state still needs policy. Bind it to image, tenant, model or index version, and expiration so a future resume cannot silently reuse stale authority.',
  };
  yield {
    state: sealGraph('Resume requires the right measurement or re-release'),
    highlight: { active: ['store', 'resume', 'audit', 'e-store-resume', 'e-resume-audit'], compare: ['rotate'] },
    explanation: 'If the workload resumes under the same approved measurement, it can unseal state. If code, policy, tenant, or key version changes, it should re-attest or discard state.',
  };
  yield {
    state: sealGraph('Rotation creates a controlled break in old state'),
    highlight: { active: ['store', 'rotate', 'audit', 'e-store-rotate', 'e-rotate-audit'], compare: ['resume'] },
    explanation: 'Key rotation, emergency deny lists, or measurement revocation should intentionally make old sealed state unusable, with an audit reason rather than a mysterious decrypt failure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'secret gate') yield* secretGate();
  else if (view === 'sealed state') yield* sealedState();
  else throw new InputError('Pick an enclave secret-release view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An enclave secret-release policy is the gate that decides whether a measured confidential workload may receive a key, token, model shard, or dataset credential.',
        'It is the operational half of remote attestation. Attestation proves the measured state. Secret release turns that proof into a scoped capability.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The enclave produces an attestation document and includes a public key or session binding. The key service verifies claims, compares measurements and identity to policy, and returns a secret encrypted to that public key.',
        'The workload can then derive session keys or seal derived state. Sealed state should be bound to measurement, tenant, version, and TTL so resume does not bypass policy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Secret-release systems need policy rollout, measurement versioning, denial reasons, key rotation, and incident response. The main engineering pain is keeping deployment changes and allow lists synchronized.',
        'The upside is precise blast-radius control. A stolen host credential or copied disk snapshot should not be enough to decrypt the protected secret without the right attested state.',
      ],
    },
    {
      heading: 'Case studies and sources',
      paragraphs: [
        'AWS KMS documents Nitro Enclave condition keys that let KMS policies require attestation claims such as image PCRs before decrypting: https://docs.aws.amazon.com/kms/latest/developerguide/conditions-nitro-enclave.html.',
        'AWS Nitro Enclaves attestation docs describe attestation documents and how external services can verify enclave identity: https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html. Google Cloud Confidential Space uses workload identity and attestation claims for confidential workloads: https://cloud.google.com/confidential-computing/confidential-space/docs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A private inference service can release weights only to the expected serving binary. A clean-room job can release input data only to a measured analytics image. A payment service can release keys only to an enclave with debug disabled and an approved tenant policy.',
        'This pattern also applies to AI agents. Tool credentials can be released only to a measured worker with the expected policy bundle, preventing a prompt-injected web page from directly obtaining host secrets.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not release a broad root secret and rely on the enclave to behave. Release narrow secrets, bind them to claims, expire them quickly, and log decisions.',
        'Do not ignore state sealing. If decrypted state is written to disk without binding and expiration, it can become the path around attestation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: AWS KMS Nitro Enclave condition keys at https://docs.aws.amazon.com/kms/latest/developerguide/conditions-nitro-enclave.html, AWS Nitro attestation at https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html, Google Confidential Space docs at https://cloud.google.com/confidential-computing/confidential-space/docs, and Azure confidential computing overview at https://learn.microsoft.com/en-us/azure/confidential-computing/overview. Study Confidential Computing Attestation Chain Case Study, Confidential GPU Inference Attestation Case Study, Capability Security Attenuation, and OPA Rego Policy Decision Graph next.',
      ],
    },
  ],
};
