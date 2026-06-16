// SameSite cookies and CSRF: cookie attachment policy, site computation,
// top-level navigation, unsafe methods, double-submit tokens, and origin checks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'samesite-cookie-csrf-case-study',
  title: 'SameSite Cookies & CSRF',
  category: 'Security',
  summary: 'How SameSite cookie policy, Secure, HttpOnly, top-level navigation rules, unsafe methods, CSRF tokens, Origin checks, and session design fit together.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['cookie attach', 'csrf defense'], defaultValue: 'cookie attach' },
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

function cookieGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'user', label: 'user', x: 0.7, y: 4.1, note: notes.user ?? 'browser' },
      { id: 'siteA', label: 'site A', x: 2.3, y: 2.7, note: notes.siteA ?? 'bank' },
      { id: 'siteB', label: 'site B', x: 2.3, y: 5.5, note: notes.siteB ?? 'evil' },
      { id: 'cookie', label: 'cookie', x: 4.2, y: 4.1, note: notes.cookie ?? 'session' },
      { id: 'policy', label: 'policy', x: 6.0, y: 4.1, note: notes.policy ?? 'SameSite' },
      { id: 'request', label: 'request', x: 7.8, y: 4.1, note: notes.request ?? 'POST?' },
      { id: 'server', label: 'server', x: 9.4, y: 4.1, note: notes.server ?? 'accept?' },
    ],
    edges: [
      { id: 'e-user-siteA', from: 'user', to: 'siteA', weight: '' },
      { id: 'e-user-siteB', from: 'user', to: 'siteB', weight: '' },
      { id: 'e-siteA-cookie', from: 'siteA', to: 'cookie', weight: 'set' },
      { id: 'e-siteB-request', from: 'siteB', to: 'request', weight: 'submit' },
      { id: 'e-cookie-policy', from: 'cookie', to: 'policy', weight: '' },
      { id: 'e-policy-request', from: 'policy', to: 'request', weight: 'attach?' },
      { id: 'e-request-server', from: 'request', to: 'server', weight: '' },
    ],
  }, { title });
}

function* cookieAttach() {
  yield {
    state: cookieGraph('A cookie is ambient authority attached by the browser'),
    highlight: { active: ['siteA', 'cookie', 'e-siteA-cookie'], compare: ['siteB'] },
    explanation: 'A session cookie is ambient authority: once set for a site, the browser may attach it to later matching requests automatically. CSRF abuses that automatic attachment from another site.',
    invariant: 'CSRF is about who can cause the browser to send credentials, not who can read the response.',
  };

  yield {
    state: labelMatrix(
      'SameSite modes',
      [
        { id: 'strict', label: 'Strict' },
        { id: 'lax', label: 'Lax' },
        { id: 'none', label: 'None' },
        { id: 'unset', label: 'default' },
      ],
      [
        { id: 'cross', label: 'cross-site' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['no', 'sensitive'],
        ['top GET', 'sessions'],
        ['yes+Secure', 'embeds'],
        ['Lax-ish', 'legacy risk'],
      ],
    ),
    highlight: { active: ['strict:cross', 'lax:cross', 'none:cross'], compare: ['unset:fit'] },
    explanation: 'SameSite controls when a cookie is sent with cross-site requests. Strict is tightest. Lax permits some top-level safe navigations. None allows cross-site use but requires Secure in modern browsers.',
  };

  yield {
    state: cookieGraph('A cross-site POST is blocked from carrying Lax/Strict cookies', { siteB: 'attacker', cookie: 'SameSite=Lax', request: 'POST /pay', server: 'no cookie' }),
    highlight: { active: ['siteB', 'policy', 'request'], removed: ['cookie', 'server'] },
    explanation: 'A forged form POST from another site can still be sent, but SameSite=Lax or Strict can prevent the browser from attaching the session cookie. Without the cookie, the request lacks the user session.',
  };

  yield {
    state: cookieGraph('SameSite=None is necessary for some embeds and federated flows', { cookie: 'None; Secure', policy: 'cross-site ok', request: 'iframe/API', server: 'needs more checks' }),
    highlight: { active: ['cookie', 'policy', 'request', 'server', 'e-policy-request'], compare: ['siteB'] },
    explanation: 'Some products intentionally need cross-site cookies: embedded apps, SSO, payment frames, or legacy widgets. SameSite=None should be paired with Secure and explicit CSRF defenses.',
  };

  yield {
    state: labelMatrix(
      'Cookie flags',
      [
        { id: 'http', label: 'HttpOnly' },
        { id: 'secure', label: 'Secure' },
        { id: 'host', label: '__Host-' },
        { id: 'path', label: 'Path' },
      ],
      [
        { id: 'guards', label: 'guards' },
        { id: 'misses', label: 'misses' },
      ],
      [
        ['JS read', 'CSRF'],
        ['plain HTTP', 'XSS use'],
        ['domain swap', 'CSRF'],
        ['URL match', 'authz'],
      ],
    ),
    highlight: { found: ['http:guards', 'secure:guards', 'host:guards'], compare: ['http:misses'] },
    explanation: 'Cookie flags are complementary. HttpOnly helps against token theft by JavaScript. Secure requires HTTPS. Prefixes reduce scope mistakes. None of those alone proves user intent for a write.',
  };
}

function* csrfDefense() {
  yield {
    state: cookieGraph('A CSRF attack sends a valid-looking request with ambient cookies', { siteB: 'evil form', cookie: 'session?', request: 'POST /transfer', server: 'danger' }),
    highlight: { active: ['siteB', 'request', 'server'], compare: ['cookie'] },
    explanation: 'The server sees a state-changing request. If it trusts only the session cookie, it may not know that the user never intended this action.',
    invariant: 'State-changing requests need intent checks beyond ambient cookies.',
  };

  yield {
    state: labelMatrix(
      'Defense layers',
      [
        { id: 'samesite', label: 'SameSite' },
        { id: 'token', label: 'CSRF token' },
        { id: 'origin', label: 'Origin' },
        { id: 'method', label: 'method' },
        { id: 'reauth', label: 'step-up' },
      ],
      [
        { id: 'checks', label: 'checks' },
        { id: 'failure' },
      ],
      [
        ['attach rule', 'embed None'],
        ['secret intent', 'XSS can read'],
        ['site source', 'missing hdr'],
        ['unsafe only', 'GET writes'],
        ['high risk', 'friction'],
      ],
    ),
    highlight: { active: ['samesite:checks', 'token:checks', 'origin:checks'], compare: ['reauth:failure'] },
    explanation: 'A robust design layers controls: SameSite where possible, CSRF tokens for unsafe actions, Origin or Referer validation, no state change on GET, and step-up for high-risk operations.',
  };

  yield {
    state: cookieGraph('Double-submit token binds a request body/header to the cookie session', { siteA: 'real form', cookie: 'csrf cookie', request: 'token matches', server: 'accept' }),
    highlight: { active: ['siteA', 'cookie', 'request', 'server', 'e-policy-request', 'e-request-server'], removed: ['siteB'] },
    explanation: 'A synchronizer token or signed double-submit token forces the attacker to know a value they cannot normally read cross-site. The server checks token and session together before accepting the write.',
  };

  yield {
    state: cookieGraph('The complete case study is a money transfer form', { siteA: 'bank form', siteB: 'evil page', cookie: 'Lax+HttpOnly', request: 'POST+token', server: 'verify' }),
    highlight: { found: ['siteA', 'cookie', 'request', 'server'], removed: ['siteB'] },
    explanation: 'For a transfer form, the bank uses SameSite=Lax or Strict for the session, a CSRF token in the form, Origin validation on POST, and step-up authentication for large transfers.',
  };

  yield {
    state: labelMatrix(
      'Do not rely on',
      [
        { id: 'cors', label: 'CORS' },
        { id: 'json', label: 'JSON only' },
        { id: 'secret', label: 'hidden URL' },
        { id: 'captcha', label: 'captcha' },
      ],
      [
        { id: 'why', label: 'why weak' },
        { id: 'better' },
      ],
      [
        ['read gate', 'token'],
        ['forms vary', 'token+origin'],
        ['discoverable', 'authz'],
        ['not intent', 'step-up'],
      ],
    ),
    highlight: { removed: ['cors:why', 'secret:why'], found: ['json:better', 'captcha:better'] },
    explanation: 'CORS is not a CSRF defense because CSRF does not need to read the response. Hidden URLs and content-type assumptions are brittle. Intent needs explicit server-side validation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'cookie attach') yield* cookieAttach();
  else if (view === 'csrf defense') yield* csrfDefense();
  else throw new InputError('Pick a SameSite/CSRF view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'SameSite is a cookie attachment policy. It tells the browser when a cookie should accompany cross-site requests. CSRF is the attack where another site causes the user browser to send a state-changing request with ambient credentials.',
        'MDN documents SameSite as a Set-Cookie attribute controlling whether a cookie is sent with cross-site requests: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite. MDN Set-Cookie documents Secure, HttpOnly, cookie prefixes, Domain, Path, and related attributes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A bank transfer form uses a session cookie with Secure, HttpOnly, and SameSite=Lax or Strict where product flows allow it. The form also includes a per-request CSRF token, and the server checks Origin on unsafe methods. A forged cross-site POST from an attacker page lacks the token and may not carry the cookie at all, so the transfer is rejected.',
        'For cross-site embeds or SSO, SameSite=None may be required. That is when token, Origin, step-up, and narrow session scope become more important, not less.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study CORS Preflight Cache to understand why CORS is a read-permission mechanism, not a CSRF cure. Study Storage Access API Third-Party Cookie Gate for embedded cookie access, OAuth PKCE Token Lifecycle Case Study for redirect state, Content Security Policy for XSS reduction, and WebAuthn Passkey Credential Discovery for phishing-resistant login.',
        'Fetch Metadata Request Gate extends this CSRF story on the server side: SameSite decides whether cookies attach, while Sec-Fetch headers help classify cross-site request shapes before a write route executes.',
      ],
    },
  ],
};
