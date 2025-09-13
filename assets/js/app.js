import { Components as ui } from './components.js';
import { createRouter } from './router.js';

const $app = document.getElementById('app');
const YEAR = document.getElementById('year');
if (YEAR) YEAR.textContent = new Date().getFullYear();

let DB = null;

async function loadDB() {
  if (DB) return DB;
  const res = await fetch('./data/breads.json', { cache: 'no-store' });
  DB = await res.json();
  return DB;
}

const bySlug = (arr, slug) => arr.find(i => i.slug === slug);
const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

async function HomeView() {
  const db = await loadDB();

  // 1) Construir categorías con conteo
  const cats = db.categories.map(c => ({
    ...c,
    count: db.breads.filter(b => b.category === c.name).length
  }));

  // 2) Seleccionar solo las "featured"
  let featuredCats = cats.filter(c => c.featured);

  // 3) Ordenar por número de panes (descendente)
  featuredCats.sort((a, b) => b.count - a.count);

  // 4) Render de la cabecera/hero
  $app.innerHTML = `
    <section class="hero">
      <div class="card">
        <div class="kicker">Hornear en casa</div>
        <h1 class="display">Recetas y consejos de panadería casera</h1>
        <p class="subtitle">Explora panes por categoría, aprende técnicas y disfruta el proceso uno a la vez.</p>
        <div style="display:flex; gap:.6rem; margin-top:.8rem">
          <a class="btn btn-primary" href="#/categorias">Ver todas las categorías</a>
          <a class="btn btn-outline" href="#/consejos">Consejos</a>
        </div>
      </div>
      <div class="card">
        ${ui.Notice("Las recetas se cargan desde <code>content/recipes/*.md</code> e indexadas por <code>data/breads.json</code>.")}
      </div>
    </section>
  `;

  // 5) Bloque de categorías destacadas (solo featured)
  $app.innerHTML += ui.Section("Categorías destacadas",
    `<div class="grid">
      ${featuredCats.map(ui.CategoryCard).join('')}
    </div>`
  );

  // 6) Últimos panes añadidos (filtrados solo a categorías featured)
  const featuredCategoryNames = new Set(featuredCats.map(c => c.name));
  const latestFeatured = db.breads
    .filter(b => featuredCategoryNames.has(b.category))
    .slice(-8)          // últimos 8
    .reverse();         // recientes primero

  await hydrateCovers(latestFeatured, 8); // mantiene portadas y limita fetch

  $app


async function CategoriesView() {
  const db = await loadDB();
  const cats = db.categories.map(c => ({
    ...c,
    count: db.breads.filter(b => b.category === c.name).length
  }));
  $app.innerHTML = `
    <h2>Categorías</h2>
    <p class="subtitle">Explora panes agrupados por estilo, técnica o tradición.</p>
    <div class="grid">
      ${cats.map(ui.CategoryCard).join('')}
    </div>
  `;
}

async function CategoryView({ slug }) {
  const db = await loadDB();
  const category = bySlug(db.categories, slug);
  if (!category) { $app.innerHTML = `<p>No encontramos la categoría.</p>`; return; }
  const list = db.breads.filter(b => b.category === category.name);
  $app.innerHTML = `
    <h2>${category.name}</h2>
    <p class="subtitle">${category.description ?? ""}</p>
    <div class="grid">${list.map(ui.BreadCard).join('')}</div>
  `;
}

async function BreadView({ slug }) {
  const db = await loadDB();
  const bread = bySlug(db.breads, slug);
  if (!bread) { $app.innerHTML = `<p>No encontramos este pan.</p>`; return; }

  // Marco base
  $app.innerHTML = `
    <article class="card">
      <div class="card-body">
        <a href="#/categoria/${encodeURIComponent(db.categories.find(c => c.name===bread.category)?.slug || '')}" class="badge">${bread.category}</a>
        <h2 style="margin:.4rem 0">${bread.name}</h2>
        ${bread.summary ? `<p class="subtitle">${bread.summary}</p>` : ""}
        ${bread.tags?.length ? `<p>${bread.tags.map(t=>`<span class="badge" style="margin-right:.3rem">${t}</span>`).join('')}</p>` : ""}
        <div class="toc-wrap hidden" id="tocWrap">
          <div class="toc-title">Contenido</div>
          <nav class="toc" id="toc"></nav>
        </div>
        <div id="md" class="markdown-body"><p class="tiny">Cargando receta…</p></div>
        ${bread.source ? `<p class="tiny">Fuente: ${bread.source}</p>` : ""}
      </div>
    </article>
  `;

  // Configurar Marked con recolección de títulos para TOC
  const headings = [];
  const renderer = new marked.Renderer();
  const slugger = new marked.Slugger();

  renderer.heading = (text, level, raw, sluggerProvided) => {
    const slug = (sluggerProvided || slugger).slug(raw);
    if (level <= 3) headings.push({ level, text: raw, slug });
    return `<h${level} id="${slug}">${text}</h${level}>`;
  };

  // Imágenes responsivas (añade class)
  renderer.image = (href, title, text) => {
    const t = title ? ` title="${title}"` : '';
    const alt = text ? ` alt="${text}"` : ' alt=""';
    return `<figure class="md-figure"><img src="${href}"${alt}${t}/>${text ? `<figcaption>${text}</figcaption>`:''}</figure>`;
  };

  // Abrir links externos en nueva pestaña
  renderer.link = (href, title, text) => {
    const isExternal = /^https?:\/\//i.test(href);
    const t = title ? ` title="${title}"` : '';
    const target = isExternal ? ` target="_blank" rel="noopener noreferrer"` : '';
    return `<a href="${href}"${t}${target}>${text}</a>`;
  };

  marked.setOptions({ renderer });

  try {
    const res = await fetch(bread.md, { cache: 'no-store' });
    if (!res.ok) throw new Error(`No se pudo cargar ${bread.md}`);
    let raw = await res.text();

    // --- Embed de videos ---
    // 1) YouTube (líneas con solo el URL)
    raw = raw.replace(/^\s*(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_\-]+)[^\s]*)\s*$/gmi,
      (_, url, id) => `<div class="md-video"><iframe src="https://www.youtube.com/embed/${id}" allowfullscreen loading="lazy"></iframe></div>`);
    raw = raw.replace(/^\s*(https?:\/\/youtu\.be\/([A-Za-z0-9_\-]+)[^\s]*)\s*$/gmi,
      (_, url, id) => `<div class="md-video"><iframe src="https://www.youtube.com/embed/${id}" allowfullscreen loading="lazy"></iframe></div>`);

    // 2) Vimeo
    raw = raw.replace(/^\s*(https?:\/\/(?:www\.)?vimeo\.com\/(\d+)[^\s]*)\s*$/gmi,
      (_, url, id) => `<div class="md-video"><iframe src="https://player.vimeo.com/video/${id}" allowfullscreen loading="lazy"></iframe></div>`);

    // 3) MP4/WEBM directos (línea con solo el URL)
    raw = raw.replace(/^\s*(https?:\/\/[^\s]+?\.(mp4|webm))\s*$/gmi,
      (_, url) => `<video class="md-video-file" controls preload="metadata"><source src="${url}"></video>`);

    // Render Markdown → HTML
    const html = window.marked.parse(raw);
    const target = document.getElementById('md');
    target.innerHTML = html;

    // Construir TOC si hay headings
    if (headings.length) {
      const toc = document.getElementById('toc');
      toc.innerHTML = headings.map(h => `
        <a class="toc-link level-${h.level}" href="#/pan/${encodeURIComponent(bread.slug)}#${h.slug}">${h.text}</a>
      `).join('');
      document.getElementById('tocWrap').classList.remove('hidden');
    }

    // Scroll al anchor si hay hash (h2/h3)
    const anchor = location.hash.split('#')[2]; // patrón "#/pan/slug#anchor"
    if (anchor) {
      const el = document.getElementById(anchor);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

  } catch (err) {
    document.getElementById('md').innerHTML = `<p class="tiny">Error al cargar la receta: ${bread.md}</p>`;
    console.error(err);
  }
}

async function TipsView() {
  const db = await loadDB();
  const rows = db.tips?.length ? db.tips.map(t=>`
    <tr><td>${t.topic}</td><td>${t.tip}</td></tr>
  `).join('') : '';
  $app.innerHTML = `
    <h2>Consejos de panadería casera</h2>
    <table class="table">
      <thead><tr><th>Tema</th><th>Consejo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function AboutView() {
  $app.innerHTML = `
    <h2>Acerca</h2>
    <p>Frontend estático que indexa recetas Markdown a través de un JSON central. Ideal para GitHub Pages.</p>
  `;
}

async function SearchView(query) {
  const db = await loadDB();
  const q = normalize(query);
  const results = db.breads.filter(b => {
    const haystack = [b.name, b.summary, b.category, ...(b.tags||[])].join(' ').toLowerCase();
    return normalize(haystack).includes(q);
  });
  $app.innerHTML = `
    <h2>Resultados para “${query}”</h2>
    ${results.length ? `<div class="grid">${results.map(ui.BreadCard).join('')}</div>` : `<p>No se encontraron panes.</p>`}
  `;
}

// Router
createRouter([
  { path:'/', onEnter: HomeView },
  { path:'/categorias', onEnter: CategoriesView },
  { path:'/categoria/:slug', onEnter: CategoryView },
  { path:'/pan/:slug', onEnter: BreadView },
  { path:'/consejos', onEnter: TipsView },
  { path:'/acerca', onEnter: AboutView }
]);

// Búsqueda
const form = document.getElementById('searchForm');
const input = document.getElementById('searchInput');
form?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const q = (input?.value || '').trim();
  if (!q) return;
  SearchView(q);
  input.value = '';
});

// nav activo
function updateActiveNav() {
  const hash = location.hash || '#/';
  document.querySelectorAll('[data-nav]').forEach(a => {
    const ok = hash.startsWith(a.getAttribute('href'));
    a.classList.toggle('active', ok);
  });
}
window.addEventListener('hashchange', updateActiveNav);
document.addEventListener('DOMContentLoaded', updateActiveNav);
