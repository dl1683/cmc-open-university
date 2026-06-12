// Page bootstrap: decides between homepage and topic page, wires search,
// navigation, and the theme toggle. All content comes from the registry.

import { topics, categories } from './registry.js';
import { createTopicRuntime } from './core/visualizer.js';

// ----------------------------------------------------------------- theme

function initTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) document.documentElement.dataset.theme = stored;
  const button = document.querySelector('[data-theme-toggle]');
  if (!button) return;
  button.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
}

// ------------------------------------------------------------------ home

function entryHref(entry) {
  return entry.type === 'article' ? entry.url : `./topic.html?topic=${entry.id}`;
}

function entryMatches(entry, query) {
  if (!query) return true;
  const haystack = [
    entry.title, entry.summary, entry.category,
    ...(entry.tags ?? []), entry.searchText ?? '',
  ].join(' ').toLowerCase();
  return query.split(/\s+/).every((word) => haystack.includes(word));
}

function initHome() {
  const listEl = document.querySelector('[data-topic-list]');
  const searchEl = document.querySelector('[data-search]');

  function render(rawQuery = '') {
    const query = rawQuery.trim().toLowerCase();
    listEl.replaceChildren();
    let shown = 0;
    for (const category of categories) {
      const entries = topics.filter((t) => t.category === category && entryMatches(t, query));
      if (entries.length === 0) continue;
      shown += entries.length;
      const section = document.createElement('section');
      section.className = 'category';
      const heading = document.createElement('h2');
      heading.textContent = category;
      section.appendChild(heading);
      const grid = document.createElement('div');
      grid.className = 'card-grid';
      for (const entry of entries) {
        const card = document.createElement('a');
        card.className = 'card';
        card.href = entryHref(entry);
        const title = document.createElement('h3');
        title.textContent = entry.title;
        const summary = document.createElement('p');
        summary.textContent = entry.summary;
        card.append(title, summary);
        grid.appendChild(card);
      }
      section.appendChild(grid);
      listEl.appendChild(section);
    }
    if (shown === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-results';
      empty.textContent = `Nothing matches "${rawQuery.trim()}" yet — more topics are on the way.`;
      listEl.appendChild(empty);
    }
  }

  searchEl.addEventListener('input', () => render(searchEl.value));
  render();
}

// ----------------------------------------------------------------- topic

function renderTopicNav(nav, currentId) {
  for (const category of categories) {
    const entries = topics.filter((t) => t.category === category);
    if (entries.length === 0) continue;
    const heading = document.createElement('h2');
    heading.textContent = category;
    nav.appendChild(heading);
    const list = document.createElement('ul');
    for (const entry of entries) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = entryHref(entry);
      link.textContent = entry.title;
      if (entry.id === currentId) link.setAttribute('aria-current', 'page');
      item.appendChild(link);
      list.appendChild(item);
    }
    nav.appendChild(list);
  }
}

async function initTopic() {
  const root = document.querySelector('[data-page="topic"]');
  const id = new URLSearchParams(location.search).get('topic');
  const entry = topics.find((t) => t.id === id && t.type === 'visualization');
  const titleEl = root.querySelector('[data-topic-title]');

  renderTopicNav(root.querySelector('[data-topic-nav]'), id);

  if (!entry) {
    titleEl.textContent = 'Topic not found';
    root.querySelector('[data-topic-summary]').textContent =
      'That topic does not exist (yet). Pick one from the list.';
    root.querySelector('.learn-grid').hidden = true;
    return;
  }

  document.title = `${entry.title} — Visualized`;
  titleEl.textContent = entry.title;
  root.querySelector('[data-topic-summary]').textContent = entry.summary;
  renderTopicLinks(root.querySelector('[data-topic-links]'), entry);

  const mod = await entry.module();
  createTopicRuntime({ root, topic: mod.topic });
}

// "Built from": the simpler ideas this topic is composed of.
// "Next up": computed in reverse — everything that builds on this topic.
function renderTopicLinks(container, entry) {
  const buildsOn = (entry.buildsOn ?? [])
    .map((id) => topics.find((t) => t.id === id))
    .filter(Boolean);
  const leadsTo = topics.filter((t) => (t.buildsOn ?? []).includes(entry.id));

  const addRow = (label, entries) => {
    if (entries.length === 0) return;
    const row = document.createElement('p');
    row.className = 'chip-row';
    const caption = document.createElement('span');
    caption.className = 'chip-caption';
    caption.textContent = label;
    row.appendChild(caption);
    for (const target of entries) {
      const chip = document.createElement('a');
      chip.className = 'chip';
      chip.href = entryHref(target);
      chip.textContent = target.title;
      row.appendChild(chip);
    }
    container.appendChild(row);
  };

  addRow('Built from:', buildsOn);
  addRow('Next up:', leadsTo);
}

// -------------------------------------------------------------- bootstrap

initTheme();
const page = document.body.dataset.page || document.querySelector('[data-page]')?.dataset.page;
if (page === 'home') initHome();
if (page === 'topic') initTopic();
