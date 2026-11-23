/* ============================================================
   RESPOSTAS RÁPIDAS
   Sistema de gerenciamento de respostas baseado em JSON
   ============================================================ */

"use strict";

/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */

const CONFIG = Object.freeze({
  dataUrl: "./data/respostas.json",
  storageKey: "respostas_rapidas_data_v1",
  maxTextLength: 5000,
  toastDuration: 2800,
  fallbackCategoryIcon: "📁",
  exportFileName: "respostas-rapidas.json"
});

/* ============================================================
   ESTADO DA APLICAÇÃO
   ============================================================ */

const state = {
  data: null,
  selectedCategory: "all",
  search: "",
  sort: "recent",
  editingId: null,
  copyingResponseId: null,
  toastTimer: null,
  storageAvailable: true
};

/* ============================================================
   ELEMENTOS DO DOM
   ============================================================ */

const elements = {
  categories: document.getElementById("categories"),
  cards: document.getElementById("cards"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),
  exportBtn: document.getElementById("exportBtn"),
  newBtn: document.getElementById("newBtn"),

  responseModal: document.getElementById("responseModal"),
  responseForm: document.getElementById("responseForm"),
  modalTitle: document.getElementById("modalTitle"),
  title: document.getElementById("title"),
  category: document.getElementById("category"),
  categoryOptions: document.getElementById("categoryOptions"),
  text: document.getElementById("text"),
  characterCount: document.getElementById("characterCount"),

  variablesModal: document.getElementById("variablesModal"),
  variablesForm: document.getElementById("variablesForm"),
  variablesFields: document.getElementById("variablesFields"),

  toast: document.getElementById("toast")
};

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    validateRequiredElements();
    await loadData();
    setupEvents();
    render();
  } catch (error) {
    console.error("Erro ao inicializar a aplicação:", error);
    showFatalError(error);
  }
}

function validateRequiredElements() {
  const required = [
    "categories",
    "cards",
    "search",
    "sort",
    "pageTitle",
    "pageSubtitle",
    "exportBtn",
    "newBtn",
    "responseModal",
    "responseForm",
    "modalTitle",
    "title",
    "category",
    "categoryOptions",
    "text",
    "characterCount",
    "variablesModal",
    "variablesForm",
    "variablesFields",
    "toast"
  ];

  const missing = required.filter(key => !elements[key]);

  if (missing.length) {
    throw new Error(
      `Elementos não encontrados no HTML: ${missing.join(", ")}`
    );
  }
}

/* ============================================================
   CARREGAMENTO E VALIDAÇÃO DOS DADOS
   ============================================================ */

async function loadData() {
  const savedData = readLocalData();

  if (savedData) {
    state.data = normalizeData(savedData);
    return;
  }

  const response = await fetch(CONFIG.dataUrl, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Não foi possível carregar "${CONFIG.dataUrl}". HTTP ${response.status}.`
    );
  }

  const json = await response.json();

  if (!validateData(json)) {
    throw new Error("O arquivo JSON possui uma estrutura inválida.");
  }

  state.data = normalizeData(json);
  saveData();
}

function readLocalData() {
  try {
    const saved = localStorage.getItem(CONFIG.storageKey);

    if (!saved) return null;

    const parsed = JSON.parse(saved);

    if (!validateData(parsed)) {
      console.warn("Os dados locais possuem uma estrutura inválida.");
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("Não foi possível ler os dados locais:", error);
    state.storageAvailable = false;
    return null;
  }
}

function validateData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  if (!Array.isArray(data.categories) || !Array.isArray(data.responses)) {
    return false;
  }

  const validCategories = data.categories.every(category =>
    category &&
    typeof category === "object" &&
    (typeof category.id === "string" || typeof category.name === "string")
  );

  const validResponses = data.responses.every(response =>
    response &&
    typeof response === "object" &&
    typeof response.title === "string" &&
    typeof response.text === "string"
  );

  return validCategories && validResponses;
}

function normalizeData(data) {
  const categories = [];
  const usedCategoryIds = new Set();

  for (const item of data.categories) {
    if (!item || typeof item !== "object") continue;

    const name = String(item.name || "Sem nome").trim() || "Sem nome";
    const baseId = String(item.id || slugify(name) || createId());
    let id = baseId;
    let suffix = 1;

    while (usedCategoryIds.has(id)) {
      id = `${baseId}-${suffix++}`;
    }

    usedCategoryIds.add(id);

    categories.push({
      id,
      name,
      icon: String(item.icon || CONFIG.fallbackCategoryIcon)
    });
  }

  const responses = [];
  const usedResponseIds = new Set();

  for (const item of data.responses) {
    if (!item || typeof item !== "object") continue;

    const title = String(item.title || "Sem título").trim() || "Sem título";
    const baseId = String(item.id || createId());
    let id = baseId;
    let suffix = 1;

    while (usedResponseIds.has(id)) {
      id = `${baseId}-${suffix++}`;
    }

    usedResponseIds.add(id);

    const createdAt = normalizeDate(item.createdAt);
    const updatedAt = normalizeDate(item.updatedAt || item.createdAt);

    responses.push({
      id,
      title,
      category: String(item.category || ""),
      text: String(item.text || ""),
      favorite: Boolean(item.favorite),
      createdAt,
      updatedAt
    });
  }

  return {
    version: Number(data.version) || 1,
    settings: {
      appName: String(data.settings?.appName || "Respostas Rápidas"),
      description: String(data.settings?.description || "Central de textos")
    },
    categories,
    responses
  };
}

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();

  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

/* ============================================================
   PERSISTÊNCIA
   ============================================================ */

function saveData() {
  if (!state.data) return false;

  try {
    localStorage.setItem(
      CONFIG.storageKey,
      JSON.stringify(state.data)
    );

    state.storageAvailable = true;
    return true;
  } catch (error) {
    state.storageAvailable = false;
    console.error("Não foi possível salvar os dados:", error);

    showToast(
      "Não foi possível salvar. Verifique o armazenamento do navegador."
    );

    return false;
  }
}

/* ============================================================
   EVENTOS GLOBAIS
   ============================================================ */

function setupEvents() {
  elements.search.addEventListener("input", event => {
    state.search = normalizeSearch(event.target.value);
    renderCards();
  });

  elements.sort.addEventListener("change", event => {
    state.sort = event.target.value;
    renderCards();
  });

  elements.newBtn.addEventListener("click", openCreateModal);
  elements.exportBtn.addEventListener("click", exportJSON);

  elements.responseForm.addEventListener("submit", handleResponseSubmit);
  elements.variablesForm.addEventListener("submit", handleVariablesSubmit);

  elements.text.addEventListener("input", updateCharacterCount);

  // Delegação de eventos: os botões continuam funcionando após renderizações.
  elements.categories.addEventListener("click", handleCategoryClick);
  elements.cards.addEventListener("click", handleCardAction);

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      const modal = document.getElementById(button.dataset.close);

      if (modal instanceof HTMLDialogElement && modal.open) {
        modal.close();
      }
    });
  });

  elements.responseModal.addEventListener("click", handleDialogBackdrop);
  elements.variablesModal.addEventListener("click", handleDialogBackdrop);

  elements.responseModal.addEventListener("close", handleResponseModalClose);
  elements.variablesModal.addEventListener("close", handleVariablesModalClose);
}

function handleCategoryClick(event) {
  const button = event.target.closest("[data-category]");

  if (!button || !elements.categories.contains(button)) return;

  state.selectedCategory = button.dataset.category || "all";
  render();
}

function handleCardAction(event) {
  const button = event.target.closest("[data-action]");

  if (!button || !elements.cards.contains(button)) return;

  const { action, id } = button.dataset;

  if (!id) return;

  switch (action) {
    case "copy":
      openCopyModal(id);
      break;
    case "edit":
      openEditModal(id);
      break;
    case "delete":
      deleteResponse(id);
      break;
    case "favorite":
      toggleFavorite(id);
      break;
    default:
      console.warn(`Ação desconhecida: ${action}`);
  }
}

/* ============================================================
   RENDERIZAÇÃO
   ============================================================ */

function render() {
  renderCategories();
  renderHeader();
  renderCards();
  updateCategoryOptions();
}

function renderCategories() {
  const total = state.data.responses.length;

  const allButton = `
    <button
      type="button"
      class="category ${state.selectedCategory === "all" ? "active" : ""}"
      data-category="all"
      aria-pressed="${state.selectedCategory === "all"}"
    >
      <span class="category-name">
        <span aria-hidden="true">📚</span>
        <span>Todas</span>
      </span>
      <span class="count">${total}</span>
    </button>
  `;

  const categoryButtons = state.data.categories.map(category => {
    const count = state.data.responses.filter(
      response => response.category === category.id
    ).length;

    const active = state.selectedCategory === category.id;

    return `
      <button
        type="button"
        class="category ${active ? "active" : ""}"
        data-category="${escapeAttribute(category.id)}"
        aria-pressed="${active}"
      >
        <span class="category-name">
          <span aria-hidden="true">${escapeHtml(category.icon)}</span>
          <span>${escapeHtml(category.name)}</span>
        </span>
        <span class="count">${count}</span>
      </button>
    `;
  }).join("");

  elements.categories.innerHTML = allButton + categoryButtons;
}

function renderHeader() {
  if (state.selectedCategory === "all") {
    elements.pageTitle.textContent =
      state.data.settings.appName || "Todas as respostas";

    elements.pageSubtitle.textContent =
      state.data.settings.description ||
      "Clique em copiar e cole onde precisar.";

    return;
  }

  const category = getCategory(state.selectedCategory);

  elements.pageTitle.textContent = category?.name || "Respostas";
  elements.pageSubtitle.textContent = category
    ? `Respostas da categoria ${category.name}.`
    : "Clique em copiar e cole onde precisar.";
}

function renderCards() {
  const responses = getFilteredResponses();

  if (!responses.length) {
    elements.cards.innerHTML = `
      <div class="empty">
        <div class="empty-icon" aria-hidden="true">🔎</div>
        <h3>Nenhuma resposta encontrada</h3>
        <p>Tente outro termo ou crie uma nova resposta.</p>
      </div>
    `;

    return;
  }

  elements.cards.innerHTML = responses.map(renderCard).join("");
}

function renderCard(response) {
  const category = getCategory(response.category);
  const categoryName = category?.name || "Sem categoria";
  const favoriteLabel = response.favorite
    ? "Remover dos favoritos"
    : "Adicionar aos favoritos";

  return `
    <article class="card" data-id="${escapeAttribute(response.id)}">
      <div class="card-head">
        <div class="card-info">
          <span class="tag">${escapeHtml(categoryName)}</span>
          <h3>${escapeHtml(response.title)}</h3>
        </div>

        <button
          type="button"
          class="favorite ${response.favorite ? "active" : ""}"
          data-action="favorite"
          data-id="${escapeAttribute(response.id)}"
          title="${favoriteLabel}"
          aria-label="${favoriteLabel}"
          aria-pressed="${response.favorite}"
        >${response.favorite ? "★" : "☆"}</button>
      </div>

      <div class="preview">${escapeHtml(response.text)}</div>

      <div class="card-actions">
        <button
          type="button"
          class="copy"
          data-action="copy"
          data-id="${escapeAttribute(response.id)}"
        >📋 Copiar texto</button>

        <button
          type="button"
          class="small-btn"
          data-action="edit"
          data-id="${escapeAttribute(response.id)}"
          title="Editar"
          aria-label="Editar resposta"
        >✏️</button>

        <button
          type="button"
          class="small-btn danger"
          data-action="delete"
          data-id="${escapeAttribute(response.id)}"
          title="Excluir"
          aria-label="Excluir resposta"
        >🗑️</button>
      </div>
    </article>
  `;
}

/* ============================================================
   FILTROS E ORDENAÇÃO
   ============================================================ */

function getFilteredResponses() {
  let responses = [...state.data.responses];

  if (state.selectedCategory !== "all") {
    responses = responses.filter(
      response => response.category === state.selectedCategory
    );
  }

  if (state.search) {
    responses = responses.filter(response => {
      const categoryName = getCategory(response.category)?.name || "";
      const searchable = normalizeSearch(
        `${response.title} ${response.text} ${categoryName}`
      );

      return searchable.includes(state.search);
    });
  }

  responses.sort((a, b) => {
    switch (state.sort) {
      case "name":
        return a.title.localeCompare(b.title, "pt-BR", {
          sensitivity: "base"
        });

      case "favorite":
        return (
          Number(b.favorite) - Number(a.favorite) ||
          getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt)
        );

      case "recent":
      default:
        return getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt);
    }
  });

  return responses;
}

function normalizeSearch(value) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR");
}

function getTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/* ============================================================
   BUSCA DE REGISTROS
   ============================================================ */

function getCategory(id) {
  return state.data.categories.find(category => category.id === id);
}

function getResponse(id) {
  return state.data.responses.find(response => response.id === id);
}

/* ============================================================
   FAVORITOS
   ============================================================ */

function toggleFavorite(id) {
  const response = getResponse(id);

  if (!response) return;

  response.favorite = !response.favorite;
  response.updatedAt = new Date().toISOString();

  saveData();
  renderCategories();
  renderCards();

  showToast(
    response.favorite
      ? "★ Adicionado aos favoritos"
      : "☆ Removido dos favoritos"
  );
}

/* ============================================================
   COPIAR RESPOSTAS E VARIÁVEIS
   ============================================================ */

async function openCopyModal(id) {
  const response = getResponse(id);

  if (!response) return;

  const variables = extractVariables(response.text);

  if (!variables.length) {
    try {
      await copyText(response.text);
      showToast("✓ Texto copiado");
    } catch (error) {
      console.error("Erro ao copiar:", error);
      showToast("Não foi possível copiar o texto.");
    }

    return;
  }

  state.copyingResponseId = id;
  renderVariableFields(variables);

  if (!elements.variablesModal.open) {
    elements.variablesModal.showModal();
  }
}

function extractVariables(text) {
  const matches = String(text).match(/\{([^{}]+)\}/g) || [];

  return [
    ...new Set(
      matches
        .map(match => match.slice(1, -1).trim())
        .filter(Boolean)
    )
  ];
}

function renderVariableFields(variables) {
  elements.variablesFields.innerHTML = variables.map((variable, index) => {
    const label = formatVariableLabel(variable);
    const fieldId = `variable-${index}`;

    return `
      <div class="field variable-field">
        <label for="${fieldId}">${escapeHtml(label)}</label>
        <input
          id="${fieldId}"
          name="variable-${index}"
          type="text"
          autocomplete="off"
          data-variable="${escapeAttribute(variable)}"
          placeholder="Digite ${escapeAttribute(label.toLowerCase())}"
          required
        >
      </div>
    `;
  }).join("");

  elements.variablesFields.querySelector("input")?.focus();
}

function formatVariableLabel(variable) {
  return String(variable)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase("pt-BR"));
}

function replaceVariables(text, values) {
  return String(text).replace(/\{([^{}]+)\}/g, (match, variable) => {
    const key = variable.trim();

    return Object.prototype.hasOwnProperty.call(values, key)
      ? values[key]
      : match;
  });
}

async function handleVariablesSubmit(event) {
  event.preventDefault();

  if (!state.copyingResponseId) return;

  const response = getResponse(state.copyingResponseId);

  if (!response) {
    closeVariablesModal();
    showToast("Esta resposta não está mais disponível.");
    return;
  }

  const values = {};

  elements.variablesFields
    .querySelectorAll("[data-variable]")
    .forEach(input => {
      values[input.dataset.variable] = input.value.trim();
    });

  const hasEmptyValue = Object.values(values).some(value => !value);

  if (hasEmptyValue) {
    showToast("Preencha todos os campos.");
    elements.variablesFields.querySelector(":invalid")?.focus();
    return;
  }

  const finalText = replaceVariables(response.text, values);

  try {
    await copyText(finalText);
    closeVariablesModal();
    showToast("✓ Texto personalizado e copiado");
  } catch (error) {
    console.error("Erro ao copiar:", error);
    showToast("Não foi possível copiar o texto.");
  }
}

function handleVariablesModalClose() {
  elements.variablesForm.reset();
  elements.variablesFields.innerHTML = "";
  state.copyingResponseId = null;
}

function closeVariablesModal() {
  if (elements.variablesModal.open) {
    elements.variablesModal.close();
  } else {
    handleVariablesModalClose();
  }
}

/* ============================================================
   ÁREA DE TRANSFERÊNCIA
   ============================================================ */

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(String(text));
    return;
  }

  const textarea = document.createElement("textarea");

  textarea.value = String(text);
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.select();

  let success = false;

  try {
    success = document.execCommand("copy");
  } finally {
    textarea.remove();
  }

  if (!success) {
    throw new Error("O navegador não permitiu copiar o texto.");
  }
}

/* ============================================================
   CRIAR RESPOSTA
   ============================================================ */

function openCreateModal() {
  state.editingId = null;

  elements.modalTitle.textContent = "Nova resposta";
  elements.responseForm.reset();

  elements.category.value =
    state.selectedCategory !== "all" &&
    getCategory(state.selectedCategory)
      ? getCategory(state.selectedCategory).name
      : "";

  updateCategoryOptions();
  updateCharacterCount();

  elements.responseModal.showModal();
  elements.title.focus();
}

/* ============================================================
   EDITAR RESPOSTA
   ============================================================ */

function openEditModal(id) {
  const response = getResponse(id);

  if (!response) return;

  state.editingId = id;

  elements.modalTitle.textContent = "Editar resposta";
  elements.title.value = response.title;
  elements.category.value =
    getCategory(response.category)?.name || response.category;
  elements.text.value = response.text;

  updateCategoryOptions();
  updateCharacterCount();

  elements.responseModal.showModal();
  elements.title.focus();
}

function handleResponseModalClose() {
  elements.responseForm.reset();
  state.editingId = null;
  updateCharacterCount();
}

function closeResponseModal() {
  if (elements.responseModal.open) {
    elements.responseModal.close();
  } else {
    handleResponseModalClose();
  }
}

/* ============================================================
   SALVAR RESPOSTA
   ============================================================ */

function handleResponseSubmit(event) {
  event.preventDefault();

  const title = elements.title.value.trim();
  const categoryInput = elements.category.value.trim();
  const text = elements.text.value.trim();

  if (!title) {
    showToast("Informe o nome da situação.");
    elements.title.focus();
    return;
  }

  if (!categoryInput) {
    showToast("Informe uma categoria.");
    elements.category.focus();
    return;
  }

  if (!text) {
    showToast("Digite o texto padrão.");
    elements.text.focus();
    return;
  }

  if (text.length > CONFIG.maxTextLength) {
    showToast(
      `O texto pode ter no máximo ${CONFIG.maxTextLength} caracteres.`
    );
    elements.text.focus();
    return;
  }

  const category = findOrCreateCategory(categoryInput);
  const now = new Date().toISOString();

  if (state.editingId) {
    const response = getResponse(state.editingId);

    if (!response) {
      showToast("Não foi possível localizar esta resposta.");
      closeResponseModal();
      return;
    }

    response.title = title;
    response.category = category.id;
    response.text = text;
    response.updatedAt = now;

    saveData();
    closeResponseModal();
    render();
    showToast("✓ Resposta atualizada");
    return;
  }

  state.data.responses.push({
    id: createUniqueId(slugify(title)),
    title,
    category: category.id,
    text,
    favorite: false,
    createdAt: now,
    updatedAt: now
  });

  saveData();
  closeResponseModal();
  render();
  showToast("✓ Resposta criada");
}

/* ============================================================
   CATEGORIAS: LOCALIZAR OU CRIAR
   ============================================================ */

function findOrCreateCategory(categoryInput) {
  const normalizedInput = normalizeSearch(categoryInput);

  let category = state.data.categories.find(item =>
    item.id === categoryInput ||
    normalizeSearch(item.name) === normalizedInput
  );

  if (category) return category;

  const baseId = slugify(categoryInput) || createId();
  let id = baseId;
  let counter = 1;

  while (state.data.categories.some(item => item.id === id)) {
    id = `${baseId}-${counter++}`;
  }

  category = {
    id,
    name: categoryInput,
    icon: CONFIG.fallbackCategoryIcon
  };

  state.data.categories.push(category);

  return category;
}

function updateCategoryOptions() {
  elements.categoryOptions.innerHTML = state.data.categories
    .map(category => `
      <option value="${escapeAttribute(category.name)}"></option>
    `)
    .join("");
}

/* ============================================================
   EXCLUIR RESPOSTA
   ============================================================ */

function deleteResponse(id) {
  const response = getResponse(id);

  if (!response) return;

  const confirmed = window.confirm(
    `Tem certeza que deseja excluir "${response.title}"?`
  );

  if (!confirmed) return;

  state.data.responses = state.data.responses.filter(
    item => item.id !== id
  );

  saveData();
  render();
  showToast("✓ Resposta excluída");
}

/* ============================================================
   CONTADOR DE CARACTERES
   ============================================================ */

function updateCharacterCount() {
  const length = elements.text.value.length;

  elements.characterCount.textContent =
    `${length} / ${CONFIG.maxTextLength} caracteres`;

  elements.text.setAttribute(
    "aria-invalid",
    String(length > CONFIG.maxTextLength)
  );
}

/* ============================================================
   MODAIS
   ============================================================ */

function handleDialogBackdrop(event) {
  if (event.target === event.currentTarget) {
    event.currentTarget.close();
  }
}

/* ============================================================
   EXPORTAÇÃO JSON
   ============================================================ */

function exportJSON() {
  if (!state.data) return;

  try {
    const json = JSON.stringify(state.data, null, 2);
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = CONFIG.exportFileName;
    link.hidden = true;

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Dá tempo ao navegador de iniciar o download antes de liberar a URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast("✓ JSON exportado");
  } catch (error) {
    console.error("Erro ao exportar JSON:", error);
    showToast("Não foi possível exportar os dados.");
  }
}

/* ============================================================
   NOTIFICAÇÕES
   ============================================================ */

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  window.clearTimeout(state.toastTimer);

  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, CONFIG.toastDuration);
}

/* ============================================================
   ERRO DE CARREGAMENTO
   ============================================================ */

function showFatalError(error) {
  const message = error?.message || "Erro desconhecido.";

  if (!elements.cards) {
    console.error(message);
    return;
  }

  elements.cards.innerHTML = `
    <div class="empty">
      <div class="empty-icon" aria-hidden="true">⚠️</div>
      <h3>Não foi possível carregar as respostas</h3>
      <p>${escapeHtml(message)}</p>
      <p>
        Verifique se o arquivo
        <strong>data/respostas.json</strong>
        está no local correto.
      </p>
    </div>
  `;
}

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}

function createUniqueId(base) {
  const cleanBase = base || "resposta";
  let id = cleanBase;
  let counter = 1;

  while (state.data.responses.some(response => response.id === id)) {
    id = `${cleanBase}-${counter++}`;
  }

  return id;
}

/* ============================================================
   SEGURANÇA: ESCAPE DE HTML
   ============================================================ */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
