// ACME certificate issuance: account keys, orders, authorizations,
// challenges, validation evidence, finalized CSRs, and logged certificates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'acme-order-challenge-certificate-issuance-case-study',
  title: 'ACME Order Challenge Certificate Issuance',
  category: 'Security',
  summary: 'How ACME turns a domain-control proof into an issued certificate through account keys, orders, authorizations, challenges, CSRs, and issuance state.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['order flow', 'challenge proof'], defaultValue: 'order flow' },
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

function acmeGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'acct', label: 'acct', x: 0.7, y: 4.0, note: notes.acct ?? 'JWS key' },
      { id: 'nonce', label: 'nonce', x: 2.0, y: 2.5, note: notes.nonce ?? 'anti replay' },
      { id: 'order', label: 'order', x: 3.2, y: 4.0, note: notes.order ?? 'names' },
      { id: 'authz', label: 'authz', x: 4.6, y: 5.8, note: notes.authz ?? 'domain' },
      { id: 'chall', label: 'chall', x: 4.6, y: 2.2, note: notes.chall ?? 'http/dns' },
      { id: 'token', label: 'token', x: 6.1, y: 2.2, note: notes.token ?? 'key auth' },
      { id: 'va', label: 'VA', x: 7.3, y: 4.0, note: notes.va ?? 'validate' },
      { id: 'csr', label: 'CSR', x: 8.4, y: 5.8, note: notes.csr ?? 'finalize' },
      { id: 'cert', label: 'cert', x: 9.3, y: 4.0, note: notes.cert ?? 'issued' },
      { id: 'ct', label: 'CT', x: 8.4, y: 2.2, note: notes.ct ?? 'logged' },
    ],
    edges: [
      { id: 'e-acct-nonce', from: 'acct', to: 'nonce' },
      { id: 'e-acct-order', from: 'acct', to: 'order' },
      { id: 'e-order-authz', from: 'order', to: 'authz' },
      { id: 'e-order-chall', from: 'order', to: 'chall' },
      { id: 'e-chall-token', from: 'chall', to: 'token' },
      { id: 'e-token-va', from: 'token', to: 'va' },
      { id: 'e-authz-va', from: 'authz', to: 'va' },
      { id: 'e-va-csr', from: 'va', to: 'csr' },
      { id: 'e-csr-cert', from: 'csr', to: 'cert' },
      { id: 'e-cert-ct', from: 'cert', to: 'ct' },
    ],
  }, { title });
}

function* orderFlow() {
  yield {
    state: acmeGraph('An ACME account key signs replay-protected requests'),
    highlight: { active: ['acct', 'nonce', 'order', 'e-acct-nonce', 'e-acct-order'], compare: ['authz'] },
    explanation: 'ACME starts with a signed account request, not with a certificate. The account key identifies the client, and the server nonce stops an old JWS request from being replayed into the issuance ledger.',
    invariant: 'Issuance is gated by account identity, replay protection, authorization state, and final certificate request state.',
  };

  yield {
    state: acmeGraph('A new order expands into per-identifier authorizations', { order: 'api+www', authz: 'pending' }),
    highlight: { active: ['order', 'authz', 'chall', 'e-order-authz', 'e-order-chall'], found: ['acct'] },
    explanation: 'The requested names expand into authorization objects. Each identifier needs a path to valid state, so one order may fan out into several domain-control challenges.',
  };

  yield {
    state: acmeGraph('Successful challenges move authorizations to valid', { chall: 'dns-01', token: 'TXT ok', va: 'valid', authz: 'valid' }),
    highlight: { active: ['chall', 'token', 'va', 'authz', 'e-chall-token', 'e-token-va', 'e-authz-va'], compare: ['csr'] },
    explanation: 'The validation authority checks evidence from the public internet, not from the client machine. dns-01 proves control through a TXT record; http-01 proves control through a token response at a well-known path.',
  };

  yield {
    state: acmeGraph('Finalization signs a CSR and returns an issued certificate', { csr: 'ready', cert: 'issued', ct: 'SCT' }),
    highlight: { found: ['va', 'csr', 'cert', 'ct', 'e-va-csr', 'e-csr-cert', 'e-cert-ct'], active: ['order'] },
    explanation: 'Only after the required authorizations become valid does the client finalize with a CSR. The CA can then issue the certificate, usually produce CT evidence, and let the client install it for TLS.',
  };
}

function* challengeProof() {
  yield {
    state: labelMatrix(
      'ACME object states',
      [
        { id: 'order', label: 'order' },
        { id: 'authz', label: 'authz' },
        { id: 'chall', label: 'chall' },
        { id: 'cert', label: 'cert' },
      ],
      [
        { id: 'start', label: 'start' },
        { id: 'good', label: 'good' },
        { id: 'bad', label: 'bad' },
      ],
      [
        ['pend', 'ready', 'bad'],
        ['pend', 'valid', 'bad'],
        ['pend', 'valid', 'bad'],
        ['none', 'issued', 'rev'],
      ],
    ),
    highlight: { active: ['order:good', 'authz:good', 'chall:good'], compare: ['cert:good'], removed: ['chall:bad'] },
    explanation: 'ACME is a visible state machine. Clients poll and advance orders, authorizations, challenges, and finalization, so retries can resume from the current object state instead of starting over blindly.',
    invariant: 'The CA issues only after every required authorization becomes valid.',
  };

  yield {
    state: labelMatrix(
      'Challenge evidence',
      [
        { id: 'http01', label: 'http01' },
        { id: 'dns01', label: 'dns01' },
        { id: 'tlsalpn', label: 'alpn' },
        { id: 'bad', label: 'bad' },
      ],
      [
        { id: 'where', label: 'where' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['path', 'token'],
        ['TXT', 'digest'],
        ['cert', 'ext'],
        ['private', 'no'],
      ],
    ),
    highlight: { active: ['http01:proof', 'dns01:proof', 'tlsalpn:proof'], removed: ['bad:proof'] },
    explanation: 'Each challenge converts domain control into a public lookup. The proof must be reachable by the CA validation authority; a private-only record or internal HTTP path proves nothing to the public CA.',
  };

  yield {
    state: acmeGraph('DNS-01 ties issuance to DNS propagation and cache behavior', { chall: 'dns-01', token: 'TXT', va: 'query', cert: 'wait' }),
    highlight: { active: ['chall', 'token', 'va', 'e-chall-token', 'e-token-va'], compare: ['cert'], found: ['authz'] },
    explanation: 'DNS-01 is powerful because it can issue wildcard certificates, but it inherits DNS TTL, negative-cache, and delegation behavior. A stale NXDOMAIN or slow TXT propagation can delay issuance even when the client updated the zone.',
  };

  yield {
    state: labelMatrix(
      'Issuance guardrails',
      [
        { id: 'nonce', label: 'nonce' },
        { id: 'acct', label: 'acct' },
        { id: 'CAA', label: 'CAA' },
        { id: 'CT', label: 'CT' },
      ],
      [
        { id: 'guards', label: 'guards' },
        { id: 'miss', label: 'if weak' },
      ],
      [
        ['replay', 'dup req'],
        ['client', 'takeover'],
        ['issuer', 'wrong CA'],
        ['visible', 'hidden'],
      ],
    ),
    highlight: { found: ['nonce:guards', 'acct:guards', 'CAA:guards', 'CT:guards'], compare: ['CT:miss'] },
    explanation: 'Production issuance is more than passing a challenge. The control plane tracks account-key custody, CAA policy, replay nonces, authorization reuse, CT logging, rate limits, and renewal timing.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'order flow') yield* orderFlow();
  else if (view === 'challenge proof') yield* challengeProof();
  else throw new InputError('Pick an ACME view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/3/34/HTTPS_icon.svg', alt:'HTTPS padlock icon', caption:'The HTTPS padlock that ACME automation made universal. Source: Wikimedia Commons, Fabián Alexis, CC BY-SA 3.0'},
        'TLS certificates bind public names to public keys, and those certificates expire. Manual issuance works for a small number of servers, but it breaks down when domains, containers, load balancers, service meshes, and short-lived environments all need renewal before an outage window. The hard problem is not creating a certificate file. The hard problem is automating public proof, CA policy, retryable state, and safe deployment.',
        'ACME is the protocol that turns certificate issuance into a state machine. A client proves control of requested identifiers, the certificate authority validates that proof from the public internet, the client finalizes the order with a certificate signing request, and the CA returns an issued certificate. The protocol is interesting because it treats issuance as a graph of resources rather than as one opaque "give me a cert" call.',
      ],
    },
    {
      heading: 'The naive baseline',
      paragraphs: [
        'The naive automation is a single API request: send `api.example.com`, an account token, and a public key to the CA, then receive a certificate. That is easy to imagine, but it hides almost every important boundary. The CA still needs to know whether the requester controls the domain, whether each name in the request is allowed, whether the same signed request is being replayed, and whether issuance should resume after a partial failure.',
        'Another baseline is a human approval workflow. A person clicks through a CA portal, places a file on a web server or edits DNS, downloads the certificate, and installs it. That can be audited, but it does not fit automatic renewal. It also tends to encode state in email, tickets, and runbooks instead of in protocol resources that software can inspect.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Domain control is not a single permanent fact. A client may control `www.example.com` but not `api.example.com`. A wildcard request needs a stronger DNS-based proof than a simple HTTP path. A host can be reachable from inside a private network but invisible to the CA validation authority. DNS can be stale, split-horizon, cached negatively, or delegated through a chain the client did not expect.',
        'Issuance is also stateful. Nonces expire. Orders can be pending, ready, valid, invalid, or expired. Authorizations can be reused within limits or fail independently. Challenges can be attempted, validated, or rejected. Rate limits apply. The final CSR must match the identifiers the order allows. A robust protocol needs to expose those intermediate states so clients can retry safely instead of guessing what happened.',
        {type:'callout', text:'Manual certificate renewal is not just slow — it is a reliability hazard. Every certificate has an expiry date, and every missed renewal is an outage.'},
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/d/d5/PKI_certificate_hierarchy.svg', alt:'PKI certificate hierarchy', caption:'Public Key Infrastructure certificate chain. Source: Wikimedia Commons, CC BY-SA 4.0'},
        'ACME models certificate issuance as a dependency graph. An account key identifies the client. A new order names the identifiers to be certified. The order points to authorization objects. Each authorization offers one or more challenge types. A challenge depends on public evidence that the validation authority can check. The certificate depends on all required authorizations becoming valid and on a final CSR.',
        {type:'callout', text:'ACME replaces human proof of domain ownership with machine-verifiable challenges: place a file at a well-known HTTP path, set a DNS TXT record, or respond on a TLS handshake. The CA never trusts the applicant — it trusts the challenge response.'},
        'The graph is advanced through signed JWS requests with server-provided nonces. The signature ties the request to the ACME account. The nonce prevents an old signed request from being replayed later. The resource URLs and states make the protocol resumable: a client can fetch the order, inspect which authorization is still pending, repair the public proof, and continue.',
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        'The order-flow view shows the protocol resources in dependency order: account, nonce, order, authorization, challenge, validation authority, CSR, certificate, and Certificate Transparency. Follow the path from account key to order first, then from order to authorization and challenge. The certificate appears only after validation and finalization, which is the main lesson.',
        'The challenge-proof view separates object state from public evidence. The matrix rows compare pending, valid, invalid, issued, and revoked states with the proof locations used by common challenges. The important question in each frame is not "did the client say it was ready?" but "what public fact did the CA observe, and which protocol state changed because of that observation?"',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The client begins with an ACME account key. Requests are signed, and the client obtains a fresh nonce from the server before making state-changing calls. It creates a new order for identifiers such as `api.example.com` and `www.example.com`. The server returns authorizations for those identifiers and challenge options the client may satisfy.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/5/5b/HTTP_logo.svg', alt:'HTTP protocol logo', caption:'HTTP challenges use well-known paths to prove domain control. Source: Wikimedia Commons, CC BY-SA 4.0'},
        'For http-01, the client places a token-derived key authorization at a well-known HTTP path on the requested host. For dns-01, it publishes a TXT record under `_acme-challenge` containing a digest of the key authorization. For tls-alpn-01, it proves control through a special TLS response on the domain. The validation authority checks from the public network; local success on the client machine is not enough.',
        'After each required authorization becomes valid, the order becomes ready for finalization. The client submits a CSR containing the requested names and the public key that should appear in the certificate. The CA checks that the CSR matches the order, issues the certificate, usually submits it to Certificate Transparency logs, and exposes a certificate URL for retrieval.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The core invariant is that the CA issues only after every required authorization reaches valid state. A challenge cannot validate merely because the client asked nicely. The validation authority must observe the expected public evidence, and the evidence is derived from the ACME account key so a copied token alone is not the whole proof.',
        {type:'callout', text:'The security of ACME rests on one invariant: only the legitimate domain operator can serve the correct challenge response. DNS, HTTP, and TLS-ALPN challenges each verify this through a different network path.'},
        'Replay protection matters because the requests are signed. Without nonces, a valid old request could be copied and submitted again under changed conditions. With nonces, a request is bound to a particular server-issued freshness value. That is why the account key, nonce, order state, authorization state, and final CSR are all part of one issuance ledger.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A service wants a certificate for `api.example.com`. Its ACME client creates an order and receives an authorization for that identifier. The client chooses dns-01 because the service is behind a private load balancer during deployment. It computes the required key authorization, publishes the TXT record under `_acme-challenge.api.example.com`, and tells the ACME server the challenge is ready.',
        'The validation authority queries DNS from outside the service environment. If it sees the expected TXT value, the challenge becomes valid and the authorization becomes valid. The client finalizes with a CSR for `api.example.com`. The CA issues the certificate, logs it, and returns a URL. The deployment system installs the new certificate, reloads the TLS endpoint, and later cleans up the old challenge record.',
        'Now add renewal. The same flow runs before expiry, but the automation has to handle stale TXT records, DNS propagation delay, rate limits, failed validation, deployment rollback, and monitoring. A complete ACME client is therefore not only a protocol caller. It is a small control plane for domain proofs, certificate inventory, and safe rotation.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt:'Server infrastructure', caption:'Certificate automation scales from single servers to global fleets. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0'},
        'ACME removes manual certificate work, but it adds automation state that must be operated well: account key custody, nonce handling, order polling, challenge cleanup, CA rate limits, renewal timing, certificate deployment, and observability around failures. A broken renewal job can be worse than a manual process because it fails quietly until the certificate is near expiry.',
        'Challenge choice is a tradeoff. http-01 is easy when the domain has public HTTP routing and the ACME client can serve the token at the correct path. It does not work for wildcard certificates and can be awkward behind CDNs, redirects, private networks, or split traffic. dns-01 supports wildcards and does not require the target service to be reachable, but it depends on DNS provider credentials, propagation, TTLs, negative caching, and correct delegation.',
        'Security also shifts. Automating DNS updates often means giving a robot credentials that can change records. Automating HTTP challenges can expose path routing mistakes. Reusing account keys can simplify operations but increases blast radius. ACME makes issuance repeatable; it does not remove the need for key management and least privilege.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/84/Lets_Encrypt_logo.svg', alt:'Let\'s Encrypt logo', caption:'Let\'s Encrypt issues over 400 million active certificates using ACME. Source: Wikimedia Commons, Let\'s Encrypt, Public domain'},
        'ACME wins anywhere certificates are numerous, short-lived, or automatically deployed: web servers, CDNs, Kubernetes ingress controllers, service meshes, appliance fleets, internal developer platforms, and ephemeral preview environments. It turns certificate renewal from a calendar reminder into a routine control-plane action.',
        'It is strongest when the environment has clear domain ownership, reliable DNS or HTTP automation, protected account keys, CAA policy that matches the intended CA, Certificate Transparency monitoring, and a deployment path that can roll certificates forward without breaking live TLS connections.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ACME proves control at validation time, not eternal ownership or business legitimacy. If a DNS provider account is compromised, if a stale automation secret can still edit records, if a dangling CNAME points to an attacker-controlled service, or if a web path can be taken over, the protocol may correctly issue a certificate to the wrong actor.',
        'It also fails when public observation differs from local assumptions. Recursive resolvers can cache missing TXT records. Authoritative changes can lag. Split-horizon DNS can make the CA see a different answer than the operator. HTTP redirects or CDN rules can serve the token to one region and not another. The client must debug what the validation authority sees, not only what its own machine sees.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common operational failures are predictable: using a reused nonce, losing the ACME account key, publishing the TXT value to the wrong zone, forgetting that wildcard issuance needs dns-01, failing to clean old challenge records, exhausting CA rate limits during retries, submitting a CSR with names that do not match the order, or installing the certificate on only part of a fleet.',
        'Security failures are just as concrete: overbroad DNS API tokens, unmonitored Certificate Transparency logs, stale CAA records, abandoned subdomains, and renewal automation that runs with more privileges than it needs. The protocol gives a clean state machine, but the surrounding system still has to protect credentials, names, keys, and deployment paths.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 8555 ACME at https://www.rfc-editor.org/rfc/rfc8555, Let\'s Encrypt challenge types at https://letsencrypt.org/docs/challenge-types/, and RFC 6962 Certificate Transparency at https://datatracker.ietf.org/doc/html/rfc6962.',
        'Study DNSSEC Chain of Trust Validation for authenticated DNS answers, DNS Negative Cache & NXDOMAIN for propagation surprises, DNS Serve-Stale Resolver Cache for old answers during outages, TLS 1.3 Handshake for where the certificate is used, OCSP Stapling Revocation Cache for freshness after issuance, Transparency Log Witnessing Case Study for public auditability, and OAuth PKCE Token Lifecycle Case Study for another protocol built around proof and replay resistance.',
      ],
    },
  ],
};
