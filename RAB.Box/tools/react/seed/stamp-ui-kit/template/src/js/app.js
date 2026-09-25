// app.js — entry: reads app-manifest.json (built by scripts/build-index.mjs;
// presence is registration), injects css seats, loads templates, imports
// page modules, routes. Shared helpers live in stamp.js / store.js / data.js.

import { cell } from './stamp.js';

const loadManifest = async () => {
  const response = await fetch('app-manifest.json', { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error('app-manifest.json missing — run node scripts/build-index.mjs');
  }
  return response.json();
};

const injectCss = (manifest) => {
  const links = [
    ...manifest.components.map((c) => `components/${c.path}/css/${c.name}.css`),
    ...manifest.pages.map((p) => `pages/${p.path}/css/${p.name}.css`),
  ].map(
    (href) =>
      new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        link.onerror = () => {
          // boot continues, but a missing sheet must leave a trace
          console.warn(`css failed to load: ${href}`);
          resolve();
        };
        document.head.append(link);
      }),
  );
  return Promise.all(links);
};

/* minted atoms must ride the page: container/action skins so their
   classes work anywhere, effect css so --effect-* tokens resolve.
   Grid atoms stay opt-in vocabulary (loading one changes page layout).
   atoms/manifest.json is watcher-kept; missing = nothing, no error. */
const injectAtomCss = async () => {
  try {
    const response = await fetch('atoms/manifest.json', { cache: 'no-cache' });
    if (!response.ok) return;
    const { atoms } = await response.json();
    atoms
      .filter((atom) => atom.kind !== 'grid-atom')
      .forEach((atom) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = atom.css;
        document.head.append(link);
      });
  } catch {
    // tolerant by design: an empty house boots clean
  }
};

const loadTemplates = async (manifest) => {
  const urls = [
    ...manifest.components.map((c) => `components/${c.path}/${c.name}.html`),
    ...manifest.components.filter((c) => c.demo).map((c) => `components/${c.path}/demo/demo.html`),
    ...manifest.pages.map((p) => `pages/${p.path}/${p.name}.html`),
  ];
  const files = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`${url} failed to load (${response.status})`);
      }
      return response.text();
    }),
  );
  const host = document.createElement('div');
  host.innerHTML = files.join('\n');
  document.body.append(...host.querySelectorAll('template'));
};

const loadPageModules = async (manifest) => {
  const modules = {};
  await Promise.all(
    manifest.pages.map(async (page) => {
      modules[page.name] = page.js
        ? await import(`../pages/${page.path}/js/${page.name}.js`)
        : {};
    }),
  );
  return modules;
};

/* routing: the URL hash owns page view state — #<page> or #<page>/<section> */

let pages = {};
let currentPage = null;
let setActiveNav = () => {};

let renderSeq = 0;

const renderRoute = async () => {
  // monotonic id: a late async render must never write into a page a
  // newer route already replaced
  const seq = ++renderSeq;
  const [requested, section] = location.hash.replace(/^#/, '').split('/');
  // hasOwn: #toString must never route to Object.prototype
  const page = Object.hasOwn(pages, requested) ? requested : 'home';
  const module = pages[page];

  if (page !== currentPage) {
    const built = module.build
      ? module.build()
      : document.getElementById(`tpl-page-${page}`).content.cloneNode(true);
    cell('main').replaceChildren(built);
    currentPage = page;
  }

  if (module.render) {
    try {
      await module.render(section);
    } catch (error) {
      if (seq !== renderSeq) return; // a newer route owns the page now
      cell('main').textContent = `Could not render ${page} (${error.message}).`;
    }
  }

  if (seq === renderSeq) setActiveNav(page);
};

const init = async () => {
  try {
    const manifest = await loadManifest();
    // the four loads are independent — boot them together
    const [, , , modules] = await Promise.all([
      injectCss(manifest),
      injectAtomCss(),
      loadTemplates(manifest),
      loadPageModules(manifest),
    ]);
    pages = modules;

    const header = await import('../components/app-header/js/app-header.js');
    const footer = await import('../components/app-footer/js/app-footer.js');
    setActiveNav = header.setActiveNav;

    cell('header').append(header.buildHeader());
    cell('footer').append(footer.buildFooter());
    renderRoute();
    window.addEventListener('hashchange', renderRoute);
  } catch (error) {
    // only claim the file:// diagnosis when it IS the file:// problem
    const hint = location.protocol === 'file:'
      ? 'Run launch.cmd and open http://localhost:8080 — templates and modules load via fetch, which browsers block on file:// pages.'
      : 'Check that serve.js is running and the manifest is fresh (node scripts/build-index.mjs).';
    cell('main').textContent = `Could not start (${error.message}). ${hint}`;
  }
};

init();
