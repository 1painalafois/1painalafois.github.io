// funciones de UI puras y reusables

export const Components = {
  CategoryCard: (cat) => `
    <article class="card">
      <div class="card-media"></div>
      <div class="card-body">
        <span class="badge">${cat.count} panes</span>
        <h4 class="card-title"><a href="#/categoria/${encodeURIComponent(cat.slug)}">${cat.name}</a></h4>
        <p class="card-meta">${cat.description || "Panadería casera y tradición"}</p>
      </div>
    </article>
  `,

  BreadCard: (bread) => `
    <article class="card">
      <div class="card-media" role="img" aria-label="${bread.name}"></div>
      <div class="card-body">
        <span class="badge">${bread.category}</span>
        <h4 class="card-title"><a href="#/pan/${encodeURIComponent(bread.slug)}">${bread.name}</a></h4>
        <p class="card-meta">${bread.summary ?? "Pan casero"}</p>
      </div>
    </article>
  `,

  Notice: (html) => `<div class="notice">${html}</div>`,

  // Pequeñas secciones
  Section: (title, content) => `
    <section class="section">
      <h3>${title}</h3>
      ${content}
    </section>
  `
};
