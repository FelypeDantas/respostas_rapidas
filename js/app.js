/* ============================================================
   RESPOSTAS RÁPIDAS
   Sistema baseado em JSON
   ============================================================ */

"use strict";


/* ============================================================
   CONFIGURAÇÃO
   ============================================================ */

const CONFIG = {
  dataUrl: "./data/respostas.json",
  storageKey: "respostas_rapidas_data_v1",
  maxTextLength: 5000
};


/* ============================================================
   ESTADO DA APLICAÇÃO
   ============================================================ */

const state = {
  data: null,

  selectedCategory: "all",

  search: "",

  sort: "recent",

  editingId: null,

  copyingResponse: null,

  toastTimer: null
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

    await loadData();

    setupEvents();

    render();

  } catch (error) {

    console.error(
      "Erro ao carregar respostas:",
      error
    );

    showFatalError(error);

  }

}


/* ============================================================
   CARREGAMENTO DOS DADOS
   ============================================================ */

async function loadData() {

  /*
   * 1. Primeiro tenta carregar os dados salvos
   *    localmente.
   *
   * 2. Caso não exista nada no localStorage,
   *    carrega o JSON original.
   */

  const saved =
    localStorage.getItem(
      CONFIG.storageKey
    );


  if (saved) {

    try {

      const parsed =
        JSON.parse(saved);

      if (validateData(parsed)) {

        state.data =
          normalizeData(parsed);

        return;

      }

    } catch (error) {

      console.warn(
        "Dados locais inválidos. O JSON original será carregado.",
        error
      );

    }

  }


  /*
   * Carrega o arquivo JSON.
   */

  const response =
    await fetch(CONFIG.dataUrl, {
      cache: "no-store"
    });


  if (!response.ok) {

    throw new Error(
      `Não foi possível carregar ${CONFIG.dataUrl}`
    );

  }


  const json =
    await response.json();


  if (!validateData(json)) {

    throw new Error(
      "O arquivo JSON possui uma estrutura inválida."
    );

  }


  state.data =
    normalizeData(json);


  saveData();

}


/* ============================================================
   VALIDAÇÃO DO JSON
   ============================================================ */

function validateData(data) {

  if (!data || typeof data !== "object") {
    return false;
  }


  if (!Array.isArray(data.categories)) {
    return false;
  }


  if (!Array.isArray(data.responses)) {
    return false;
  }


  return true;

}


/* ============================================================
   NORMALIZAÇÃO
   ============================================================ */

function normalizeData(data) {

  return {

    version:
      Number(data.version) || 1,

    settings:
      data.settings || {
        appName: "Respostas Rápidas",
        description: "Central de textos"
      },

    categories:
      data.categories
        .filter(Boolean)
        .map(category => ({
          id:
            String(category.id || slugify(category.name)),

          name:
            String(category.name || "Sem nome"),

          icon:
            String(category.icon || "📁")
        })),

    responses:
      data.responses
        .filter(Boolean)
        .map(response => ({
          id:
            String(
              response.id ||
              createId()
            ),

          title:
            String(response.title || "Sem título"),

          category:
            String(response.category || ""),

          text:
            String(response.text || ""),

          favorite:
            Boolean(response.favorite),

          createdAt:
            response.createdAt ||
            new Date().toISOString(),

          updatedAt:
            response.updatedAt ||
            response.createdAt ||
            new Date().toISOString()
        }))

  };

}


/* ============================================================
   SALVAR DADOS
   ============================================================ */

function saveData() {

  if (!state.data) {
    return;
  }


  localStorage.setItem(
    CONFIG.storageKey,
    JSON.stringify(
      state.data
    )
  );

}


/* ============================================================
   EVENTOS
   ============================================================ */

function setupEvents() {

  /*
   * Pesquisa
   */

  elements.search.addEventListener(
    "input",
    event => {

      state.search =
        event.target.value
          .trim()
          .toLowerCase();

      renderCards();

    }
  );


  /*
   * Ordenação
   */

  elements.sort.addEventListener(
    "change",
    event => {

      state.sort =
        event.target.value;

      renderCards();

    }
  );


  /*
   * Nova resposta
   */

  elements.newBtn.addEventListener(
    "click",
    openCreateModal
  );


  /*
   * Exportar
   */

  elements.exportBtn.addEventListener(
    "click",
    exportJSON
  );


  /*
   * Formulário de resposta
   */

  elements.responseForm.addEventListener(
    "submit",
    handleResponseSubmit
  );


  /*
   * Formulário de variáveis
   */

  elements.variablesForm.addEventListener(
    "submit",
    handleVariablesSubmit
  );


  /*
   * Contador de caracteres
   */

  elements.text.addEventListener(
    "input",
    updateCharacterCount
  );


  /*
   * Botões de fechar modal
   */

  document
    .querySelectorAll("[data-close]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const modalId =
            button.dataset.close;

          const modal =
            document.getElementById(
              modalId
            );

          if (modal) {
            modal.close();
          }

        }
      );

    });


  /*
   * Clique no backdrop dos modais
   */

  elements.responseModal.addEventListener(
    "click",
    handleDialogBackdrop
  );


  elements.variablesModal.addEventListener(
    "click",
    handleDialogBackdrop
  );

}


/* ============================================================
   RENDER GERAL
   ============================================================ */

function render() {

  renderCategories();

  renderHeader();

  renderCards();

  updateCategoryOptions();

}


/* ============================================================
   CATEGORIAS
   ============================================================ */

function renderCategories() {

  const categories =
    state.data.categories;


  const total =
    state.data.responses.length;


  let html = `
    <button
      type="button"
      class="category ${
        state.selectedCategory === "all"
          ? "active"
          : ""
      }"
      data-category="all"
    >

      <span class="category-name">
        <span aria-hidden="true">📚</span>
        <span>Todas</span>
      </span>

      <span class="count">
        ${total}
      </span>

    </button>
  `;


  categories.forEach(category => {

    const count =
      state.data.responses.filter(
        response =>
          response.category ===
          category.id
      ).length;


    html += `
      <button
        type="button"
        class="category ${
          state.selectedCategory === category.id
            ? "active"
            : ""
        }"
        data-category="${escapeAttribute(category.id)}"
      >

        <span class="category-name">

          <span aria-hidden="true">
            ${escapeHtml(category.icon)}
          </span>

          <span>
            ${escapeHtml(category.name)}
          </span>

        </span>

        <span class="count">
          ${count}
        </span>

      </button>
    `;

  });


  elements.categories.innerHTML =
    html;


  elements.categories
    .querySelectorAll("[data-category]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          state.selectedCategory =
            button.dataset.category;

          render();

        }
      );

    });

}


/* ============================================================
   CABEÇALHO
   ============================================================ */

function renderHeader() {

  if (
    state.selectedCategory === "all"
  ) {

    elements.pageTitle.textContent =
      state.data.settings?.appName ||
      "Todas as respostas";

    elements.pageSubtitle.textContent =
      state.data.settings?.description ||
      "Clique em copiar e cole onde precisar.";

    return;

  }


  const category =
    getCategory(
      state.selectedCategory
    );


  elements.pageTitle.textContent =
    category?.name ||
    "Respostas";


  elements.pageSubtitle.textContent =
    category
      ? `Respostas da categoria ${category.name}.`
      : "Clique em copiar e cole onde precisar.";

}


/* ============================================================
   CARDS
   ============================================================ */

function renderCards() {

  const responses =
    getFilteredResponses();


  if (!responses.length) {

    elements.cards.innerHTML = `
      <div class="empty">

        <div class="empty-icon">
          🔎
        </div>

        <h3>
          Nenhuma resposta encontrada
        </h3>

        <p>
          Tente outro termo ou crie uma nova resposta.
        </p>

      </div>
    `;

    return;

  }


  elements.cards.innerHTML =
    responses
      .map(renderCard)
      .join("");


  bindCardEvents();

}


/* ============================================================
   CARD
   ============================================================ */

function renderCard(response) {

  const category =
    getCategory(
      response.category
    );


  const categoryName =
    category?.name ||
    "Sem categoria";


  return `
    <article
      class="card"
      data-id="${escapeAttribute(response.id)}"
    >

      <div class="card-head">

        <div class="card-info">

          <span class="tag">
            ${escapeHtml(categoryName)}
          </span>

          <h3>
            ${escapeHtml(response.title)}
          </h3>

        </div>


        <button
          type="button"
          class="favorite ${
            response.favorite
              ? "active"
              : ""
          }"
          data-action="favorite"
          data-id="${escapeAttribute(response.id)}"
          title="${
            response.favorite
              ? "Remover dos favoritos"
              : "Adicionar aos favoritos"
          }"
          aria-label="${
            response.favorite
              ? "Remover dos favoritos"
              : "Adicionar aos favoritos"
          }"
        >
          ${
            response.favorite
              ? "★"
              : "☆"
          }
        </button>

      </div>


      <div class="preview">
        ${escapeHtml(response.text)}
      </div>


      <div class="card-actions">

        <button
          type="button"
          class="copy"
          data-action="copy"
          data-id="${escapeAttribute(response.id)}"
        >
          📋 Copiar texto
        </button>


        <button
          type="button"
          class="small-btn"
          data-action="edit"
          data-id="${escapeAttribute(response.id)}"
          title="Editar"
          aria-label="Editar resposta"
        >
          ✏️
        </button>


        <button
          type="button"
          class="small-btn danger"
          data-action="delete"
          data-id="${escapeAttribute(response.id)}"
          title="Excluir"
          aria-label="Excluir resposta"
        >
          🗑️
        </button>

      </div>

    </article>
  `;

}


/* ============================================================
   EVENTOS DOS CARDS
   ============================================================ */

function bindCardEvents() {

  elements.cards
    .querySelectorAll("[data-action]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const action =
            button.dataset.action;

          const id =
            button.dataset.id;


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

          }

        }
      );

    });

}


/* ============================================================
   FILTROS
   ============================================================ */

function getFilteredResponses() {

  let responses =
    [...state.data.responses];


  /*
   * Categoria
   */

  if (
    state.selectedCategory !== "all"
  ) {

    responses =
      responses.filter(
        response =>
          response.category ===
          state.selectedCategory
      );

  }


  /*
   * Pesquisa
   */

  if (state.search) {

    responses =
      responses.filter(
        response => {

          const category =
            getCategory(
              response.category
            );


          const searchable = [

            response.title,

            response.text,

            category?.name || ""

          ]
            .join(" ")
            .toLowerCase();


          return searchable.includes(
            state.search
          );

        }
      );

  }


  /*
   * Ordenação
   */

  switch (state.sort) {

    case "name":

      responses.sort(
        (a, b) =>
          a.title.localeCompare(
            b.title,
            "pt-BR"
          )
      );

      break;


    case "favorite":

      responses.sort(
        (a, b) => {

          const favoriteDifference =
            Number(b.favorite) -
            Number(a.favorite);


          if (favoriteDifference !== 0) {
            return favoriteDifference;
          }


          return (
            new Date(b.updatedAt) -
            new Date(a.updatedAt)
          );

        }
      );

      break;


    case "recent":

    default:

      responses.sort(
        (a, b) =>
          new Date(b.updatedAt) -
          new Date(a.updatedAt)
      );

      break;

  }


  return responses;

}


/* ============================================================
   BUSCAR CATEGORIA
   ============================================================ */

function getCategory(id) {

  return state.data.categories.find(
    category =>
      category.id === id
  );

}


/* ============================================================
   BUSCAR RESPOSTA
   ============================================================ */

function getResponse(id) {

  return state.data.responses.find(
    response =>
      response.id === id
  );

}


/* ============================================================
   FAVORITO
   ============================================================ */

function toggleFavorite(id) {

  const response =
    getResponse(id);


  if (!response) {
    return;
  }


  response.favorite =
    !response.favorite;


  response.updatedAt =
    new Date().toISOString();


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
   COPIAR RESPOSTA
   ============================================================ */

function openCopyModal(id) {

  const response =
    getResponse(id);


  if (!response) {
    return;
  }


  const variables =
    extractVariables(
      response.text
    );


  /*
   * Se não houver variáveis,
   * copia imediatamente.
   */

  if (!variables.length) {

    copyText(
      response.text
    ).then(() => {

      showToast(
        "✓ Texto copiado"
      );

    }).catch(() => {

      showToast(
        "Não foi possível copiar o texto."
      );

    });

    return;

  }


  /*
   * Guarda a resposta atual.
   */

  state.copyingResponse = {
    responseId: id,
    variables
  };


  renderVariableFields(
    response,
    variables
  );


  elements.variablesModal.showModal();

}


/* ============================================================
   EXTRAIR VARIÁVEIS DO TEXTO
   ============================================================ */

function extractVariables(text) {

  const matches =
    text.match(
      /\{([^{}]+)\}/g
    ) || [];


  return [
    ...new Set(
      matches
        .map(variable =>
          variable
            .slice(1, -1)
            .trim()
        )
        .filter(Boolean)
    )
  ];

}


/* ============================================================
   MODAL DE VARIÁVEIS
   ============================================================ */

function renderVariableFields(
  response,
  variables
) {

  elements.variablesFields.innerHTML =
    variables
      .map(variable => {

        const fieldId =
          `variable-${slugify(variable)}`;


        return `
          <div class="field variable-field">

            <label for="${escapeAttribute(fieldId)}">
              ${escapeHtml(
                formatVariableLabel(variable)
              )}
            </label>

            <input
              id="${escapeAttribute(fieldId)}"
              name="${escapeAttribute(variable)}"
              type="text"
              autocomplete="off"
              data-variable="${escapeAttribute(variable)}"
              placeholder="Digite ${escapeAttribute(
                formatVariableLabel(variable)
              ).toLowerCase()}"
              required
            >

          </div>
        `;

      })
      .join("");


  /*
   * Se existir apenas uma variável,
   * coloca foco nela automaticamente.
   */

  const firstInput =
    elements.variablesFields.querySelector(
      "input"
    );


  if (firstInput) {

    setTimeout(
      () => firstInput.focus(),
      50
    );

  }

}


/* ============================================================
   NOME BONITO DA VARIÁVEL
   ============================================================ */

function formatVariableLabel(variable) {

  return variable

    .replaceAll(
      "_",
      " "
    )

    .replaceAll(
      "-",
      " "
    )

    .replace(
      /\b\w/g,
      letter =>
        letter.toUpperCase()
    );

}


/* ============================================================
   SUBSTITUIR VARIÁVEIS
   ============================================================ */

function replaceVariables(
  text,
  values
) {

  return text.replace(
    /\{([^{}]+)\}/g,
    (match, variable) => {

      const key =
        variable.trim();


      return Object.prototype.hasOwnProperty.call(
        values,
        key
      )
        ? values[key]
        : match;

    }
  );

}


/* ============================================================
   SUBMIT DO MODAL DE VARIÁVEIS
   ============================================================ */

async function handleVariablesSubmit(event) {

  event.preventDefault();


  if (!state.copyingResponse) {
    return;
  }


  const response =
    getResponse(
      state.copyingResponse.responseId
    );


  if (!response) {

    closeVariablesModal();

    return;

  }


  const values = {};


  elements.variablesFields
    .querySelectorAll("[data-variable]")
    .forEach(input => {

      values[
        input.dataset.variable
      ] =
        input.value.trim();

    });


  /*
   * Validação
   */

  const empty =
    Object.values(values)
      .some(value => !value);


  if (empty) {

    showToast(
      "Preencha todos os campos."
    );

    return;

  }


  const finalText =
    replaceVariables(
      response.text,
      values
    );


  try {

    await copyText(
      finalText
    );


    closeVariablesModal();


    showToast(
      "✓ Texto personalizado e copiado"
    );

  } catch (error) {

    console.error(
      "Erro ao copiar:",
      error
    );


    showToast(
      "Não foi possível copiar o texto."
    );

  }

}


/* ============================================================
   FECHAR MODAL DE VARIÁVEIS
   ============================================================ */

function closeVariablesModal() {

  elements.variablesModal.close();

  elements.variablesForm.reset();

  elements.variablesFields.innerHTML =
    "";

  state.copyingResponse =
    null;

}


/* ============================================================
   CLIPBOARD
   ============================================================ */

async function copyText(text) {

  /*
   * Clipboard API
   */

  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {

    await navigator.clipboard.writeText(
      text
    );

    return;

  }


  /*
   * Fallback para file://
   * e navegadores mais antigos.
   */

  const textarea =
    document.createElement(
      "textarea"
    );


  textarea.value =
    text;


  textarea.setAttribute(
    "readonly",
    ""
  );


  textarea.style.position =
    "fixed";

  textarea.style.left =
    "-9999px";


  document.body.appendChild(
    textarea
  );


  textarea.focus();

  textarea.select();


  const success =
    document.execCommand(
      "copy"
    );


  textarea.remove();


  if (!success) {

    throw new Error(
      "Falha ao copiar texto."
    );

  }

}


/* ============================================================
   NOVA RESPOSTA
   ============================================================ */

function openCreateModal() {

  state.editingId =
    null;


  elements.modalTitle.textContent =
    "Nova resposta";


  elements.title.value =
    "";


  /*
   * Se estiver dentro de uma categoria,
   * já seleciona essa categoria.
   */

  if (
    state.selectedCategory !== "all"
  ) {

    elements.category.value =
      state.selectedCategory;

  } else {

    elements.category.value =
      "";

  }


  elements.text.value =
    "";


  updateCategoryOptions();

  updateCharacterCount();


  elements.responseModal.showModal();


  setTimeout(
    () =>
      elements.title.focus(),
    50
  );

}


/* ============================================================
   EDITAR RESPOSTA
   ============================================================ */

function openEditModal(id) {

  const response =
    getResponse(id);


  if (!response) {
    return;
  }


  state.editingId =
    id;


  elements.modalTitle.textContent =
    "Editar resposta";


  elements.title.value =
    response.title;


  /*
   * Mostra o nome da categoria,
   * não apenas o ID.
   */

  const category =
    getCategory(
      response.category
    );


  elements.category.value =
    category
      ? category.name
      : response.category;


  elements.text.value =
    response.text;


  updateCategoryOptions();

  updateCharacterCount();


  elements.responseModal.showModal();


  setTimeout(
    () =>
      elements.title.focus(),
    50
  );

}


/* ============================================================
   FORMULÁRIO DE RESPOSTA
   ============================================================ */

function handleResponseSubmit(event) {

  event.preventDefault();


  const title =
    elements.title.value.trim();


  const categoryInput =
    elements.category.value.trim();


  const text =
    elements.text.value.trim();


  /*
   * Validação básica
   */

  if (!title) {

    showToast(
      "Informe o nome da situação."
    );

    elements.title.focus();

    return;

  }


  if (!categoryInput) {

    showToast(
      "Informe uma categoria."
    );

    elements.category.focus();

    return;

  }


  if (!text) {

    showToast(
      "Digite o texto padrão."
    );

    elements.text.focus();

    return;

  }


  if (
    text.length >
    CONFIG.maxTextLength
  ) {

    showToast(
      `O texto pode ter no máximo ${CONFIG.maxTextLength} caracteres.`
    );

    return;

  }


  /*
   * Descobre ou cria categoria.
   */

  const category =
    findOrCreateCategory(
      categoryInput
    );


  const now =
    new Date().toISOString();


  /*
   * EDIÇÃO
   */

  if (state.editingId) {

    const response =
      getResponse(
        state.editingId
      );


    if (!response) {
      return;
    }


    response.title =
      title;

    response.category =
      category.id;

    response.text =
      text;

    response.updatedAt =
      now;


    saveData();

    closeResponseModal();

    render();


    showToast(
      "✓ Resposta atualizada"
    );


    return;

  }


  /*
   * NOVA RESPOSTA
   */

  state.data.responses.push({

    id:
      createUniqueId(
        slugify(title)
      ),

    title,

    category:
      category.id,

    text,

    favorite:
      false,

    createdAt:
      now,

    updatedAt:
      now

  });


  saveData();

  closeResponseModal();

  render();


  showToast(
    "✓ Resposta criada"
  );

}


/* ============================================================
   ENCONTRAR / CRIAR CATEGORIA
   ============================================================ */

function findOrCreateCategory(
  categoryInput
) {

  /*
   * Primeiro tenta pelo ID.
   */

  let category =
    state.data.categories.find(
      item =>
        item.id ===
        categoryInput
    );


  if (category) {
    return category;
  }


  /*
   * Depois tenta pelo nome.
   */

  category =
    state.data.categories.find(
      item =>
        item.name.toLowerCase() ===
        categoryInput.toLowerCase()
    );


  if (category) {
    return category;
  }


  /*
   * Cria nova categoria.
   */

  const baseId =
    slugify(categoryInput);


  let id =
    baseId || createId();


  let counter =
    1;


  while (
    state.data.categories.some(
      item =>
        item.id === id
    )
  ) {

    id =
      `${baseId}-${counter++}`;

  }


  category = {

    id,

    name:
      categoryInput,

    icon:
      "📁"

  };


  state.data.categories.push(
    category
  );


  return category;

}


/* ============================================================
   ATUALIZAR DATAlIST
   ============================================================ */

function updateCategoryOptions() {

  elements.categoryOptions.innerHTML =
    state.data.categories
      .map(category => `
        <option
          value="${escapeAttribute(category.name)}"
        ></option>
      `)
      .join("");

}


/* ============================================================
   EXCLUIR
   ============================================================ */

function deleteResponse(id) {

  const response =
    getResponse(id);


  if (!response) {
    return;
  }


  const confirmed =
    confirm(
      `Tem certeza que deseja excluir "${response.title}"?`
    );


  if (!confirmed) {
    return;
  }


  state.data.responses =
    state.data.responses.filter(
      item =>
        item.id !== id
    );


  saveData();

  render();


  showToast(
    "✓ Resposta excluída"
  );

}


/* ============================================================
   CONTADOR
   ============================================================ */

function updateCharacterCount() {

  const length =
    elements.text.value.length;


  elements.characterCount.textContent =
    `${length} / ${CONFIG.maxTextLength} caracteres`;

}


/* ============================================================
   FECHAR MODAL DE RESPOSTA
   ============================================================ */

function closeResponseModal() {

  elements.responseModal.close();

  elements.responseForm.reset();

  state.editingId =
    null;

  updateCharacterCount();

}


/* ============================================================
   BACKDROP DOS MODAIS
   ============================================================ */

function handleDialogBackdrop(event) {

  if (
    event.target ===
    event.currentTarget
  ) {

    event.currentTarget.close();

  }

}


/* ============================================================
   EXPORTAR JSON
   ============================================================ */

function exportJSON() {

  if (!state.data) {
    return;
  }


  const json =
    JSON.stringify(
      state.data,
      null,
      2
    );


  const blob =
    new Blob(
      [json],
      {
        type:
          "application/json;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    "respostas-rapidas.json";


  document.body.appendChild(
    link
  );


  link.click();

  link.remove();


  URL.revokeObjectURL(
    url
  );


  showToast(
    "✓ JSON exportado"
  );

}


/* ============================================================
   TOAST
   ============================================================ */

function showToast(message) {

  elements.toast.textContent =
    message;


  elements.toast.classList.add(
    "show"
  );


  clearTimeout(
    state.toastTimer
  );


  state.toastTimer =
    setTimeout(
      () => {

        elements.toast.classList.remove(
          "show"
        );

      },
      2500
    );

}


/* ============================================================
   ERRO FATAL
   ============================================================ */

function showFatalError(error) {

  const message =
    error?.message ||
    "Erro desconhecido.";


  elements.cards.innerHTML = `
    <div class="empty">

      <div class="empty-icon">
        ⚠️
      </div>

      <h3>
        Não foi possível carregar as respostas
      </h3>

      <p>
        ${escapeHtml(message)}
      </p>

      <p>
        Verifique se o arquivo
        <strong>data/respostas.json</strong>
        está no local correto.
      </p>

    </div>
  `;

}


/* ============================================================
   SLUG
   ============================================================ */

function slugify(text) {

  return String(text)

    .normalize("NFD")

    .replace(
      /[\u0300-\u036f]/g,
      ""
    )

    .toLowerCase()

    .replace(
      /[^a-z0-9]+/g,
      "-"
    )

    .replace(
      /^-+|-+$/g,
      "");

}


/* ============================================================
   ID
   ============================================================ */

function createId() {

  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {

    return crypto.randomUUID();

  }


  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2)
  );

}


/* ============================================================
   ID ÚNICO
   ============================================================ */

function createUniqueId(base) {

  const cleanBase =
    base ||
    "resposta";


  let id =
    cleanBase;


  let counter =
    1;


  while (
    state.data.responses.some(
      response =>
        response.id === id
    )
  ) {

    id =
      `${cleanBase}-${counter++}`;

  }


  return id;

}


/* ============================================================
   SEGURANÇA HTML
   ============================================================ */

function escapeHtml(value) {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


function escapeAttribute(value) {

  return escapeHtml(
    value
  );

}