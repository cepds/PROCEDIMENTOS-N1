const STORAGE_KEY = "mvno.module.v1";

const INITIAL_MVNOS = [
  {
    id: "mvno-play",
    name: "Play Móvel",
    logo: "",
    banner: "",
    description: "Operação MVNO com base para suporte, integrações, rotinas e escalonamentos.",
    website: "",
    contact: "",
    iosApp: "",
    androidApp: "",
    badges: ["Pós-Pago", "TIM", "VIVO"],
    createdAt: "2026-04-30T09:00:00",
    updatedAt: "2026-04-30T09:00:00",
    entries: [
      {
        id: "entry-resumo",
        title: "Resumo operacional",
        type: "Procedimento",
        body: "Centralize aqui validações de linha, integrações, contatos de escalonamento, evidências necessárias e histórico de decisões.",
        attachments: [],
        createdAt: "2026-04-30T09:00:00",
        updatedAt: "2026-04-30T09:00:00",
      },
    ],
  },
];

const app = document.querySelector("#app");

let state = {
  mvnos: [],
  selectedMvnoId: null,
  role: "admin",
  mvnoEditorOpen: false,
  editingMvnoId: null,
  entryEditorOpen: false,
  editingEntryId: null,
  pendingAttachments: [],
  mediaModalEntryId: null,
  mediaViewMode: "single",
};

document.addEventListener("DOMContentLoaded", () => {
  state.mvnos = loadMvnos();
  render();
});

app.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) {
    if (event.target.classList.contains("modal-backdrop")) closeActiveModal();
    return;
  }

  const name = action.dataset.action;

  if (name === "set-role") {
    state.role = action.dataset.role === "viewer" ? "viewer" : "admin";
    render();
  }

  if (name === "new-mvno") {
    if (!canManage()) return;
    state.mvnoEditorOpen = true;
    state.editingMvnoId = null;
    render();
  }

  if (name === "edit-mvno") {
    if (!canManage()) return;
    state.mvnoEditorOpen = true;
    state.editingMvnoId = action.dataset.mvnoId;
    render();
  }

  if (name === "delete-mvno") {
    if (!canManage()) return;
    const mvno = getMvno(action.dataset.mvnoId);
    if (!mvno || !confirm(`Remover a MVNO "${mvno.name}"?`)) return;
    state.mvnos = state.mvnos.filter((item) => item.id !== mvno.id);
    if (state.selectedMvnoId === mvno.id) state.selectedMvnoId = null;
    saveMvnos();
    render();
  }

  if (name === "select-mvno") {
    if (event.target.closest("[data-action='edit-mvno'], [data-action='delete-mvno']")) return;
    state.selectedMvnoId = action.dataset.mvnoId;
    render();
  }

  if (name === "back-mvnos") {
    state.selectedMvnoId = null;
    render();
  }

  if (name === "close-mvno-editor") {
    state.mvnoEditorOpen = false;
    state.editingMvnoId = null;
    render();
  }

  if (name === "new-entry") {
    if (!canManage()) return;
    state.entryEditorOpen = true;
    state.editingEntryId = null;
    state.pendingAttachments = [];
    render();
  }

  if (name === "edit-entry") {
    if (!canManage()) return;
    const entry = getEntry(action.dataset.entryId);
    state.entryEditorOpen = true;
    state.editingEntryId = action.dataset.entryId;
    state.pendingAttachments = clone(getEntryAttachments(entry ?? {}));
    render();
  }

  if (name === "delete-entry") {
    if (!canManage()) return;
    deleteEntry(action.dataset.entryId);
  }

  if (name === "close-entry-editor") {
    state.entryEditorOpen = false;
    state.editingEntryId = null;
    state.pendingAttachments = [];
    render();
  }

  if (name === "toggle-entry-menu") {
    const menu = action.closest(".entry-menu");
    document.querySelectorAll(".entry-menu.is-open").forEach((item) => {
      if (item !== menu) item.classList.remove("is-open");
    });
    menu?.classList.toggle("is-open");
  }

  if (name === "open-media") {
    state.mediaModalEntryId = action.dataset.entryId;
    render();
  }

  if (name === "close-media-modal") {
    state.mediaModalEntryId = null;
    render();
  }

  if (name === "download-media") {
    const entry = getEntry(action.dataset.entryId);
    if (entry) downloadAttachments(getEntryAttachments(entry));
  }

  if (name === "media-prev" || name === "media-next") {
    const track = action.closest(".media-carousel-shell")?.querySelector(".mvno-media-gallery");
    if (track) {
      const direction = name === "media-next" ? 1 : -1;
      track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: "smooth" });
    }
  }

  if (name === "set-media-view") {
    state.mediaViewMode = action.dataset.view === "strip" ? "strip" : "single";
    applyMediaViewMode();
  }

  if (name === "remove-pending") {
    const index = Number(action.dataset.index);
    if (Number.isFinite(index)) {
      state.pendingAttachments.splice(index, 1);
      updateEntryPreview(action.closest("#entry-form"));
    }
  }

  if (name === "rich-command") {
    applyRichCommand(action.dataset.command);
    updateEntryPreview(action.closest("#entry-form"));
  }
});

app.addEventListener("mousedown", (event) => {
  if (event.target.closest("[data-action='rich-command']")) event.preventDefault();
});

app.addEventListener("input", (event) => {
  if (event.target.closest("#mvno-form")) updateMvnoPreview(event.target.closest("#mvno-form"));
  if (event.target.closest("#entry-form") && event.target.type !== "file") updateEntryPreview(event.target.closest("#entry-form"));
});

app.addEventListener("change", (event) => {
  if (event.target.closest("#mvno-form")) updateMvnoPreview(event.target.closest("#mvno-form"));
  if (event.target.closest("#entry-form")) {
    if (event.target.matches("#rich-color")) applyRichCommand("color", event.target.value);
    updateEntryPreview(event.target.closest("#entry-form"));
  }
});

app.addEventListener("submit", async (event) => {
  if (event.target.matches("#mvno-form")) {
    event.preventDefault();
    await saveMvno(event.target);
  }

  if (event.target.matches("#entry-form")) {
    event.preventDefault();
    await saveEntry(event.target);
  }
});

function render() {
  const selected = getSelectedMvno();
  app.innerHTML = `
    <main class="mvno-module">
      ${renderTopbar()}
      ${selected ? renderMvnoDetail(selected) : renderCatalog()}
      ${state.mvnoEditorOpen ? renderMvnoEditorModal() : ""}
      ${state.entryEditorOpen ? renderEntryEditorModal() : ""}
      ${state.mediaModalEntryId ? renderMediaModal() : ""}
    </main>
  `;
}

function renderTopbar() {
  return `
    <header class="module-topbar">
      <div class="brand">
        <span class="brand-mark">${icon("network")}</span>
        <div>
          <h1>MVNO's</h1>
          <p>Módulo isolado para catálogo operacional, wiki interna e anexos.</p>
        </div>
      </div>
      <div class="topbar-actions">
        <div class="role-toggle" aria-label="Perfil">
          <button class="${state.role === "admin" ? "is-active" : ""}" type="button" data-action="set-role" data-role="admin">Admin</button>
          <button class="${state.role === "viewer" ? "is-active" : ""}" type="button" data-action="set-role" data-role="viewer">Viewer</button>
        </div>
        <span class="role-badge">${icon(canManage() ? "shield" : "eye")} ${canManage() ? "Editável" : "Consulta"}</span>
      </div>
    </header>
  `;
}

function renderCatalog() {
  return `
    <section class="workspace-head">
      <div class="workspace-title">
        <h2>Catálogo MVNO</h2>
        <p>Cadastre MVNOs com logo, banner, badges, contatos, links de app e conteúdos internos.</p>
      </div>
      <div class="workspace-actions">
        <button class="primary-button" type="button" data-action="new-mvno" ${canManage() ? "" : "disabled"}>${icon("plus")} Nova MVNO</button>
      </div>
    </section>
    ${
      state.mvnos.length
        ? `<section class="mvno-grid">${state.mvnos.map(renderMvnoCard).join("")}</section>`
        : `<div class="empty-state">${icon("file")}<div><strong>Nenhuma MVNO</strong><p>Adicione a primeira MVNO para iniciar o catálogo.</p></div></div>`
    }
  `;
}

function renderMvnoCard(mvno) {
  return `
    <article class="mvno-card" role="button" tabindex="0" data-action="select-mvno" data-mvno-id="${mvno.id}">
      <div class="mvno-card-main">
        <span class="mvno-logo">${mvno.logo ? `<img src="${escapeAttr(mvno.logo)}" alt="" />` : icon("network")}</span>
        <span>
          <strong>${escapeHTML(mvno.name)}</strong>
          <small>${mvno.entries.length} conteúdos</small>
        </span>
      </div>
      ${renderMvnoBadges(mvno.badges)}
      <p>${escapeHTML(mvno.description)}</p>
      ${
        canManage()
          ? `<div class="mvno-card-actions">
              <button class="icon-button" type="button" data-action="edit-mvno" data-mvno-id="${mvno.id}" title="Editar MVNO">${icon("edit")}</button>
              <button class="icon-button" type="button" data-action="delete-mvno" data-mvno-id="${mvno.id}" title="Remover MVNO">${icon("trash")}</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderMvnoDetail(mvno) {
  return `
    <div class="mvno-detail-page">
      <button class="secondary-button back-button" type="button" data-action="back-mvnos" title="Voltar para MVNO's">${icon("arrow-left")}</button>
      ${mvno.banner ? `<section class="mvno-banner"><img src="${escapeAttr(mvno.banner)}" alt="" /></section>` : ""}
      <section class="mvno-detail-head ${mvno.banner ? "has-banner" : ""}">
        <div class="mvno-detail-title">
          <span class="mvno-logo large">${mvno.logo ? `<img src="${escapeAttr(mvno.logo)}" alt="" />` : icon("network")}</span>
          <div>
            <h2>${escapeHTML(mvno.name)}</h2>
            ${renderMvnoBadges(mvno.badges)}
            <p>${escapeHTML(mvno.description)}</p>
            ${renderMvnoLinks(mvno)}
          </div>
        </div>
        <div class="workspace-actions">
          <button class="primary-button" type="button" data-action="new-entry" ${canManage() ? "" : "disabled"}>${icon("plus")} Conteúdo</button>
          <button class="secondary-button" type="button" data-action="edit-mvno" data-mvno-id="${mvno.id}" ${canManage() ? "" : "disabled"}>${icon("edit")} Editar MVNO</button>
        </div>
      </section>
    </div>
    ${
      mvno.entries.length
        ? `<section class="mvno-entry-list">${mvno.entries.map(renderEntry).join("")}</section>`
        : `<div class="empty-state">${icon("file")}<div><strong>Nenhum conteúdo interno</strong><p>Adicione posts, imagens, vídeos ou arquivos para montar a wiki desta MVNO.</p></div></div>`
    }
  `;
}

function renderEntry(entry) {
  const attachments = getEntryAttachments(entry);
  return `
    <article class="mvno-entry">
      <header>
        <div>
          <span class="tag">${escapeHTML(entry.type)}</span>
          <h3>${escapeHTML(entry.title)}</h3>
          <small>Atualizado ${formatDate(entry.updatedAt)}</small>
        </div>
        <div class="entry-menu">
          <button class="icon-button" type="button" data-action="toggle-entry-menu" title="Opções">${icon("more")}</button>
          <div class="entry-menu-popover">
            ${attachments.length ? `<button type="button" data-action="open-media" data-entry-id="${entry.id}">${icon("image")} Ver mídias</button>` : ""}
            ${attachments.length ? `<button type="button" data-action="download-media" data-entry-id="${entry.id}">${icon("download")} Baixar tudo</button>` : ""}
            ${attachments.map((file, index) => `<a href="${escapeAttr(file.url)}" download="${escapeAttr(file.name || `arquivo-${index + 1}`)}">${icon("download")} Baixar ${escapeHTML(file.name || `arquivo ${index + 1}`)}</a>`).join("")}
            ${
              canManage()
                ? `<button type="button" data-action="edit-entry" data-entry-id="${entry.id}">${icon("edit")} Editar</button>
                   <button type="button" data-action="delete-entry" data-entry-id="${entry.id}">${icon("trash")} Remover</button>`
                : ""
            }
          </div>
        </div>
      </header>
      <div class="post-body rich-body">${formatRichBody(entry.body)}</div>
      ${renderMediaGallery(attachments)}
    </article>
  `;
}

function renderMvnoEditorModal() {
  const editing = state.editingMvnoId ? getMvno(state.editingMvnoId) : null;
  const mvno = editing ?? { name: "", logo: "", banner: "", description: "", website: "", contact: "", iosApp: "", androidApp: "", badges: [] };
  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <section class="modal">
        <header class="modal-header">
          <div>
            <span class="modal-kicker">Catálogo MVNO</span>
            <h2>${editing ? "Editar MVNO" : "Nova MVNO"}</h2>
          </div>
          <button class="icon-button" type="button" data-action="close-mvno-editor">${icon("x")}</button>
        </header>
        <form id="mvno-form" class="modal-body" data-mvno-id="${editing?.id ?? ""}">
          <div class="modal-workspace">
            <div class="form-grid">
              <div class="field wide">
                <label for="mvno-name">Nome da MVNO</label>
                <input id="mvno-name" name="name" value="${escapeAttr(mvno.name)}" required maxlength="80" placeholder="Ex.: Play Móvel" />
              </div>
              <div class="field">
                <label for="mvno-logo-file">Logo</label>
                <input id="mvno-logo-file" name="logoFile" type="file" accept="image/*" />
              </div>
              <div class="field">
                <label for="mvno-logo-url">URL ou caminho da logo</label>
                <input id="mvno-logo-url" name="logo" value="${escapeAttr(mvno.logo)}" placeholder="https://... ou assets/logo.png" />
              </div>
              <div class="field">
                <label for="mvno-banner-file">Banner do topo</label>
                <input id="mvno-banner-file" name="bannerFile" type="file" accept="image/*" />
                <small class="field-hint">Recomendado: 1920x520px ou proporção próxima de 4:1 para HD.</small>
              </div>
              <div class="field">
                <label for="mvno-banner-url">URL ou caminho do banner</label>
                <input id="mvno-banner-url" name="banner" value="${escapeAttr(mvno.banner || "")}" placeholder="https://... ou assets/banner.png" />
              </div>
              <div class="field">
                <label for="mvno-website">Site da MVNO</label>
                <input id="mvno-website" name="website" value="${escapeAttr(mvno.website || "")}" placeholder="https://site.com.br" />
              </div>
              <div class="field">
                <label for="mvno-contact">Contato</label>
                <input id="mvno-contact" name="contact" value="${escapeAttr(mvno.contact || "")}" placeholder="0800 000 0000 ou +55..." />
              </div>
              <div class="field">
                <label for="mvno-ios-app">App iOS</label>
                <input id="mvno-ios-app" name="iosApp" value="${escapeAttr(mvno.iosApp || "")}" placeholder="https://apps.apple.com/..." />
              </div>
              <div class="field">
                <label for="mvno-android-app">App Android</label>
                <input id="mvno-android-app" name="androidApp" value="${escapeAttr(mvno.androidApp || "")}" placeholder="https://play.google.com/..." />
              </div>
              <div class="field wide">
                <label>Badges</label>
                <div class="badge-options">
                  ${["Pós-Pago", "TIM", "VIVO"].map((badge) => `
                    <label class="badge-check">
                      <input type="checkbox" name="badges" value="${badge}" ${mvno.badges?.includes(badge) ? "checked" : ""} />
                      <span>${badge}</span>
                    </label>
                  `).join("")}
                </div>
              </div>
              <div class="field wide">
                <label for="mvno-description">Descrição breve</label>
                <textarea id="mvno-description" name="description" required maxlength="220" placeholder="Resumo curto que aparece no catálogo.">${escapeHTML(mvno.description)}</textarea>
              </div>
            </div>
            <aside class="live-preview">
              <span class="modal-kicker">Prévia</span>
              <article class="preview-card">
                <div class="mvno-preview-banner ${mvno.banner ? "has-image" : ""}" data-preview-banner>
                  ${mvno.banner ? `<img src="${escapeAttr(mvno.banner)}" alt="" />` : `<span>${icon("image")} Banner do topo</span>`}
                </div>
                <div class="mvno-card-main">
                  <span class="mvno-logo" data-preview-logo-wrap>${mvno.logo ? `<img src="${escapeAttr(mvno.logo)}" alt="" />` : icon("network")}</span>
                  <span>
                    <strong data-preview-name>${escapeHTML(mvno.name || "Nome da MVNO")}</strong>
                    <small>0 conteúdos</small>
                  </span>
                </div>
                <div class="mvno-badges" data-preview-badges>${renderBadgeSpans(mvno.badges)}</div>
                <p data-preview-description>${escapeHTML(mvno.description || "A descrição breve será exibida aqui.")}</p>
                <div data-preview-links>${renderMvnoLinks(mvno)}</div>
              </article>
            </aside>
          </div>
          <div class="modal-actions">
            <button class="secondary-button" type="button" data-action="close-mvno-editor">Cancelar</button>
            <button class="primary-button" type="submit">${icon("save")} Salvar MVNO</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderEntryEditorModal() {
  const mvno = getSelectedMvno();
  const editing = state.editingEntryId ? mvno?.entries.find((entry) => entry.id === state.editingEntryId) : null;
  const entry = editing ?? { title: "", type: "Post", body: "", attachments: [] };
  const attachments = state.pendingAttachments.length ? state.pendingAttachments : getEntryAttachments(entry);
  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <section class="modal">
        <header class="modal-header">
          <div>
            <span class="modal-kicker">Wiki da MVNO</span>
            <h2>${editing ? "Editar conteúdo" : "Novo conteúdo"}</h2>
          </div>
          <button class="icon-button" type="button" data-action="close-entry-editor">${icon("x")}</button>
        </header>
        <form id="entry-form" class="modal-body" data-entry-id="${editing?.id ?? ""}">
          <div class="modal-workspace">
            <div class="form-grid">
              <div class="field">
                <label for="entry-title">Título</label>
                <input id="entry-title" name="title" value="${escapeAttr(entry.title)}" required maxlength="110" placeholder="Ex.: Fluxo de ativação" />
              </div>
              <div class="field">
                <label for="entry-type">Tipo</label>
                <select id="entry-type" name="type" required>
                  ${["Post", "Procedimento", "Imagem", "Vídeo", "Arquivo", "Link"].map((type) => `<option value="${type}" ${entry.type === type ? "selected" : ""}>${type}</option>`).join("")}
                </select>
              </div>
              <div class="field wide">
                <label for="entry-body">Informações da wiki</label>
                <input id="entry-body" name="body" type="hidden" value="${escapeAttr(entry.body)}" />
                <div class="rich-editor">
                  <div class="rich-toolbar">
                    <button type="button" data-action="rich-command" data-command="bold" title="Negrito">${icon("bold")}</button>
                    <button type="button" data-action="rich-command" data-command="italic" title="Itálico">${icon("italic")}</button>
                    <button type="button" data-action="rich-command" data-command="underline" title="Sublinhado">${icon("underline")}</button>
                    <button type="button" data-action="rich-command" data-command="code" title="Código inline">${icon("code")}</button>
                    <button type="button" data-action="rich-command" data-command="link" title="Adicionar link">${icon("link")}</button>
                    <label class="rich-color" title="Cor do texto">${icon("palette")}<input id="rich-color" type="color" value="#ffb3ca" /></label>
                  </div>
                  <div id="entry-rich" class="rich-input" contenteditable="true" data-placeholder="Escreva o conteúdo que será exibido na página da MVNO.">${formatRichBody(entry.body)}</div>
                </div>
              </div>
              <div class="field wide">
                <label for="entry-files">Arquivos, imagens ou vídeos</label>
                <label class="file-drop" for="entry-files">${icon("upload")}<strong>Adicionar arquivos</strong><span>Selecione múltiplos itens para montar a galeria</span></label>
                <input id="entry-files" class="sr-only" name="mediaFiles" type="file" multiple />
                <div class="file-queue" data-file-queue>${renderAttachmentQueue(state.pendingAttachments)}</div>
              </div>
              <div class="field wide">
                <label for="entry-media-url">URL de mídia, vídeo ou arquivo</label>
                <input id="entry-media-url" name="mediaUrl" value="" placeholder="https://..." />
              </div>
            </div>
            <aside class="live-preview">
              <span class="modal-kicker">Prévia do conteúdo</span>
              <article class="mvno-entry">
                <header>
                  <div>
                    <span class="tag" data-entry-preview-type>${escapeHTML(entry.type)}</span>
                    <h3 data-entry-preview-title>${escapeHTML(entry.title || "Título do conteúdo")}</h3>
                    <small>Prévia antes de salvar</small>
                  </div>
                </header>
                <div class="post-body rich-body" data-entry-preview-body>${formatRichBody(entry.body || "O texto da wiki aparecerá aqui.")}</div>
                <div data-entry-preview-media>${attachments.length ? renderMediaGallery(attachments) : ""}</div>
              </article>
            </aside>
          </div>
          <div class="modal-actions">
            <button class="secondary-button" type="button" data-action="close-entry-editor">Cancelar</button>
            <button class="primary-button" type="submit">${icon("save")} Salvar conteúdo</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderMediaModal() {
  const entry = getEntry(state.mediaModalEntryId);
  if (!entry) return "";
  const attachments = getEntryAttachments(entry);
  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <section class="modal">
        <header class="modal-header">
          <div>
            <span class="modal-kicker">Mídias e arquivos</span>
            <h2>${escapeHTML(entry.title)}</h2>
          </div>
          <div class="media-modal-actions">
            <button class="secondary-button" type="button" data-action="download-media" data-entry-id="${entry.id}">${icon("download")} Baixar tudo</button>
            <button class="icon-button" type="button" data-action="close-media-modal">${icon("x")}</button>
          </div>
        </header>
        <div class="modal-body">${renderMediaGallery(attachments)}</div>
      </section>
    </div>
  `;
}

function renderMediaGallery(attachments = []) {
  if (!attachments.length) return "";
  const visual = attachments.filter(isVisualAttachment);
  const files = attachments.filter((file) => !isVisualAttachment(file));
  return `
    <div class="mvno-media-stack">
      ${visual.length ? renderVisualCarousel(visual) : ""}
      ${files.length ? renderFileList(files) : ""}
    </div>
  `;
}

function renderVisualCarousel(attachments) {
  const hasMany = attachments.length > 1;
  const mode = state.mediaViewMode === "strip" ? "strip" : "single";
  return `
    <div class="media-carousel-shell media-view-${mode}">
      ${hasMany ? `<div class="media-view-toggle">
        <button class="${mode === "single" ? "is-active" : ""}" type="button" data-action="set-media-view" data-view="single" title="Uma mídia por vez">${icon("panel")}</button>
        <button class="${mode === "strip" ? "is-active" : ""}" type="button" data-action="set-media-view" data-view="strip" title="Carrossel">${icon("grid")}</button>
      </div>` : ""}
      ${hasMany ? `<button class="media-arrow media-arrow-left" type="button" data-action="media-prev">${icon("chevron-left")}</button><button class="media-arrow media-arrow-right" type="button" data-action="media-next">${icon("chevron-right")}</button>` : ""}
      <div class="mvno-media-gallery">
        ${attachments.map((file, index) => `<figure class="mvno-media-slide">${renderAttachmentPreview(file)}<figcaption><span>${escapeHTML(file.name || `Mídia ${index + 1}`)}</span><a href="${escapeAttr(file.url)}" download="${escapeAttr(file.name || `midia-${index + 1}`)}">${icon("download")} Baixar</a></figcaption></figure>`).join("")}
      </div>
    </div>
  `;
}

function renderFileList(files) {
  return `<div class="mvno-file-list">${files.map((file, index) => `<a class="mvno-file-row" href="${escapeAttr(file.url)}" download="${escapeAttr(file.name || `arquivo-${index + 1}`)}">${icon("file")}<span><strong>${escapeHTML(file.name || `Arquivo ${index + 1}`)}</strong><small>${formatFileSize(file.size)} · Arquivo anexado</small></span><em>${icon("download")} Baixar</em></a>`).join("")}</div>`;
}

function renderAttachmentPreview(file) {
  if (isImageAttachment(file)) return `<img class="mvno-media" src="${escapeAttr(file.url)}" alt="" />`;
  if (isVideoAttachment(file)) return `<video class="mvno-media" controls src="${escapeAttr(file.url)}"></video>`;
  return `<div class="mvno-media">${icon("file")}</div>`;
}

function renderAttachmentQueue(attachments) {
  if (!attachments.length) return "";
  return `<div class="file-queue-list">${attachments.map((file, index) => `<div class="file-queue-item">${isVisualAttachment(file) ? icon("image") : icon("file")}<span><strong>${escapeHTML(file.name || `Arquivo ${index + 1}`)}</strong><small>${formatFileSize(file.size)}</small></span><button class="icon-button" type="button" data-action="remove-pending" data-index="${index}">${icon("x")}</button></div>`).join("")}</div>`;
}

async function saveMvno(form) {
  if (!canManage()) return;
  const data = new FormData(form);
  const id = form.dataset.mvnoId || createId("mvno");
  const existing = getMvno(id);
  const logoFile = data.get("logoFile");
  const bannerFile = data.get("bannerFile");
  const uploadedLogo = logoFile && logoFile.size ? await fileToDataUrl(logoFile) : "";
  const uploadedBanner = bannerFile && bannerFile.size ? await fileToDataUrl(bannerFile) : "";
  const now = new Date().toISOString();
  const next = {
    id,
    name: String(data.get("name")).trim(),
    logo: uploadedLogo || String(data.get("logo")).trim() || existing?.logo || "",
    banner: uploadedBanner || String(data.get("banner")).trim() || existing?.banner || "",
    description: String(data.get("description")).trim(),
    website: String(data.get("website") || "").trim(),
    contact: String(data.get("contact") || "").trim(),
    iosApp: String(data.get("iosApp") || "").trim(),
    androidApp: String(data.get("androidApp") || "").trim(),
    badges: data.getAll("badges").map(String),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    entries: existing?.entries ?? [],
  };
  state.mvnos = existing ? state.mvnos.map((mvno) => (mvno.id === id ? next : mvno)) : [next, ...state.mvnos];
  state.selectedMvnoId = id;
  state.mvnoEditorOpen = false;
  state.editingMvnoId = null;
  saveMvnos();
  render();
}

async function saveEntry(form) {
  if (!canManage()) return;
  syncRichEditor(form);
  const mvno = getSelectedMvno();
  if (!mvno) return;
  const data = new FormData(form);
  const id = form.dataset.entryId || createId("entry");
  const existing = mvno.entries.find((entry) => entry.id === id);
  const mediaUrl = String(data.get("mediaUrl") || "").trim();
  const queued = state.pendingAttachments.length ? state.pendingAttachments : getEntryAttachments(existing ?? {});
  const urlAttachment = mediaUrl ? [{ url: normalizeHref(mediaUrl), name: mediaUrl.split("/").pop() || "link", type: guessAttachmentType(mediaUrl) }] : [];
  const now = new Date().toISOString();
  const next = {
    id,
    title: String(data.get("title")).trim(),
    type: String(data.get("type")),
    body: String(data.get("body")).trim(),
    attachments: dedupeAttachments([...queued, ...urlAttachment]),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  state.mvnos = state.mvnos.map((item) => {
    if (item.id !== mvno.id) return item;
    const entries = existing ? item.entries.map((entry) => (entry.id === id ? next : entry)) : [next, ...item.entries];
    return { ...item, entries, updatedAt: now };
  });
  state.entryEditorOpen = false;
  state.editingEntryId = null;
  state.pendingAttachments = [];
  saveMvnos();
  render();
}

function deleteEntry(entryId) {
  const mvno = getSelectedMvno();
  if (!mvno || !confirm("Remover este conteúdo?")) return;
  state.mvnos = state.mvnos.map((item) => (item.id === mvno.id ? { ...item, entries: item.entries.filter((entry) => entry.id !== entryId) } : item));
  saveMvnos();
  render();
}

function updateMvnoPreview(form) {
  if (!form) return;
  const data = new FormData(form);
  const preview = {
    website: String(data.get("website") || "").trim(),
    contact: String(data.get("contact") || "").trim(),
    iosApp: String(data.get("iosApp") || "").trim(),
    androidApp: String(data.get("androidApp") || "").trim(),
  };
  const name = String(data.get("name") || "").trim() || "Nome da MVNO";
  const description = String(data.get("description") || "").trim() || "A descrição breve será exibida aqui.";
  const badges = data.getAll("badges").map(String);
  form.querySelector("[data-preview-name]").textContent = name;
  form.querySelector("[data-preview-description]").textContent = description;
  form.querySelector("[data-preview-badges]").innerHTML = renderBadgeSpans(badges);
  form.querySelector("[data-preview-links]").innerHTML = renderMvnoLinks(preview);
  updateLogoPreview(form);
  updateBannerPreview(form);
}

async function updateEntryPreview(form) {
  if (!form) return;
  const body = syncRichEditor(form) || "O texto da wiki aparecerá aqui.";
  const data = new FormData(form);
  form.querySelector("[data-entry-preview-title]").textContent = String(data.get("title") || "").trim() || "Título do conteúdo";
  form.querySelector("[data-entry-preview-type]").textContent = String(data.get("type") || "Post");
  form.querySelector("[data-entry-preview-body]").innerHTML = formatRichBody(body);
  const input = form.querySelector("#entry-files");
  const files = Array.from(input?.files ?? []).filter((file) => file && file.size);
  if (files.length) {
    const known = new Set(state.pendingAttachments.flatMap((file) => [file.fingerprint, attachmentSimpleFingerprint(file)]));
    const unique = files.filter((file) => {
      const full = fileFingerprint(file);
      const simple = attachmentSimpleFingerprint(file);
      if (known.has(full) || known.has(simple)) return false;
      known.add(full);
      known.add(simple);
      return true;
    });
    const additions = await Promise.all(unique.map(async (file) => ({ url: await fileToDataUrl(file), name: file.name, type: file.type || guessAttachmentType(file.name), size: file.size, fingerprint: fileFingerprint(file) })));
    if (additions.length) state.pendingAttachments = [...state.pendingAttachments, ...additions];
    input.value = "";
  }
  const mediaUrl = String(data.get("mediaUrl") || "").trim();
  const previewAttachments = [...state.pendingAttachments, ...(mediaUrl ? [{ url: normalizeHref(mediaUrl), name: mediaUrl.split("/").pop() || "link", type: guessAttachmentType(mediaUrl) }] : [])];
  form.querySelector("[data-file-queue]").innerHTML = renderAttachmentQueue(state.pendingAttachments);
  form.querySelector("[data-entry-preview-media]").innerHTML = previewAttachments.length ? renderMediaGallery(previewAttachments) : "";
}

function updateLogoPreview(form) {
  const data = new FormData(form);
  const file = data.get("logoFile");
  const url = String(data.get("logo") || "").trim();
  const node = form.querySelector("[data-preview-logo-wrap]");
  if (!node) return;
  const set = (src) => {
    node.innerHTML = src ? `<img src="${escapeAttr(src)}" alt="" />` : icon("network");
  };
  if (file && file.size) {
    const reader = new FileReader();
    reader.onload = () => set(reader.result);
    reader.readAsDataURL(file);
  } else {
    set(url);
  }
}

function updateBannerPreview(form) {
  const data = new FormData(form);
  const file = data.get("bannerFile");
  const url = String(data.get("banner") || "").trim();
  const node = form.querySelector("[data-preview-banner]");
  if (!node) return;
  const set = (src) => {
    node.classList.toggle("has-image", Boolean(src));
    node.innerHTML = src ? `<img src="${escapeAttr(src)}" alt="" />` : `<span>${icon("image")} Banner do topo</span>`;
  };
  if (file && file.size) {
    const reader = new FileReader();
    reader.onload = () => set(reader.result);
    reader.readAsDataURL(file);
  } else {
    set(url);
  }
}

function renderMvnoLinks(mvno) {
  const links = [
    mvno.website ? { label: "Site", href: normalizeHref(mvno.website), iconName: "link" } : null,
    mvno.contact ? { label: mvno.contact, href: contactHref(mvno.contact), iconName: "phone" } : null,
    mvno.iosApp ? { label: "iOS", href: normalizeHref(mvno.iosApp), iconName: "app" } : null,
    mvno.androidApp ? { label: "Android", href: normalizeHref(mvno.androidApp), iconName: "app" } : null,
  ].filter(Boolean);
  if (!links.length) return "";
  return `<div class="mvno-info-links">${links.map((item) => `<a href="${escapeAttr(item.href)}" target="_blank" rel="noopener noreferrer">${icon(item.iconName)}<span>${escapeHTML(item.label)}</span></a>`).join("")}</div>`;
}

function renderMvnoBadges(badges = []) {
  if (!badges.length) return "";
  return `<div class="mvno-badges">${renderBadgeSpans(badges)}</div>`;
}

function renderBadgeSpans(badges = []) {
  return badges.map((badge) => `<span>${escapeHTML(badge)}</span>`).join("");
}

function getSelectedMvno() {
  return getMvno(state.selectedMvnoId);
}

function getMvno(id) {
  return state.mvnos.find((mvno) => mvno.id === id) ?? null;
}

function getEntry(id) {
  for (const mvno of state.mvnos) {
    const entry = mvno.entries.find((item) => item.id === id);
    if (entry) return entry;
  }
  return null;
}

function getEntryAttachments(entry) {
  return Array.isArray(entry?.attachments) ? entry.attachments : [];
}

function loadMvnos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || clone(INITIAL_MVNOS);
  } catch {
    return clone(INITIAL_MVNOS);
  }
}

function saveMvnos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.mvnos));
}

function canManage() {
  return state.role === "admin";
}

function closeActiveModal() {
  state.mvnoEditorOpen = false;
  state.entryEditorOpen = false;
  state.mediaModalEntryId = null;
  state.editingMvnoId = null;
  state.editingEntryId = null;
  state.pendingAttachments = [];
  render();
}

function syncRichEditor(form) {
  const editor = form?.querySelector("#entry-rich");
  const input = form?.querySelector("#entry-body");
  if (!editor || !input) return "";
  const html = sanitizeRichHTML(editor.innerHTML).trim();
  input.value = html;
  return html;
}

function applyRichCommand(command, value = "") {
  const editor = document.querySelector("#entry-rich");
  if (!editor) return;
  editor.focus();
  if (command === "code") {
    wrapSelection("code");
  } else if (command === "link") {
    const url = window.prompt("Cole o link para abrir em nova guia:", "https://");
    if (!url) return;
    document.execCommand("createLink", false, normalizeHref(url));
  } else if (command === "color") {
    wrapSelection("span", { color: value || "#ffb3ca" });
  } else {
    document.execCommand(command, false, null);
  }
  syncRichEditor(editor.closest("#entry-form"));
}

function wrapSelection(tagName, style = {}) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const wrapper = document.createElement(tagName);
  Object.entries(style).forEach(([key, value]) => {
    wrapper.style[key] = value;
  });
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);
  selection.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(wrapper);
  selection.addRange(next);
}

function sanitizeRichHTML(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set(["A", "B", "STRONG", "I", "EM", "U", "CODE", "PRE", "P", "BR", "UL", "OL", "LI", "SPAN", "DIV"]);
  const clean = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE || !allowed.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        return;
      }
      const href = child.tagName === "A" ? child.getAttribute("href") || "" : "";
      const styleText = child.getAttribute("style") || "";
      const color = styleText.match(/color:\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))/i)?.[1] || "";
      [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
      if (child.tagName === "A") {
        const normalized = normalizeHref(href);
        if (/^(https?:|mailto:|tel:)/i.test(normalized)) {
          child.setAttribute("href", normalized);
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        }
      }
      if (color) child.style.color = color;
      clean(child);
    });
  };
  clean(template.content);
  return template.innerHTML;
}

function formatRichBody(body) {
  const value = String(body || "");
  if (!/<[a-z][\s\S]*>/i.test(value)) return formatBody(value);
  return sanitizeRichHTML(value);
}

function formatBody(body) {
  return escapeHTML(body)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.split("\n").join("<br />")}</p>`)
    .join("");
}

function normalizeHref(value = "") {
  const href = String(value).trim();
  if (!href) return "";
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  return `https://${href}`;
}

function contactHref(value = "") {
  const contact = String(value).trim();
  if (/@/.test(contact)) return `mailto:${contact}`;
  const digits = contact.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : normalizeHref(contact);
}

function guessAttachmentType(url = "") {
  if (url.startsWith("data:image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(url)) return "image";
  if (url.startsWith("data:video/") || /\.(mp4|webm|ogg|mov)$/i.test(url)) return "video";
  return "file";
}

function isImageAttachment(file) {
  return file.type?.startsWith("image") || guessAttachmentType(file.url) === "image";
}

function isVideoAttachment(file) {
  return file.type?.startsWith("video") || guessAttachmentType(file.url) === "video";
}

function isVisualAttachment(file) {
  return isImageAttachment(file) || isVideoAttachment(file);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fileFingerprint(file) {
  return [file.name, file.size, file.type, file.lastModified].join(":");
}

function attachmentSimpleFingerprint(file) {
  return [file.name || "", file.size || "", file.type || ""].join(":");
}

function dedupeAttachments(attachments = []) {
  const seen = new Set();
  return attachments.filter((file) => {
    const key = file.fingerprint || attachmentSimpleFingerprint(file) || file.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function downloadAttachments(attachments = []) {
  attachments.forEach((file, index) => {
    window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = file.url;
      link.download = file.name || `arquivo-${index + 1}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 160);
  });
}

function applyMediaViewMode() {
  const mode = state.mediaViewMode === "strip" ? "strip" : "single";
  document.querySelectorAll(".media-carousel-shell").forEach((shell) => {
    shell.classList.toggle("media-view-single", mode === "single");
    shell.classList.toggle("media-view-strip", mode === "strip");
    shell.querySelectorAll("[data-action='set-media-view']").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === mode);
    });
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFileSize(size) {
  if (!size) return "Tamanho original";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function icon(name) {
  const icons = {
    network: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v7M12 15v7M2 12h7M15 12h7M4.9 4.9l5 5M14.1 14.1l5 5M19.1 4.9l-5 5M9.9 14.1l-5 5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-5"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 14 2.5-3 3 4 2-2.5L19 17"/><circle cx="8" cy="9" r="1"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21V9"/><path d="m17 14-5-5-5 5"/><path d="M5 3h14"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    "arrow-left": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
    "chevron-left": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',
    "chevron-right": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
    panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
    bold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 5h7a4 4 0 0 1 0 8H7z"/><path d="M7 13h8a4 4 0 0 1 0 8H7z"/><path d="M7 5v16"/></svg>',
    italic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M10 5h8M6 19h8M14 5l-4 14"/></svg>',
    underline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 5v6a5 5 0 0 0 10 0V5"/><path d="M5 21h14"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18-6-6 6-6"/><path d="m15 6 6 6-6 6"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-1.7c-.8 0-1.3.7-1 1.4l.3.8c.7 1.8-.6 3.8-2.6 3.8z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/><circle cx="16.5" cy="11.5" r="1"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z"/></svg>',
    app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
  };
  return icons[name] ?? icons.file;
}
