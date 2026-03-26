import { PLATFORM_CONFIG } from './config.js';
import {
  signIn,
  forgotPassword,
  logout,
  onSessionChanged,
  getCurrentUserProfile,
  ensurePlatformSettings,
  getPlatformSettings,
  getActiveVendorCount,
  getVendorCountSummary,
  fetchVendors,
  createVendorByAdmin,
  updateVendorByAdmin,
  updateVendorStatus,
  removeVendor,
  createClient,
  updateClient,
  deleteClient,
  fetchClients,
  createPurchase,
  fetchPurchases,
  createStockAdjustment,
  fetchStockAdjustments,
  createSale,
  fetchSales,
  deleteSale,
  createExpense,
  fetchExpenses,
  markSaleAsReceived,
  markExpenseAsPaid,
  markPurchaseAsPaid,
  publishNotice,
  fetchNotices,
  deleteNotice,
  computeVendorMetrics,
  groupSalesByDay,
  buildAdminVendorSummary,
  buildReceivableClients,
  buildStockSummary,
  formatters
} from './services.js';
import {
  buildNavigation,
  renderSidebar,
  renderPendingStatus,
  renderBlockedStatus,
  renderVendorDashboard,
  renderClientsView,
  renderPurchasesView,
  renderSalesView,
  renderFinanceView,
  renderVendorNoticesView,
  renderAdminDashboard,
  renderAdminVendorsView,
  renderAdminNoticesView,
  renderEmptyState
} from './ui.js';

const $ = (selector) => document.querySelector(selector);
const authView = $('#auth-view');
const appView = $('#app-view');
const statusView = $('#status-view');
const contentView = $('#content-view');
const sidebarNav = $('#sidebar-nav');
const viewTitle = $('#view-title');
const authMessage = $('#auth-message');
const platformBadge = $('#platform-badge');
const todayLabel = $('#today-label');
const sidebarUserName = $('#sidebar-user-name');
const sidebarUserRole = $('#sidebar-user-role');

const state = {
  sessionUser: null,
  profile: null,
  activeView: null,
  platformSettings: { maxActiveVendors: PLATFORM_CONFIG.maxActiveVendors },
  loadWarnings: [],
  cache: {
    clients: [],
    purchases: [],
    sales: [],
    expenses: [],
    notices: [],
    stockAdjustments: [],
    vendors: [],
    counts: { active: 0, pending: 0, blocked: 0, inactive: 0, total: 0 }
  },
  charts: {
    vendor: null,
    admin: null
  },
  editingClientId: null,
  editingVendorId: null,
  editingStockProduct: null,
  salesFilters: null
};

function formatDateInput(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultSalesFilters() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 29);

  return {
    startDate: formatDateInput(startDate),
    endDate: formatDateInput(endDate),
    clientId: 'all',
    productName: 'all',
    paymentType: 'all',
    status: 'all'
  };
}

function setMessage(message, type = '') {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.className = `status-message ${type}`.trim();
}

function showAppNotice(message) {
  window.alert(message);
}

function showStatusNotice(message, type = 'warning') {
  if (!message) {
    statusView.classList.add('hidden');
    statusView.innerHTML = '';
    return;
  }

  const labels = {
    warning: 'Atenção',
    error: 'Erro',
    info: 'Informação'
  };

  statusView.classList.remove('hidden');
  statusView.innerHTML = `
    <div class="inline-stack">
      <span class="pill ${type === 'error' ? 'danger' : type === 'warning' ? 'warning' : ''}">${labels[type] || 'Aviso'}</span>
    </div>
    <p style="margin: 12px 0 0;">${message}</p>
  `;
}

function todayString() {
  return new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' });
}

function defaultDate() {
  return new Date().toISOString().slice(0, 10);
}

function destroyCharts() {
  if (state.charts.vendor) {
    state.charts.vendor.destroy();
    state.charts.vendor = null;
  }
  if (state.charts.admin) {
    state.charts.admin.destroy();
    state.charts.admin = null;
  }
}

function readableError(error) {
  const code = error?.code || '';
  if (code.includes('permission-denied')) return 'Permissão insuficiente para carregar uma parte dos dados.';
  if (code.includes('failed-precondition')) return 'O Firebase pediu um ajuste de configuração para essa consulta.';
  if (code.includes('unavailable')) return 'Serviço temporariamente indisponível. Tente novamente.';
  return error?.message || 'Não foi possível carregar os dados agora.';
}

async function settle(label, loader, fallback) {
  try {
    const value = await loader();
    return value;
  } catch (error) {
    console.warn(`[Portal] Falha ao carregar ${label}:`, error);
    state.loadWarnings.push(`${label}: ${readableError(error)}`);
    return fallback;
  }
}

async function refreshPlatformBadge() {
  const settings = await settle('configurações da plataforma', getPlatformSettings, {
    maxActiveVendors: PLATFORM_CONFIG.maxActiveVendors
  });

  state.platformSettings = {
    maxActiveVendors: settings?.maxActiveVendors || PLATFORM_CONFIG.maxActiveVendors
  };

  if (state.profile?.role === 'admin') {
    const activeCount = await settle('contagem de vendedores ativos', getActiveVendorCount, 0);
    platformBadge.textContent = `${activeCount}/${state.platformSettings.maxActiveVendors} vendedores ativos`;
    platformBadge.classList.remove('hidden');
  } else {
    platformBadge.textContent = '';
    platformBadge.classList.add('hidden');
  }
}

function setAppVisible(isVisible) {
  authView.classList.toggle('hidden', isVisible);
  appView.classList.toggle('hidden', !isVisible);
}

async function loadVendorData() {
  const ownerId = state.profile.uid;

  state.cache.clients = await settle('clientes', () => fetchClients(ownerId), []);
  state.cache.purchases = await settle('compras', () => fetchPurchases(ownerId), []);
  state.cache.sales = await settle('vendas', () => fetchSales(ownerId), []);
  state.cache.expenses = await settle('despesas', () => fetchExpenses(ownerId), []);
  state.cache.stockAdjustments = await settle('ajustes de estoque', () => fetchStockAdjustments(ownerId), []);
  const notices = await settle('informativos', fetchNotices, []);
  state.cache.notices = notices.filter((notice) => ['all', 'vendors'].includes(notice.audience));
}

async function loadAdminData() {
  await settle('configurações da plataforma', ensurePlatformSettings, {
    maxActiveVendors: PLATFORM_CONFIG.maxActiveVendors
  });

  state.cache.vendors = await settle('vendedores', fetchVendors, []);
  state.cache.purchases = await settle('compras da rede', () => fetchPurchases(), []);
  state.cache.sales = await settle('vendas da rede', () => fetchSales(), []);
  state.cache.notices = await settle('informativos', fetchNotices, []);
  state.cache.stockAdjustments = await settle('ajustes de estoque da rede', () => fetchStockAdjustments(), []);
  state.cache.counts = await settle('resumo de vendedores', getVendorCountSummary, {
    active: 0,
    pending: 0,
    blocked: 0,
    inactive: 0,
    total: 0
  });
}

async function loadData() {
  state.loadWarnings = [];
  if (state.profile.role === 'admin') {
    await loadAdminData();
  } else {
    await loadVendorData();
  }
  await refreshPlatformBadge();
}

function renderNavigation() {
  const items = buildNavigation(state.profile);
  if (!items.some((item) => item.id === state.activeView)) {
    state.activeView = items[0]?.id || null;
  }
  renderSidebar(sidebarNav, items, state.activeView);
}

function drawVendorChart() {
  const ctx = document.getElementById('vendor-sales-chart');
  if (!ctx || typeof Chart === 'undefined') return;
  const entries = groupSalesByDay(state.cache.sales);
  state.charts.vendor = new Chart(ctx, {
    type: 'line',
    data: {
      labels: entries.map(([label]) => formatters.date(label)),
      datasets: [{
        label: 'Vendas (R$)',
        data: entries.map(([, value]) => value),
        borderColor: '#d75a12',
        backgroundColor: 'rgba(215, 90, 18, 0.12)',
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

function drawAdminChart(summary) {
  const ctx = document.getElementById('admin-vendors-chart');
  if (!ctx || typeof Chart === 'undefined') return;
  const top = summary.slice(0, 8);
  state.charts.admin = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map((item) => item.name),
      datasets: [{
        label: 'Vendido (R$)',
        data: top.map((item) => item.soldValue),
        backgroundColor: 'rgba(215, 90, 18, 0.82)',
        borderRadius: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

function setViewTitle(title) {
  viewTitle.textContent = title;
}

function hydrateDefaultDates() {
  ['#purchase-date', '#sale-date', '#expense-date'].forEach((selector) => {
    const element = $(selector);
    if (element && !element.value) element.value = defaultDate();
  });
}

function renderVendorView() {
  const metrics = computeVendorMetrics({
    sales: state.cache.sales,
    purchases: state.cache.purchases,
    expenses: state.cache.expenses,
    stockAdjustments: state.cache.stockAdjustments
  });
  const receivableClients = buildReceivableClients(state.cache.sales, state.cache.clients);

  const map = {
    'vendor-dashboard': {
      title: 'Dashboard',
      html: renderVendorDashboard({ metrics, sales: state.cache.sales, notices: state.cache.notices, receivableClients }),
      afterRender: drawVendorChart
    },
    'vendor-clients': {
      title: 'Clientes',
      html: renderClientsView(
        state.cache.clients,
        receivableClients,
        state.cache.clients.find((client) => client.id === state.editingClientId) || null
      )
    },
    'vendor-purchases': {
      title: 'Fornecedor',
      html: renderPurchasesView(
        buildStockSummary(state.cache.purchases, state.cache.sales, state.cache.stockAdjustments),
        state.cache.purchases,
        state.cache.sales,
        buildStockSummary(state.cache.purchases, state.cache.sales, state.cache.stockAdjustments)
          .find((item) => item.productName === state.editingStockProduct) || null
      )
    },
    'vendor-sales': {
      title: 'Vendas',
      html: renderSalesView(state.cache.clients, state.cache.sales, state.salesFilters || getDefaultSalesFilters())
    },
    'vendor-finance': {
      title: 'Financeiro',
      html: renderFinanceView({
        sales: state.cache.sales,
        purchases: state.cache.purchases,
        expenses: state.cache.expenses,
        metrics,
        receivableClients
      })
    },
    'vendor-notices': {
      title: 'Informativos',
      html: renderVendorNoticesView(state.cache.notices)
    }
  };

  const selected = map[state.activeView] || map['vendor-dashboard'];
  setViewTitle(selected.title);
  contentView.innerHTML = selected.html || renderEmptyState('Nenhum conteúdo disponível para esta tela.');
  selected.afterRender?.();
  hydrateDefaultDates();
}

function renderAdminView() {
  const vendorSummary = buildAdminVendorSummary(state.cache.vendors, state.cache.sales, state.cache.purchases);
  const totals = vendorSummary.reduce((acc, item) => {
    acc.soldValue += item.soldValue;
    acc.boughtValue += item.boughtValue;
    acc.openReceivable += item.openReceivable;
    return acc;
  }, { soldValue: 0, boughtValue: 0, openReceivable: 0 });

  const map = {
    'admin-dashboard': {
      title: 'Visão geral da rede',
      html: renderAdminDashboard({ vendorSummary, counts: state.cache.counts, notices: state.cache.notices, totals }),
      afterRender: () => drawAdminChart(vendorSummary)
    },
    'admin-vendors': {
      title: 'Vendedores',
      html: renderAdminVendorsView(
        state.cache.vendors,
        vendorSummary,
        state.platformSettings,
        state.cache.vendors.find((vendor) => vendor.uid === state.editingVendorId) || null
      )
    },
    'admin-notices': {
      title: 'Informativos',
      html: renderAdminNoticesView(state.cache.notices)
    }
  };

  const selected = map[state.activeView] || map['admin-dashboard'];
  setViewTitle(selected.title);
  contentView.innerHTML = selected.html || renderEmptyState('Nenhum conteúdo disponível para esta tela.');
  selected.afterRender?.();
}

function renderMainView() {
  destroyCharts();
  renderNavigation();
  if (state.profile.role === 'admin') {
    renderAdminView();
  } else {
    renderVendorView();
  }

  if (state.loadWarnings.length) {
    showStatusNotice(`Alguns dados não puderam ser carregados agora. ${state.loadWarnings.join(' | ')}`, 'warning');
  } else {
    showStatusNotice('');
  }
}

async function refreshAndRender() {
  await loadData();
  renderMainView();
}

async function handleLogin() {
  const email = $('#login-email')?.value.trim();
  const password = $('#login-password')?.value;
  if (!email || !password) {
    setMessage('Preencha e-mail e senha.', 'error');
    return;
  }

  try {
    setMessage('Entrando...', 'success');
    await signIn(email, password);
    setMessage('');
  } catch (error) {
    setMessage(error.message || 'Não foi possível entrar.', 'error');
  }
}

async function handleForgotPassword() {
  const email = $('#login-email')?.value.trim();
  if (!email) {
    setMessage('Digite o e-mail para recuperar a senha.', 'error');
    return;
  }

  try {
    await forgotPassword(email);
    setMessage('E-mail de redefinição enviado com sucesso.', 'success');
  } catch (error) {
    setMessage(error.message || 'Não foi possível enviar o e-mail.', 'error');
  }
}

async function handleSaveVendor() {
  const payload = {
    name: $('#vendor-name')?.value.trim(),
    email: $('#vendor-email')?.value.trim(),
    phone: $('#vendor-phone')?.value.trim(),
    city: $('#vendor-city')?.value.trim(),
    password: $('#vendor-password')?.value,
    status: $('#vendor-status')?.value || 'active'
  };

  if (state.editingVendorId) {
    if (!payload.name || !payload.email) {
      alert('Nome e e-mail são obrigatórios.');
      return;
    }

    try {
      await updateVendorByAdmin(state.editingVendorId, payload);
      state.editingVendorId = null;
      showAppNotice('Dados do vendedor atualizados com sucesso.');
      await refreshAndRender();
    } catch (error) {
      alert(error.message || 'Não foi possível atualizar o vendedor.');
    }
    return;
  }

  if (!payload.name || !payload.email || !payload.password) {
    alert('Nome, e-mail e senha inicial são obrigatórios.');
    return;
  }

  try {
    const created = await createVendorByAdmin(state.profile, payload);
    showAppNotice(`Vendedor criado com sucesso.\n\nE-mail: ${created.email}\nSenha inicial: ${created.password}\nStatus: ${created.status}`);
    await refreshAndRender();
  } catch (error) {
    alert(error.message || 'Não foi possível criar o vendedor.');
  }
}

async function handleSaveClient() {
  const payload = {
    name: $('#client-name')?.value.trim(),
    phone: $('#client-phone')?.value.trim(),
    city: $('#client-city')?.value.trim(),
    notes: $('#client-notes')?.value.trim()
  };
  if (!payload.name) {
    alert('Informe o nome do cliente.');
    return;
  }

  if (state.editingClientId) {
    await updateClient(state.profile.uid, state.editingClientId, payload);
    state.editingClientId = null;
  } else {
    await createClient(state.profile.uid, payload);
  }

  await refreshAndRender();
}

async function handleSavePurchase() {
  const payload = {
    date: $('#purchase-date')?.value,
    productName: $('#purchase-product')?.value,
    paymentType: $('#purchase-payment')?.value,
    quantity: Number($('#purchase-quantity')?.value || 0),
    unitCost: Number($('#purchase-unit-cost')?.value || 0),
    dueDate: $('#purchase-due-date')?.value,
    notes: $('#purchase-notes')?.value.trim()
  };
  if (!payload.date || !payload.productName || !payload.quantity) {
    alert('Preencha os campos principais da compra.');
    return;
  }
  await createPurchase(state.profile.uid, payload);
  await refreshAndRender();
}

async function handleSaveStockAdjustment() {
  const productName = $('#stock-adjust-product')?.value;
  const currentQuantity = Number($('#stock-adjust-current')?.value || 0);
  const newQuantity = Number($('#stock-adjust-new')?.value || 0);
  const notes = $('#stock-adjust-notes')?.value.trim();

  if (!productName) {
    alert('Selecione um produto para ajustar o estoque.');
    return;
  }

  if (!Number.isFinite(newQuantity) || newQuantity < 0) {
    alert('Informe um estoque final válido.');
    return;
  }

  if (newQuantity === currentQuantity) {
    alert('Nenhuma alteração foi feita no estoque.');
    return;
  }

  await createStockAdjustment(state.profile.uid, {
    productName,
    currentQuantity,
    newQuantity,
    notes
  });

  state.editingStockProduct = null;
  await refreshAndRender();
}

async function handleSaveSale() {
  const clientSelect = $('#sale-client');
  const selectedOption = clientSelect?.options?.[clientSelect.selectedIndex];
  const payload = {
    date: $('#sale-date')?.value,
    clientId: clientSelect?.value,
    clientName: selectedOption?.dataset?.name || 'Cliente avulso',
    paymentType: $('#sale-payment')?.value,
    productName: $('#sale-product')?.value,
    quantity: Number($('#sale-quantity')?.value || 0),
    unitPrice: Number($('#sale-unit-price')?.value || 0),
    dueDate: $('#sale-due-date')?.value,
    notes: $('#sale-notes')?.value.trim()
  };
  if (!payload.date || !payload.productName || !payload.quantity || !payload.unitPrice) {
    alert('Preencha os dados principais da venda.');
    return;
  }

  const stockSummary = buildStockSummary(state.cache.purchases, state.cache.sales, state.cache.stockAdjustments);
  const stockItem = stockSummary.find((item) => item.productName === payload.productName);
  const availableUnits = Number(stockItem?.availableQuantity || 0);

  if (payload.quantity > availableUnits) {
    alert(`Estoque insuficiente para ${payload.productName}. Disponível agora: ${availableUnits} unidade(s).`);
    return;
  }

  await createSale(state.profile.uid, payload);
  await refreshAndRender();
}

async function handleSaveExpense() {
  const payload = {
    date: $('#expense-date')?.value,
    dueDate: $('#expense-due-date')?.value,
    description: $('#expense-description')?.value.trim(),
    category: $('#expense-category')?.value.trim(),
    amount: Number($('#expense-amount')?.value || 0),
    status: $('#expense-status')?.value,
    notes: $('#expense-notes')?.value.trim()
  };
  if (!payload.date || !payload.description || !payload.amount) {
    alert('Preencha os dados principais da despesa.');
    return;
  }
  await createExpense(state.profile.uid, payload);
  await refreshAndRender();
}

async function handleSaveNotice() {
  const payload = {
    title: $('#notice-title')?.value.trim(),
    body: $('#notice-body')?.value.trim(),
    audience: $('#notice-audience')?.value,
    pinned: $('#notice-pinned')?.value === 'true'
  };
  if (!payload.title || !payload.body) {
    alert('Preencha título e mensagem do informativo.');
    return;
  }
  await publishNotice(state.profile, payload);
  await refreshAndRender();
}

async function handleTableAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === 'edit-client') {
    state.editingClientId = id;
    renderMainView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (action === 'cancel-edit-client') {
    state.editingClientId = null;
    renderMainView();
    return;
  }

  if (action === 'edit-vendor') {
    state.editingVendorId = id;
    renderMainView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (action === 'cancel-edit-vendor') {
    state.editingVendorId = null;
    renderMainView();
    return;
  }

  if (action === 'edit-stock') {
    state.editingStockProduct = button.dataset.product || null;
    renderMainView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (action === 'cancel-edit-stock') {
    state.editingStockProduct = null;
    renderMainView();
    return;
  }

  if (action === 'delete-client') {
    if (!confirm('Deseja excluir este cliente?')) return;
    await deleteClient(state.profile.uid, id);
    if (state.editingClientId === id) state.editingClientId = null;
  }

  if (action === 'reset-sales-filters') {
    state.salesFilters = getDefaultSalesFilters();
    renderMainView();
    return;
  }

  if (action === 'receive-sale') await markSaleAsReceived(id);
  if (action === 'delete-sale') {
    if (!confirm('Deseja excluir esta venda do histórico?')) return;
    await deleteSale(state.profile.uid, id);
  }
  if (action === 'pay-purchase') await markPurchaseAsPaid(id);
  if (action === 'pay-expense') await markExpenseAsPaid(id);
  if (action === 'delete-notice') {
    if (!confirm('Deseja excluir este informativo?')) return;
    await deleteNotice(id);
  }
  if (action === 'set-vendor-status') {
    const status = button.dataset.status;
    const labels = {
      active: 'ativar',
      pending: 'marcar como pendente',
      inactive: 'inativar',
      blocked: 'bloquear'
    };
    if (!confirm(`Confirma ${labels[status] || 'alterar'} este vendedor?`)) return;
    await updateVendorStatus(id, status);
  }
  if (action === 'delete-vendor') {
    if (!confirm('Deseja excluir este vendedor e remover também clientes, compras, vendas e despesas vinculadas?')) return;
    await removeVendor(id);
    if (state.editingVendorId === id) state.editingVendorId = null;
  }

  await refreshAndRender();
}

function bindGlobalEvents() {
  $('#btn-login')?.addEventListener('click', handleLogin);
  $('#btn-forgot-password')?.addEventListener('click', handleForgotPassword);
  $('#btn-logout')?.addEventListener('click', logout);

  sidebarNav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    state.activeView = button.dataset.view;
    if (button.dataset.view !== 'vendor-clients') state.editingClientId = null;
    if (button.dataset.view !== 'admin-vendors') state.editingVendorId = null;
    if (button.dataset.view !== 'vendor-purchases') state.editingStockProduct = null;
    renderMainView();
  });

  contentView.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      try {
        await handleTableAction(actionButton);
      } catch (error) {
        alert(error.message || 'Não foi possível concluir a ação.');
      }
      return;
    }

    if (event.target.id === 'btn-save-vendor') return handleSaveVendor();
    if (event.target.id === 'btn-save-client') return handleSaveClient();
    if (event.target.id === 'btn-save-purchase') return handleSavePurchase();
    if (event.target.id === 'btn-save-stock-adjustment') return handleSaveStockAdjustment();
    if (event.target.id === 'btn-save-sale') return handleSaveSale();
    if (event.target.id === 'btn-save-expense') return handleSaveExpense();
    if (event.target.id === 'btn-save-notice') return handleSaveNotice();
  });

  contentView.addEventListener('change', (event) => {
    const filterName = event.target?.dataset?.salesFilter;
    if (!filterName) return;

    if (!state.salesFilters) {
      state.salesFilters = getDefaultSalesFilters();
    }

    state.salesFilters[filterName] = event.target.value;

    if (filterName === 'startDate' && state.salesFilters.endDate && state.salesFilters.startDate && state.salesFilters.startDate > state.salesFilters.endDate) {
      state.salesFilters.endDate = state.salesFilters.startDate;
    }

    if (filterName === 'endDate' && state.salesFilters.startDate && state.salesFilters.endDate && state.salesFilters.endDate < state.salesFilters.startDate) {
      state.salesFilters.startDate = state.salesFilters.endDate;
    }

    renderMainView();
  });
}

async function bootstrapSession(user) {
  destroyCharts();
  if (!user) {
    state.sessionUser = null;
    state.profile = null;
    state.activeView = null;
    state.loadWarnings = [];
    state.editingClientId = null;
    state.editingVendorId = null;
    state.editingStockProduct = null;
    state.salesFilters = getDefaultSalesFilters();
    contentView.innerHTML = '';
    sidebarNav.innerHTML = '';
    showStatusNotice('');
    setAppVisible(false);
    return;
  }

  try {
    const profile = await getCurrentUserProfile(user.uid);
    if (!profile) {
      setMessage('Seu usuário existe no Auth, mas não foi encontrado na coleção users.', 'error');
      await logout();
      return;
    }

    state.sessionUser = user;
    state.profile = { ...profile, uid: user.uid };
    state.editingClientId = null;
    state.editingVendorId = null;
    state.editingStockProduct = null;
    state.salesFilters = getDefaultSalesFilters();

    sidebarUserName.textContent = profile.name || profile.email;
    sidebarUserRole.textContent = profile.role === 'admin' ? 'Administrador' : 'Vendedor';
    todayLabel.textContent = todayString();
    setAppVisible(true);
    renderNavigation();
    contentView.innerHTML = '<section class="card section-card"><p>Carregando dados...</p></section>';

    if (profile.role !== 'admin' && profile.status === 'pending') {
      contentView.innerHTML = '';
      sidebarNav.innerHTML = '';
      renderPendingStatus(statusView, profile);
      return;
    }

    if (profile.role !== 'admin' && profile.status === 'blocked') {
      contentView.innerHTML = '';
      sidebarNav.innerHTML = '';
      renderBlockedStatus(statusView, profile);
      return;
    }

    await refreshAndRender();
  } catch (error) {
    console.error('[Portal] Falha ao iniciar sessão:', error);
    renderNavigation();
    contentView.innerHTML = renderEmptyState('Não foi possível carregar o painel agora. Atualize a página e tente novamente.');
    showStatusNotice(readableError(error), 'error');
  }
}

bindGlobalEvents();
onSessionChanged(bootstrapSession);
