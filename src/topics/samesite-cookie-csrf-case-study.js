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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a browser decision about whether to attach a cookie to an HTTP request. A cookie is ambient authority, which means the browser may send it automatically without the page adding a password or token to the request body.',
        'SameSite is a cookie attribute that compares the site making the request with the site receiving it. The active edge is the request being classified as same-site or cross-site before the cookie is attached.',
        {type:'callout', text:'SameSite reduces CSRF by making many cross-site requests arrive without the session cookie that would authorize them.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'CSRF means cross-site request forgery. In a CSRF attack, a victim is logged in to bank.example, visits attacker.example, and the attacker causes the browser to send a state-changing request to bank.example.',
        'The attack works because cookies are normally sent automatically to their domain. SameSite exists to let the server tell the browser which cross-site requests should not carry that automatic credential.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to check whether the user has a valid session cookie. If the cookie is present, the server treats the request as authenticated.',
        'That is reasonable for direct navigation from the real site. It fails because the presence of a cookie proves who owns the browser session, not which site caused the request.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ambient authority across origins. HTML forms, image tags, redirects, and some navigations can cause a browser to contact another site while automatically including cookies for that site.',
        'A POST from an attacker page to a bank endpoint may look authenticated at the cookie layer. Without another boundary, the server cannot tell whether the user intended the action.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'SameSite moves part of CSRF defense into the browser cookie-sending rule. Strict sends the cookie only for same-site requests, Lax allows some top-level safe navigations, and None allows cross-site sending when paired with Secure.',
        'The important word is site, not origin. Site is based on the registrable domain and scheme, while origin also includes host and port, so SameSite is coarser than the same-origin policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The server sets a cookie with a SameSite attribute. On each request, the browser evaluates the request context, the target site, the initiating site, method, and navigation type before deciding whether the cookie is eligible.',
        'For a sensitive POST from attacker.example to bank.example, a SameSite=Strict or SameSite=Lax session cookie should not be sent in the common cross-site form-submission case. The server then receives an unauthenticated request instead of an authenticated forged action.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from denying the attacker the credential they were relying on. If the cross-site request arrives without the session cookie, the server authorization check fails before the state change runs.',
        'SameSite is not a full proof of user intent. It reduces one automatic credential path, while CSRF tokens, Origin checks, Fetch Metadata, and re-authentication can cover cases where cookies must be sent cross-site.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost is tiny because the browser already classifies requests before sending them. The real cost is compatibility: login flows, embedded widgets, payment redirects, and identity providers may need SameSite=None; Secure to keep working cross-site.',
        'Cost behaves as breakage risk. Strict gives the strongest default boundary but can break ordinary inbound navigation flows; Lax is more usable but leaves a larger set of requests where cookies may still travel.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SameSite fits session cookies, CSRF-sensitive application cookies, admin consoles, banking flows, internal tools, and any app where a cross-site form should not perform a state change. It is especially useful as a default defense for legacy endpoints that forgot CSRF tokens.',
        'It also helps defense in depth. A server can combine SameSite cookies with synchronizer tokens, double-submit tokens, Origin validation, and Fetch Metadata headers so one bypass does not become account takeover.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SameSite fails when the product intentionally needs cross-site cookies, such as third-party embeds or federated login flows. Those flows often require SameSite=None; Secure and must rely on other CSRF controls.',
        'It also fails against same-site attackers, XSS, subdomain takeover, bad CORS policy, and actions authorized by bearer tokens outside cookies. SameSite is a cookie transport rule, not a complete web security model.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A bank sets session=abc with SameSite=Lax and Secure. The victim visits attacker.example, which auto-submits a hidden POST form to https://bank.example/transfer for $500.',
        'Because the request is cross-site and state-changing, the browser does not attach the Lax session cookie in the normal CSRF form case. The bank receives no valid session for the POST, returns 401, and no transfer occurs; if the cookie were SameSite=None without another CSRF defense, the forged request could reach the application as the victim.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Set-Cookie SameSite reference at https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value, RFC 6265bis drafts at https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html, and OWASP CSRF Prevention Cheat Sheet at https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html. Study Same Origin Policy, CORS, Fetch Metadata, CSRF tokens, and session fixation next.',
      ],
    },
  ],
};
