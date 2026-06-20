// OCSP stapling and revocation freshness: signed status responses, server-side
// cache refresh, TLS certificate-status delivery, and fail-open risk.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ocsp-stapling-revocation-cache-case-study',
  title: 'OCSP Stapling Revocation Cache',
  category: 'Security',
  summary: 'How servers cache signed OCSP responses and staple them into TLS handshakes so clients can check certificate status without live per-client CA queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stapled status', 'freshness risk'], defaultValue: 'stapled status' },
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

function ocspGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'cert', label: 'cert', x: 0.7, y: 4.1, note: notes.cert ?? 'leaf' },
      { id: 'certid', label: 'id', x: 2.0, y: 2.4, note: notes.certid ?? 'issuer+serial' },
      { id: 'ocsp', label: 'OCSP', x: 3.4, y: 2.4, note: notes.ocsp ?? 'responder' },
      { id: 'resp', label: 'resp', x: 4.8, y: 4.1, note: notes.resp ?? 'signed' },
      { id: 'cache', label: 'cache', x: 6.2, y: 5.8, note: notes.cache ?? 'server' },
      { id: 'tls', label: 'TLS', x: 7.5, y: 4.1, note: notes.tls ?? 'staple' },
      { id: 'client', label: 'client', x: 8.8, y: 4.1, note: notes.client ?? 'verify' },
      { id: 'time', label: 'time', x: 6.2, y: 2.2, note: notes.time ?? 'nextUpdate' },
      { id: 'verdict', label: 'ok?', x: 9.3, y: 2.4, note: notes.verdict ?? 'status' },
    ],
    edges: [
      { id: 'e-cert-certid', from: 'cert', to: 'certid' },
      { id: 'e-certid-ocsp', from: 'certid', to: 'ocsp' },
      { id: 'e-ocsp-resp', from: 'ocsp', to: 'resp' },
      { id: 'e-resp-cache', from: 'resp', to: 'cache' },
      { id: 'e-cache-tls', from: 'cache', to: 'tls' },
      { id: 'e-tls-client', from: 'tls', to: 'client' },
      { id: 'e-resp-time', from: 'resp', to: 'time' },
      { id: 'e-time-verdict', from: 'time', to: 'verdict' },
      { id: 'e-client-verdict', from: 'client', to: 'verdict' },
    ],
  }, { title });
}

function* stapledStatus() {
  yield {
    state: ocspGraph('Server derives a CertID for the leaf certificate'),
    highlight: { active: ['cert', 'certid', 'ocsp', 'e-cert-certid', 'e-certid-ocsp'], compare: ['resp'] },
    explanation: 'OCSP status is keyed by certificate identity, not by hostname alone. The server derives the issuer-and-serial CertID and can prefetch the CA responder status before clients arrive.',
    invariant: 'Stapling moves the live revocation lookup from every client to the server certificate cache.',
  };

  yield {
    state: ocspGraph('OCSP responder signs a status response with freshness bounds', { resp: 'good', time: 'this/next' }),
    highlight: { active: ['ocsp', 'resp', 'time', 'e-ocsp-resp', 'e-resp-time'], found: ['certid'] },
    explanation: 'The responder signs a status such as good, revoked, or unknown together with freshness fields. thisUpdate says when the answer was produced, and nextUpdate tells the cache when the answer stops being current.',
  };

  yield {
    state: ocspGraph('TLS server caches and staples the signed response', { cache: 'fresh', tls: 'status' }),
    highlight: { active: ['resp', 'cache', 'tls', 'client', 'e-resp-cache', 'e-cache-tls', 'e-tls-client'], compare: ['ocsp'] },
    explanation: 'Stapling moves the signed status into the TLS handshake. The client can check revocation freshness without a separate live query that adds latency and exposes browsing behavior to the responder.',
  };

  yield {
    state: ocspGraph('Client verifies signature, certificate match, and time window', { client: 'checks', verdict: 'accept', time: 'fresh' }),
    highlight: { found: ['client', 'verdict', 'time', 'e-client-verdict', 'e-time-verdict'], active: ['tls'] },
    explanation: 'The client accepts the staple only when the response matches this certificate, chains to an authorized responder, has a valid signature, and is inside the freshness window.',
  };
}

function* freshnessRisk() {
  yield {
    state: labelMatrix(
      'OCSP statuses',
      [
        { id: 'good', label: 'good' },
        { id: 'rev', label: 'revoked' },
        { id: 'unk', label: 'unknown' },
        { id: 'stale', label: 'stale' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'client', label: 'client' },
      ],
      [
        ['ok', 'allow'],
        ['rev', 'block'],
        ['none', 'policy'],
        ['expired', 'policy'],
      ],
    ),
    highlight: { active: ['good:client', 'rev:client'], compare: ['unk:client', 'stale:client'] },
    explanation: 'OCSP status is not a Boolean cache value. Good, revoked, unknown, missing, and stale can trigger different client behavior depending on browser policy, certificate policy, and must-staple requirements.',
    invariant: 'Freshness windows are as important as the status string.',
  };

  yield {
    state: labelMatrix(
      'Staple cache fields',
      [
        { id: 'id', label: 'id' },
        { id: 'sig', label: 'sig' },
        { id: 'this', label: 'thisUp' },
        { id: 'next', label: 'nextUp' },
        { id: 'src', label: 'source' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['match', 'wrong'],
        ['valid', 'forged'],
        ['not fut', 'skew'],
        ['not old', 'stale'],
        ['CA auth', 'bad sig'],
      ],
    ),
    highlight: { active: ['id:check', 'sig:check', 'next:check', 'src:check'], compare: ['next:risk'] },
    explanation: 'The server cache must index by certificate identity and refresh before nextUpdate. A response for the old certificate or an expired freshness window is not a reusable proof.',
  };

  yield {
    state: ocspGraph('Refresh failure turns revocation into an availability decision', { ocsp: 'timeout', cache: 'old', tls: 'maybe', verdict: 'policy' }),
    highlight: { active: ['ocsp', 'cache', 'tls', 'verdict', 'e-resp-cache', 'e-cache-tls', 'e-time-verdict'], compare: ['client'] },
    explanation: 'If the responder is unavailable, the server can keep serving the last valid staple only until it expires. After that, clients hit a policy boundary: fail closed, fail open, or require freshness only when must-staple applies.',
  };

  yield {
    state: labelMatrix(
      'Operational runbook',
      [
        { id: 'prefetch', label: 'fetch' },
        { id: 'renew', label: 'renew' },
        { id: 'alert', label: 'alert' },
        { id: 'rotate', label: 'rotate' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'why', label: 'why' },
      ],
      [
        ['on start', 'warm'],
        ['pre-next', 'fresh'],
        ['near exp', 'avoid'],
        ['new cert', 'new id'],
      ],
    ),
    highlight: { found: ['prefetch:why', 'renew:why', 'alert:why', 'rotate:why'] },
    explanation: 'The complete server-side data structure is a refresh scheduler: fetch at boot, renew before nextUpdate, alert near expiration, and throw away cached staples when the certificate rotates.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stapled status') yield* stapledStatus();
  else if (view === 'freshness risk') yield* freshnessRisk();
  else throw new InputError('Pick an OCSP stapling view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A TLS certificate can become unsafe before its expiration date. The private key may leak, the certificate may be misissued, or the domain owner may need the CA to stop trusting a still-valid credential.',
        'Expiration alone cannot solve that problem. A browser needs a revocation answer during connection setup, but a live revocation lookup on every connection adds latency, leaks which certificate the user is checking, and makes the CA responder part of page-load availability.',
        'OCSP stapling is the compromise: the server fetches a responder-signed certificate-status object ahead of time, caches it, and sends it inside the TLS handshake. The client still verifies the responder signature and freshness window.',
        {type:'callout', text:'OCSP stapling moves revocation from live client lookup to a server-cached signed proof with a strict freshness window.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct design is client-side OCSP. When a site presents a certificate, each client asks the OCSP responder whether that certificate is good, revoked, or unknown.',
        'That design is attractive because the answer comes from the CA ecosystem, not from the web server being checked. It also keeps the server simple: no revocation cache, no refresh scheduler, and no staple to attach to the handshake.',
      ],
    },
    {
      heading: 'Why the obvious approach breaks',
      paragraphs: [
        'Live client checks make revocation compete with privacy and reliability. The responder can observe certificate checks, the handshake waits on another network path, and responder outages force clients into a bad choice: fail closed and break sites, or fail open and lose the revocation signal.',
        'Caching a status answer is not enough by itself. A cached "good" response is evidence only for the exact certificate identity it names and only inside its validity interval. RFC 6960 says responses outside the thisUpdate and nextUpdate window should be treated as unreliable.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'OCSP stapling turns revocation into a signed, expiring metadata cache. The server does the fetching, but the responder does the signing and the client does the verification.',
        'The cache key is certificate identity, not hostname text. The useful mental model is: CertID points to a signed status object; the status object points to a freshness interval; the TLS handshake carries that object to the client.',
        'Stapling changes the data path, not the trust model. A malicious server can withhold a staple or serve an old one, but it cannot forge a fresh responder-signed "good" response for a revoked certificate.',
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        'The server derives a CertID from the certificate and issuer, asks the OCSP responder for status, and receives a signed response containing status, producedAt, thisUpdate, nextUpdate, responder identity, and signature data.',
        'The server stores that response beside the certificate deployment. During TLS negotiation, the client asks for status support with the status_request extension. In TLS 1.2, the response is delivered through the certificate-status path; in TLS 1.3, OCSP status can be carried as a CertificateEntry extension when requested.',
        'The client verifies four things: the response is signed by an authorized responder, the response names this certificate, the response time window is acceptable, and the status is usable under local policy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a chain of guards. The CertID guard prevents reusing a response for the wrong certificate. The signature guard prevents the server from inventing status. The freshness guard prevents a once-valid answer from being treated as current forever.',
        'The invariant is simple: every stapled response accepted by the client must match this certificate, come from an authorized responder, and be fresh at the time of validation. If any guard fails, the staple is not usable evidence.',
        'The server cache can be untrusted because the cached object is self-authenticating. The server is responsible for availability and freshness, not for deciding revocation status.',
      ],
    },
    {
      heading: 'How to read the visualization',
      paragraphs: [
        'In the stapled-status view, follow the evidence as it moves from certificate identity to responder signature to server cache to TLS handshake to client verdict. The important transition is not the edge movement; it is the change from live per-client query to reusable signed proof.',
        'In the freshness-risk view, read each matrix row as a guard on reuse. "good" and "revoked" are status values; thisUpdate and nextUpdate are time bounds; source and signature tell the client whether the response was authorized.',
        'The stale-cache frames are the operational lesson. Once nextUpdate passes, the cache entry stops being proof. The server must refresh, fail policy, or alert before users discover the stale staple during handshakes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A CDN edge boots with a certificate for example.com. It computes the CertID, fetches an OCSP response, receives "good" with thisUpdate at 10:00 and nextUpdate at 22:00, and stores the signed bytes with the certificate version.',
        'At 13:00, a browser connects and requests status. The edge staples the cached response. The browser checks the chain, checks the OCSP signature, checks the CertID, sees the time is inside the validity interval, and avoids a separate CA responder request.',
        'At 20:00, the refresh job fetches the next response. If certificate automation rotates the leaf certificate at 21:00, the old staple is discarded because the CertID changed. A response for the previous certificate is not a valid cache hit.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Stapling reduces client latency and improves privacy, but it moves work to the server fleet. Servers need cache storage, boot-time warmup, retry logic, time-skew tolerance, certificate-rotation hooks, responder outage handling, and alerting before nextUpdate.',
        'Short response windows make revocation fresher but increase responder load and operational pressure. Long windows reduce load but slow the moment when clients stop accepting a certificate after revocation.',
        'Client policy still matters. Some failures are treated as soft failures unless the certificate or local policy requires a staple. RFC 7633 describes the TLS Feature extension that can advertise status_request support, which is the basis for the "must-staple" idea.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Stapling fits public HTTPS services, CDNs, API gateways, and load-balanced fleets that can centralize certificate operations. One responder fetch can serve many handshakes without exposing each client visit to the responder.',
        'It also fits systems that already treat certificate deployment as a versioned artifact. The staple becomes another expiring piece of signed metadata attached to the certificate version.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Stapling is less useful when certificates are extremely short-lived and clients rely on expiration instead of revocation freshness. It is also weak in environments where clients do not request or enforce stapled status.',
        'It is not a general-purpose authorization mechanism. It answers a narrow question: what did an authorized responder say about this certificate status inside this time window?',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common failures are stale staples, wrong-certificate staples after rotation, missing staples on some load-balanced nodes, clocks outside the response window, responder certificates that are not authorized, and outage policies that nobody tested.',
        'A subtler failure is treating "good" as stronger than it is. A "good" OCSP response means the responder did not report that CertID as revoked for the response interval. It does not prove the certificate will remain safe after the interval.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study TLS 1.3 Handshake for where certificate extensions live, ACME Order Challenge Certificate Issuance for how certificates are obtained, Transparency Log Witnessing Case Study for public certificate visibility, Cache Invalidation & Versioning for freshness mechanics, and TUF Update Metadata Case Study for another system built around signed expiring metadata.',
        'Primary sources: RFC 6960 OCSP at https://www.rfc-editor.org/rfc/rfc6960, RFC 6066 TLS extensions at https://www.rfc-editor.org/rfc/rfc6066, RFC 8446 TLS 1.3 at https://www.rfc-editor.org/rfc/rfc8446, and RFC 7633 TLS Feature Extension at https://www.rfc-editor.org/rfc/rfc7633.',
      ],
    },
  ],
};
