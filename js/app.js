import { Components as ui } from './components.js';
import { createRouter } from './router.js';

const $app = document.getElementById('app');
const YEAR = document.getElementById('year');
if (YEAR) YEAR.textContent = new Date().getFullYear();

let DB = null; // cache del JSON

async function loadDB() {
  if (DB) return DB;
  const res = await fetch('./data/breads.json', { cache: 'no-store' });
  DB = await res.json();
  return DB;
}

// Utilidades
const bySlug = (arr, slug) => arr.find(i => i.slug === slug);
const unique = (arr) => [...new Set(arr)];
const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

// Vistas
async function HomeView() {
  const db = await loadDB();
  // compilar categorías con conteo
  const cats = db.categories.map(c => ({
    ...c,
    count: db.breads.filter(b => b.category === c.name).length
  }));
  $app.innerHTML = `
    <section class="hero">
      <div class="card">
        <div class="kicker">Hornear en casa</div>
        <h1 class="display">Recetas y consejos de panadería casera</h1>
        <p class="subtitle">Explora panes por categoría, aprende técnicas y disfruta el proceso uno a la vez.</p>
        <div style="display:flex; gap:.6rem; margin-top:.8rem">
          <a class="btn btn-primary" href="#/categorias">Ver categorías</a>
          <a class="btn btn-outline" href="#/consejos">Consejos</a>
        </div>
      </div>
      <div class="card">
        ${ui.Notice("<strong>Contenido vivo:</strong> Todo se alimenta del archivo <code>data/breads.json</code>. ¡Solo edita y listo!")}
      </div>
    </section>

    ${ui.Section("Categorías destacadas",
      `<div class="grid">
        ${cats.slice(0,6).map(ui.CategoryCard).join('')}
      </div>`
    )}

    ${ui.Section("Últimos panes añadidos",
      `<div class="grid">
        ${db.breads.slice(-8).reverse().map(ui.BreadCard).join('')}
      </div>`
    )}
  `;
}

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
  if (!category) {
    $app.innerHTML = `<p>No encontramos la categoría solicitada.</p>`;
    return;
  }
  const list = db.breads.filter(b => b.category === category.name);

  $app.innerHTML = `
    <h2>${category.name}</h2>
    <p class="subtitle">${category.description ?? ""}</p>
    <div class="grid">
      ${list.map(ui.BreadCard).join('')}
    </div>
  `;
}

async function BreadView({ slug }) {
  const db = await loadDB();
  const bread = bySlug(db.breads, slug);
  if (!bread) {
    $app.innerHTML = `<p>No encontramos este pan.</p>`;
    return;
  }

  // Render detalle
  $app.innerHTML = `
    <article class="card">
      <div class="card-body">
        <a href="#/categoria/${encodeURIComponent(db.categories.find(c => c.name===bread.category)?.slug || '')}" class="badge">${bread.category}</a>
        <h2 style="margin:.4rem 0">${bread.name}</h2>
        <p class="subtitle">${bread.summary ?? ""}</p>
        ${bread.tags?.length ? `<p>${bread.tags.map(t=>`<span class="badge" style="margin-right:.3rem">${t}</span>`).join('')}</p>` : ""}
        ${bread.note ? ui.Notice(bread.note) : ""}
        <h3>Ingredientes</h3>
        <ul>${bread.ingredients.map(i=>`<li>${i}</li>`).join('')}</ul>
        <h3>Pasos</h3>
        <ol>${bread.steps.map(s=>`<li>${s}</li>`).join('')}</ol>

        ${bread.tips?.length ? `
          <h3>Consejos</h3>
          <ul>${bread.tips.map(t=>`<li>${t}</li>`).join('')}</ul>
        ` : ""}

        ${bread.source ? `<p class="tiny">Fuente: ${bread.source}</p>` : ""}
      </div>
    </article>
  `;
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
    <p>Este sitio está construido como un frontend estático que lee un solo archivo <code>JSON</code>. Es ideal para GitHub Pages.</p>
  `;
}

// Búsqueda
async function SearchView(query) {
  const db = await loadDB();
  const q = normalize(query);
  const results = db.breads.filter(b => {
    const haystack = [
      b.name, b.summary, b.category, ...(b.tags||[])
    ].join(' ').toLowerCase();
    return normalize(haystack).includes(q);
  });
  $app.innerHTML = `
    <h2>Resultados para “${query}”</h2>
    ${results.length ? `<div class="grid">${results.map(ui.BreadCard).join('')}</div>` : `<p>No se encontraron panes.</p>`}
  `;
}

// Enrutar
const router = createRouter([
  { path:'/', onEnter: HomeView },
  { path:'/categorias', onEnter: CategoriesView },
  { path:'/categoria/:slug', onEnter: CategoryView },
  { path:'/pan/:slug', onEnter: BreadView },
  { path:'/consejos', onEnter: TipsView },
  { path:'/acerca', onEnter: AboutView }
]);

// Manejo del buscador
const form = document.getElementById('searchForm');
const input = document.getElementById('searchInput');
form?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const q = (input?.value || '').trim();
  if (!q) return;
  SearchView(q);
  input.value = '';
  // opcional: cambiar hash a una ruta especial de búsqueda #/buscar?q=...
});

// mejora de accesibilidad: marcar activo en nav
function updateActiveNav() {
  const hash = location.hash || '#/';
  document.querySelectorAll('[data-nav]').forEach(a => {
    const ok = hash.startsWith(a.getAttribute('href'));
    a.classList.toggle('active', ok);
  });
}
window.addEventListener('hashchange', updateActiveNav);
document.addEventListener('DOMContentLoaded', updateActiveNav);
