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
      heading: 'Why this exists',
      paragraphs: [
        `A confidential workload is only useful if the sensitive capability arrives after the workload proves what it is. If a database password, model key, signing key, or API token is baked into the image, mounted from the host, or attached only to the VM identity, the enclave boundary is mostly decorative. The surrounding host may be able to read the material before the protected code starts.`,
        `Secret release is the bridge between remote attestation and practical authority. Attestation provides signed evidence about the measured program and environment. A release policy decides whether that exact measured program, under that caller, tenant, requested scope, freshness window, and public key binding, may receive a narrow secret.`,
        {type:`callout`, text:`Secret release turns attestation into authority only when the policy binds measurement, caller, scope, freshness, and an enclave-held key before any secret becomes usable.`},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is to give the VM or Pod an IAM role and let the application call KMS directly. The application starts, asks for the secret, decrypts it in memory, and tries to keep plaintext away from logs and disk. This is a normal design for many services where the VM or container boundary is the trusted boundary.`,
        `That design fails for confidential computing because the authority is attached to the host context, not to the measured enclave state. A parent process, copied credential, debug shell, stale image, or compromised deployment path can ask for the same secret without proving that the approved workload is running inside the expected protected boundary.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is authority without measurement. KMS can know who called it, but if policy stops there, it cannot distinguish a production enclave image from a debug build, a stale binary, a different tenant image, or a host process replaying a request that once looked legitimate.`,
        `The second wall appears after the first successful release. Workloads often derive session keys, cache decrypted model shards, build indexes, or write resumable state. If that state is stored without sealing policy, a future run can recover old authority after the measurement, tenant grant, model version, or key policy has changed.`,
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        `The invariant is: no accepted attestation and policy decision, no usable secret. The service can receive requests from an untrusted host, but the response must be useful only to the enclave instance whose evidence was accepted. That means the decision must bind code measurement, caller identity, tenant, requested secret, freshness, and an enclave-controlled public key or session key.`,
        `The host may transport the request and response. It should not be able to unwrap the released secret. The release service should return ciphertext bound to the attested key, not plaintext for the caller to pass along. This keeps the host in the data path without making it part of the trust boundary for the secret material.`,
      ],
    },
    {
      heading: 'Evidence and policy',
      paragraphs: [
        `The release decision is a predicate over evidence. A typical row includes a signed attestation document, vendor or platform certificate chain, nonce or challenge, enclave measurement, image or code hash, caller identity, tenant id, requested secret id, policy version, expiration, and public key binding. Some platforms expose these as KMS condition keys or as claims evaluated by a verifier.`,
        `Policy should be narrow. A rule that says "this role may decrypt this key" is too broad for the confidential-computing case. A better rule says "this caller may receive this secret only when the quote is fresh, the measurement is in the allowed set, the tenant matches, the secret scope is correct, the policy version is active, and the response is wrapped to the enclave public key."`,
      ],
    },
    {
      heading: 'Release mechanics',
      paragraphs: [
        `A common flow has five steps. First, the enclave generates a key pair or session key inside the protected boundary. Second, it asks the platform for an attestation document that includes a fresh challenge and the public key or a digest of it. Third, the host sends the document, requested secret, and caller context to the release service. Fourth, the verifier checks the evidence and policy. Fifth, the service wraps the secret to the enclave-bound key and records the decision.`,
        `Freshness is not optional. Without a nonce or challenge, an old quote can be replayed after the approved workload has stopped. Public-key binding is not optional either. Without it, the host can substitute its own public key and receive a ciphertext it can decrypt. Scope matters because a successful release should not become general decrypt authority for every secret in the account.`,
      ],
    },
    {
      heading: 'Sealed state',
      paragraphs: [
        `After release, the workload may need to persist derived state. It might cache decrypted model partitions, an embedding index, an authorization token, a short-lived session secret, or a progress checkpoint. Sealing encrypts that state so it can be recovered only under an approved measurement, key ladder, tenant, version, and expiration.`,
        `Sealing is not just "encrypt before writing to disk." It is policy for future authority. If the state omits tenant, model version, data version, policy version, or TTL, a future resume can silently bypass a revocation. If the workload changes but old sealed state still opens, the system may keep using authority that the current policy would no longer release.`,
      ],
    },
    {
      heading: 'Audit trail',
      paragraphs: [
        `The audit log is part of the security mechanism, not an afterthought. A release event should store the quote or quote digest, measurement, caller, tenant, requested secret, policy version, decision, reason, public key digest, expiration, and any emergency override or deny-list match. Operators need enough evidence to explain why a key was released or denied.`,
        `Good audit data also supports incident response. If a measurement is later revoked, the team can ask which releases used it, which tenants were affected, which sealed-state blobs may need invalidation, and which policy versions permitted the release. Without that ledger, secret release becomes a black box that is hard to trust during an incident.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Measurement binding makes the request about code state, not just caller identity. Freshness prevents old evidence from being replayed as current evidence. Public-key binding prevents the host from replacing the enclave as the real recipient. Scope and TTL limit damage when the release is valid but later abused by application logic.`,
        `Sealing extends the same logic across restarts. The workload should only recover durable sensitive state when the future environment still satisfies the policy that made the state safe. Rotation, deny lists, and measurement revocation are supposed to break old state. A clear denial is better than a quiet resume under stale authority.`,
      ],
    },
    {
      heading: 'Cost and operations',
      paragraphs: [
        `The hard part is usually operational precision. Every deployment may change image hashes, signer certificates, enclave measurements, driver claims, model digests, or expected policy rows. If rollout and policy update are not coordinated, the correct workload cannot decrypt. If policy is loosened to avoid outages, the security boundary decays.`,
        `Incident handling also needs design before the incident. Teams need deny-list distribution, emergency key rotation, policy rollback, measurement revocation, audit retention, sealed-state migration, and a user-facing explanation for denied releases. The cryptographic primitive is small compared with the lifecycle around it.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `This pattern fits private inference, data clean rooms, payment signing, regulated analytics, secure build workers, and agent tool credentials. In each case, the owner wants to release a capability to a measured worker without trusting the surrounding host as much as the worker.`,
        `It gives useful blast-radius control. A copied disk, leaked host token, stolen deployment credential, or compromised parent process should still lack the accepted measurement and key binding needed to unwrap the protected secret. That does not remove every risk, but it moves the secret release decision closer to the code that will actually use the secret.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Secret release does not prove the code is correct, safe, or free of exfiltration paths. It proves that the released key went to an environment with certain measured claims. Bugs, malicious inputs, side channels, overly broad outbound network access, bad logging, and prompt injection in a higher-level system can still leak sensitive data after a valid release.`,
        `It is also a poor fit when the workload changes too often to maintain meaningful measurements. If every plugin, script, model file, and debug flag forces a new allowlist entry, operators may start allowing broad patterns just to keep deployments moving. At that point attestation has become ceremony rather than a useful gate.`,
      ],
    },
    {
      heading: 'Concrete failures',
      paragraphs: [
        `A KMS rule that checks only IAM role lets the parent host call decrypt directly. A request that does not bind the enclave public key lets the host substitute its own key and unwrap the response. A quote without a nonce can be replayed after the approved workload has stopped. A policy that accepts debug measurements can release production secrets to a build that was never meant to be trusted.`,
        `A sealing policy without tenant, data version, policy version, or TTL can resurrect old decrypted state after revocation. An audit log that stores only "allowed" without claims and policy version cannot support incident response. A rollout process that updates code before policy can cause outages; a process that updates policy too broadly can cause leaks.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Model the release request as a typed object: evidence, freshness, workload identity, caller identity, tenant, requested secret, public key binding, policy version, and desired TTL. Validate each field explicitly and record the decision reason. Keep the release response narrow: one scoped ciphertext, wrapped to the enclave-bound key, with expiration and audit id.`,
        `Separate deploy policy from emergency policy. Normal rollout should add new measurements deliberately and remove old ones after traffic drains. Emergency policy should revoke measurements or key versions quickly and make sealed-state failures explainable. Test with negative cases: stale quote, wrong tenant, wrong public key, debug measurement, revoked measurement, expired policy, and mismatched secret scope.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: AWS KMS Nitro Enclave condition keys at https://docs.aws.amazon.com/kms/latest/developerguide/conditions-nitro-enclave.html, AWS Nitro Enclaves cryptographic attestation at https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html, and Google Confidential Space resource authorization at https://docs.cloud.google.com/confidential-computing/confidential-space/docs/create-grant-access-confidential-resources.`,
        `Study Confidential Computing Attestation Chain Case Study for the quote and certificate path, Confidential GPU Inference Attestation Case Study for accelerator-backed release, Capability Security Attenuation for scoped authority, OPA Rego Policy Decision Graph for policy predicates, and Key Rotation for the lifecycle side of revocation.`,
      ],
    },
  ],
};
