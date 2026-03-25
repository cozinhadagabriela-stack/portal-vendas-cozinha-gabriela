import { PLATFORM_CONFIG } from './config.js';
import { formatters } from './services.js';

function statusPill(status) {
  const map = {
    active: ['Ativo', 'success'],
    pending: ['Pendente', 'warning'],
    blocked: ['Bloqueado', 'danger'],
    inactive: ['Inativo', 'warning'],
    paid: ['Pago', 'success'],
    open: ['Em aberto', 'warning'],
    received: ['Recebido', 'success']
  };
  const [label, klass] = map[status] || [status || '—', ''];
  return `<span class="pill ${klass}">${label}</span>`;
}

export function buildNavigation(profile) {
  if (profile.role === 'admin') {
    return [
      { id: 'admin-dashboard', label: 'Visão geral' },
      { id: 'admin-vendors', label: 'Vendedores' },
      { id: 'admin-notices', label: 'Informativos' }
    ];
  }

  return [
    { id: 'vendor-dashboard', label: 'Dashboard' },
    { id: 'vendor-clients', label: 'Clientes' },
    { id: 'vendor-purchases', label: 'Compras' },
    { id: 'vendor-sales', label: 'Vendas' },
    { id: 'vendor-finance', label: 'Financeiro' },
    { id: 'vendor-notices', label: 'Informativos' }
  ];
}

export function renderSidebar(navEl, items, activeView) {
  navEl.innerHTML = items.map((item) => `
    <button class="nav-btn ${item.id === activeView ? 'active' : ''}" data-view="${item.id}">${item.label}</button>
  `).join('');
}

export function renderPendingStatus(container, profile) {
  container.classList.remove('hidden');
  container.innerHTML = `
    <h2>Seu cadastro está em análise</h2>
    <p>
      Olá, <strong>${profile.name || profile.email}</strong>. Seu acesso foi criado, mas ainda precisa ser liberado
      no Portal de Vendas Cozinha da Gabriela.
    </p>
    <p>Assim que a aprovação for concluída, você poderá usar normalmente o painel de vendas.</p>
  `;
}

export function renderBlockedStatus(container, profile) {
  container.classList.remove('hidden');
  container.innerHTML = `
    <h2>Acesso bloqueado</h2>
    <p>
      O login de <strong>${profile.name || profile.email}</strong> está bloqueado no momento.
      Entre em contato com a administração da Cozinha da Gabriela para regularização.
    </p>
  `;
}

export function renderEmptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

export function renderVendorDashboard({ metrics, sales, notices }) {
  return `
    <section class="metrics-grid">
      <article class="card metric-card">
        <h3>Vendas no mês</h3>
        <p class="metric-value">${formatters.currency(metrics.salesAmount)}</p>
        <p class="metric-foot">${metrics.totalSalesCount} vendas registradas no período</p>
      </article>
      <article class="card metric-card">
        <h3>Em aberto para receber</h3>
        <p class="metric-value">${formatters.currency(metrics.receivableOpen)}</p>
        <p class="metric-foot">Clientes no prazo pendentes: ${metrics.overdueClients}</p>
      </article>
      <article class="card metric-card">
        <h3>Contas a pagar</h3>
        <p class="metric-value">${formatters.currency(metrics.payableOpen)}</p>
        <p class="metric-foot">Compras e despesas ainda não quitadas</p>
      </article>
      <article class="card metric-card">
        <h3>Estoque estimado</h3>
        <p class="metric-value">${metrics.stockUnits}</p>
        <p class="metric-foot">Unidades ainda disponíveis para venda</p>
      </article>
    </section>

    <section class="split-grid">
      <article class="card section-card chart-box">
        <h2>Ritmo de vendas</h2>
        <canvas id="vendor-sales-chart"></canvas>
      </article>
      <article class="card section-card">
        <h2>Resumo rápido</h2>
        <div class="kpi-panel">
          <div class="kpi-line"><span>Compras do mês</span><strong>${formatters.currency(metrics.purchasesAmount)}</strong></div>
          <div class="kpi-line"><span>Despesas do mês</span><strong>${formatters.currency(metrics.expensesAmount)}</strong></div>
          <div class="kpi-line"><span>Caixa projetado</span><strong>${formatters.currency(metrics.projectedCash)}</strong></div>
          <div class="kpi-line"><span>Últimas vendas</span><strong>${sales.length}</strong></div>
        </div>
      </article>
    </section>

    <section class="card section-card">
      <h2>Informativos recentes</h2>
      <div class="notice-list">
        ${notices.length ? notices.slice(0, 3).map((notice) => `
          <article class="notice-card">
            <div class="inline-stack">
              ${notice.pinned ? '<span class="pill success">Fixado</span>' : ''}
              <span class="pill">${notice.audience === 'all' ? 'Todos' : 'Vendedores'}</span>
            </div>
            <h4>${notice.title}</h4>
            <p>${notice.body}</p>
            <div class="notice-meta">Publicado em ${formatters.shortDateTime(notice.createdAt)} por ${notice.createdByName || 'Admin'}</div>
          </article>
        `).join('') : renderEmptyState('Nenhum informativo publicado até o momento.')}
      </div>
    </section>
  `;
}

export function renderClientsView(clients) {
  return `
    <section class="split-grid">
      <article class="card section-card">
        <h2>Novo cliente</h2>
        <div class="field-group">
          <label for="client-name">Nome</label>
          <input id="client-name" type="text" placeholder="Nome do cliente" />
        </div>
        <div class="field-grid two-columns">
          <div class="field-group">
            <label for="client-phone">Telefone</label>
            <input id="client-phone" type="text" placeholder="Telefone" />
          </div>
          <div class="field-group">
            <label for="client-city">Cidade</label>
            <input id="client-city" type="text" placeholder="Cidade" />
          </div>
        </div>
        <div class="field-group">
          <label for="client-notes">Observações</label>
          <textarea id="client-notes" rows="4" placeholder="Ex.: compra sempre no prazo"></textarea>
        </div>
        <div class="form-actions">
          <button id="btn-save-client" class="btn btn-primary">Salvar cliente</button>
        </div>
      </article>

      <article class="card section-card">
        <h2>Clientes cadastrados</h2>
        ${clients.length ? `
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Cidade</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                ${clients.map((client) => `
                  <tr>
                    <td>${client.name || '—'}</td>
                    <td>${client.phone || '—'}</td>
                    <td>${client.city || '—'}</td>
                    <td>${client.notes || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState('Nenhum cliente cadastrado ainda.')}
      </article>
    </section>
  `;
}

export function renderPurchasesView() {
  return `
    <section class="split-grid">
      <article class="card section-card">
        <h2>Registrar compra</h2>
        <div class="field-grid three-columns">
          <div class="field-group">
            <label for="purchase-date">Data</label>
            <input id="purchase-date" type="date" />
          </div>
          <div class="field-group">
            <label for="purchase-product">Produto</label>
            <select id="purchase-product">
              ${PLATFORM_CONFIG.defaultCatalog.map((item) => `<option value="${item}">${item}</option>`).join('')}
            </select>
          </div>
          <div class="field-group">
            <label for="purchase-payment">Pagamento</label>
            <select id="purchase-payment">
              <option value="avista">À vista</option>
              <option value="prazo">Prazo</option>
            </select>
          </div>
        </div>
        <div class="field-grid three-columns">
          <div class="field-group">
            <label for="purchase-quantity">Quantidade</label>
            <input id="purchase-quantity" type="number" min="1" value="1" />
          </div>
          <div class="field-group">
            <label for="purchase-unit-cost">Custo unitário (R$)</label>
            <input id="purchase-unit-cost" type="number" step="0.01" value="10" />
          </div>
          <div class="field-group">
            <label for="purchase-due-date">Vencimento</label>
            <input id="purchase-due-date" type="date" />
          </div>
        </div>
        <div class="field-group">
          <label for="purchase-notes">Observações</label>
          <textarea id="purchase-notes" rows="3" placeholder="Ex.: retirada com pagamento em 15 dias"></textarea>
        </div>
        <div class="form-actions">
          <button id="btn-save-purchase" class="btn btn-primary">Salvar compra</button>
        </div>
      </article>

      <article class="card section-card">
        <h2>Como funciona</h2>
        <div class="kpi-panel">
          <div class="kpi-line"><span>Objetivo</span><strong>Controlar reposição e contas com a fábrica</strong></div>
          <div class="kpi-line"><span>À vista</span><strong>Entra como compra paga</strong></div>
          <div class="kpi-line"><span>No prazo</span><strong>Entra em contas a pagar</strong></div>
          <div class="kpi-line"><span>Impacto no estoque</span><strong>Aumenta unidades disponíveis</strong></div>
        </div>
      </article>
    </section>
  `;
}

export function renderSalesView(clients) {
  return `
    <section class="split-grid">
      <article class="card section-card">
        <h2>Registrar venda</h2>
        <div class="field-grid three-columns">
          <div class="field-group">
            <label for="sale-date">Data</label>
            <input id="sale-date" type="date" />
          </div>
          <div class="field-group">
            <label for="sale-client">Cliente</label>
            <select id="sale-client">
              <option value="">Cliente avulso</option>
              ${clients.map((client) => `<option value="${client.id}" data-name="${client.name}">${client.name}</option>`).join('')}
            </select>
          </div>
          <div class="field-group">
            <label for="sale-payment">Pagamento</label>
            <select id="sale-payment">
              <option value="avista">À vista</option>
              <option value="prazo">Prazo</option>
            </select>
          </div>
        </div>
        <div class="field-grid four-columns">
          <div class="field-group">
            <label for="sale-product">Produto</label>
            <select id="sale-product">
              ${PLATFORM_CONFIG.defaultCatalog.map((item) => `<option value="${item}">${item}</option>`).join('')}
            </select>
          </div>
          <div class="field-group">
            <label for="sale-quantity">Quantidade</label>
            <input id="sale-quantity" type="number" min="1" value="1" />
          </div>
          <div class="field-group">
            <label for="sale-unit-price">Valor unitário (R$)</label>
            <input id="sale-unit-price" type="number" step="0.01" placeholder="0,00" />
          </div>
          <div class="field-group">
            <label for="sale-due-date">Vencimento</label>
            <input id="sale-due-date" type="date" />
          </div>
        </div>
        <div class="field-group">
          <label for="sale-notes">Observações</label>
          <textarea id="sale-notes" rows="3" placeholder="Ex.: pagamento combinado para daqui 10 dias"></textarea>
        </div>
        <div class="form-actions">
          <button id="btn-save-sale" class="btn btn-primary">Salvar venda</button>
        </div>
      </article>

      <article class="card section-card">
        <h2>Dica rápida</h2>
        <p class="small-text">
          Para vendas no prazo, sempre selecione o cliente e preencha o vencimento.
          Assim o sistema acompanha corretamente o que ainda falta receber.
        </p>
      </article>
    </section>
  `;
}

export function renderFinanceView({ sales, purchases, expenses, metrics }) {
  return `
    <section class="metrics-grid">
      <article class="card metric-card">
        <h3>Caixa projetado</h3>
        <p class="metric-value">${formatters.currency(metrics.projectedCash)}</p>
        <p class="metric-foot">Vendas - compras - despesas do mês</p>
      </article>
      <article class="card metric-card">
        <h3>A receber</h3>
        <p class="metric-value">${formatters.currency(metrics.receivableOpen)}</p>
        <p class="metric-foot">Clientes com pendência</p>
      </article>
      <article class="card metric-card">
        <h3>A pagar</h3>
        <p class="metric-value">${formatters.currency(metrics.payableOpen)}</p>
        <p class="metric-foot">Compras e despesas em aberto</p>
      </article>
      <article class="card metric-card">
        <h3>Pode recomprar?</h3>
        <p class="metric-value">${metrics.projectedCash >= 0 ? 'Sim' : 'Atenção'}</p>
        <p class="metric-foot">Leitura rápida da saúde do caixa</p>
      </article>
    </section>

    <section class="split-grid">
      <article class="card section-card">
        <h2>Lançar despesa</h2>
        <div class="field-grid two-columns">
          <div class="field-group">
            <label for="expense-date">Data</label>
            <input id="expense-date" type="date" />
          </div>
          <div class="field-group">
            <label for="expense-due-date">Vencimento</label>
            <input id="expense-due-date" type="date" />
          </div>
        </div>
        <div class="field-grid two-columns">
          <div class="field-group">
            <label for="expense-description">Descrição</label>
            <input id="expense-description" type="text" placeholder="Ex.: combustível" />
          </div>
          <div class="field-group">
            <label for="expense-category">Categoria</label>
            <input id="expense-category" type="text" placeholder="Ex.: transporte" />
          </div>
        </div>
        <div class="field-grid two-columns">
          <div class="field-group">
            <label for="expense-amount">Valor (R$)</label>
            <input id="expense-amount" type="number" step="0.01" placeholder="0,00" />
          </div>
          <div class="field-group">
            <label for="expense-status">Status</label>
            <select id="expense-status">
              <option value="open">Em aberto</option>
              <option value="paid">Pago</option>
            </select>
          </div>
        </div>
        <div class="field-group">
          <label for="expense-notes">Observações</label>
          <textarea id="expense-notes" rows="3"></textarea>
        </div>
        <div class="form-actions">
          <button id="btn-save-expense" class="btn btn-primary">Salvar despesa</button>
        </div>
      </article>

      <article class="card section-card">
        <h2>Resumo operacional</h2>
        <div class="kpi-panel">
          <div class="kpi-line"><span>Total de vendas</span><strong>${sales.length}</strong></div>
          <div class="kpi-line"><span>Total de compras</span><strong>${purchases.length}</strong></div>
          <div class="kpi-line"><span>Total de despesas</span><strong>${expenses.length}</strong></div>
          <div class="kpi-line"><span>Estoque estimado</span><strong>${metrics.stockUnits} un.</strong></div>
        </div>
      </article>
    </section>

    <section class="split-grid">
      <article class="card section-card">
        <h2>Recebimentos em aberto</h2>
        ${sales.filter((item) => item.status !== 'received').length ? `
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Produto</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${sales.filter((item) => item.status !== 'received').map((item) => `
                  <tr>
                    <td>${item.clientName || 'Cliente avulso'}</td>
                    <td>${item.productName || '—'}</td>
                    <td>${formatters.currency(item.total)}</td>
                    <td>${item.dueDate ? formatters.date(item.dueDate) : '—'}</td>
                    <td>${statusPill(item.status)}</td>
                    <td><button class="btn-inline" data-action="receive-sale" data-id="${item.id}">Marcar como recebido</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState('Nenhum recebimento em aberto.')}
      </article>

      <article class="card section-card">
        <h2>Pagamentos em aberto</h2>
        ${(purchases.filter((item) => item.status !== 'paid').length || expenses.filter((item) => item.status !== 'paid').length) ? `
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${purchases.filter((item) => item.status !== 'paid').map((item) => `
                  <tr>
                    <td>Compra</td>
                    <td>${item.productName}</td>
                    <td>${formatters.currency(item.total)}</td>
                    <td>${item.dueDate ? formatters.date(item.dueDate) : '—'}</td>
                    <td>${statusPill(item.status)}</td>
                    <td><button class="btn-inline" data-action="pay-purchase" data-id="${item.id}">Marcar como pago</button></td>
                  </tr>
                `).join('')}
                ${expenses.filter((item) => item.status !== 'paid').map((item) => `
                  <tr>
                    <td>Despesa</td>
                    <td>${item.description}</td>
                    <td>${formatters.currency(item.amount)}</td>
                    <td>${item.dueDate ? formatters.date(item.dueDate) : '—'}</td>
                    <td>${statusPill(item.status)}</td>
                    <td><button class="btn-inline" data-action="pay-expense" data-id="${item.id}">Marcar como pago</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState('Nenhum pagamento em aberto.')}
      </article>
    </section>
  `;
}

export function renderVendorNoticesView(notices) {
  return `
    <section class="card section-card">
      <h2>Informativos da plataforma</h2>
      <div class="notice-list">
        ${notices.length ? notices.map((notice) => `
          <article class="notice-card">
            <div class="inline-stack">
              ${notice.pinned ? '<span class="pill success">Fixado</span>' : ''}
              <span class="pill">${notice.audience === 'all' ? 'Todos' : 'Vendedores'}</span>
            </div>
            <h4>${notice.title}</h4>
            <p>${notice.body}</p>
            <div class="notice-meta">Publicado em ${formatters.shortDateTime(notice.createdAt)} por ${notice.createdByName || 'Admin'}</div>
          </article>
        `).join('') : renderEmptyState('Ainda não há informativos publicados.')}
      </div>
    </section>
  `;
}

export function renderAdminDashboard({ vendorSummary, counts, notices, totals }) {
  return `
    <section class="metrics-grid">
      <article class="card metric-card">
        <h3>Vendedores ativos</h3>
        <p class="metric-value">${counts.active}</p>
        <p class="metric-foot">${counts.total} cadastrados na base</p>
      </article>
      <article class="card metric-card">
        <h3>Cadastros pendentes</h3>
        <p class="metric-value">${counts.pending}</p>
        <p class="metric-foot">Aguardando liberação</p>
      </article>
      <article class="card metric-card">
        <h3>Vendas da rede</h3>
        <p class="metric-value">${formatters.currency(totals.soldValue)}</p>
        <p class="metric-foot">Volume somado dos vendedores</p>
      </article>
      <article class="card metric-card">
        <h3>Compras registradas</h3>
        <p class="metric-value">${formatters.currency(totals.boughtValue)}</p>
        <p class="metric-foot">Mercadoria comprada dos produtos</p>
      </article>
    </section>

    <section class="split-grid">
      <article class="card section-card chart-box">
        <h2>Desempenho por vendedor</h2>
        <canvas id="admin-vendors-chart"></canvas>
      </article>
      <article class="card section-card">
        <h2>Resumo gerencial</h2>
        <div class="kpi-panel">
          <div class="kpi-line"><span>Em aberto para receber</span><strong>${formatters.currency(totals.openReceivable)}</strong></div>
          <div class="kpi-line"><span>Vendedores bloqueados</span><strong>${counts.blocked}</strong></div>
          <div class="kpi-line"><span>Vendedores inativos</span><strong>${counts.inactive}</strong></div>
          <div class="kpi-line"><span>Informativos publicados</span><strong>${notices.length}</strong></div>
        </div>
      </article>
    </section>

    <section class="card section-card">
      <h2>Ranking rápido</h2>
      ${vendorSummary.length ? `
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Status</th>
                <th>Vendido</th>
                <th>Comprado</th>
                <th>Em aberto</th>
                <th>Qtd. vendas</th>
              </tr>
            </thead>
            <tbody>
              ${vendorSummary.map((item) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${statusPill(item.status)}</td>
                  <td>${formatters.currency(item.soldValue)}</td>
                  <td>${formatters.currency(item.boughtValue)}</td>
                  <td>${formatters.currency(item.openReceivable)}</td>
                  <td>${item.totalSales}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : renderEmptyState('Ainda não há movimentações para gerar o ranking.')}
    </section>
  `;
}

export function renderAdminVendorsView(vendors, vendorSummary) {
  const summaryMap = new Map(vendorSummary.map((item) => [item.uid, item]));
  return `
    <section class="card section-card">
      <h2>Gestão de vendedores</h2>
      ${vendors.length ? `
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>E-mail</th>
                <th>Cidade</th>
                <th>Status</th>
                <th>Vendido</th>
                <th>Comprado</th>
                <th>Em aberto</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${vendors.map((vendor) => {
                const summary = summaryMap.get(vendor.uid) || { soldValue: 0, boughtValue: 0, openReceivable: 0 };
                return `
                  <tr>
                    <td>${vendor.name || '—'}</td>
                    <td>${vendor.email || '—'}</td>
                    <td>${vendor.city || '—'}</td>
                    <td>${statusPill(vendor.status)}</td>
                    <td>${formatters.currency(summary.soldValue)}</td>
                    <td>${formatters.currency(summary.boughtValue)}</td>
                    <td>${formatters.currency(summary.openReceivable)}</td>
                    <td>
                      <div class="table-actions">
                        <button class="btn-inline" data-action="set-vendor-status" data-status="active" data-id="${vendor.uid}">Ativar</button>
                        <button class="btn-inline" data-action="set-vendor-status" data-status="inactive" data-id="${vendor.uid}">Inativar</button>
                        <button class="btn-inline" data-action="set-vendor-status" data-status="blocked" data-id="${vendor.uid}">Bloquear</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : renderEmptyState('Nenhum vendedor cadastrado ainda.')}
    </section>
  `;
}

export function renderAdminNoticesView(notices) {
  return `
    <section class="split-grid">
      <article class="card section-card">
        <h2>Novo informativo</h2>
        <div class="field-group">
          <label for="notice-title">Título</label>
          <input id="notice-title" type="text" placeholder="Ex.: alteração de rota de entregas" />
        </div>
        <div class="field-grid two-columns">
          <div class="field-group">
            <label for="notice-audience">Público</label>
            <select id="notice-audience">
              <option value="vendors">Vendedores</option>
              <option value="all">Todos</option>
            </select>
          </div>
          <div class="field-group">
            <label for="notice-pinned">Fixar informativo?</label>
            <select id="notice-pinned">
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          </div>
        </div>
        <div class="field-group">
          <label for="notice-body">Mensagem</label>
          <textarea id="notice-body" rows="7" placeholder="Digite aqui o aviso para os vendedores..."></textarea>
        </div>
        <div class="form-actions">
          <button id="btn-save-notice" class="btn btn-primary">Publicar informativo</button>
        </div>
      </article>

      <article class="card section-card">
        <h2>Informativos publicados</h2>
        <div class="notice-list">
          ${notices.length ? notices.map((notice) => `
            <article class="notice-card">
              <div class="inline-stack">
                ${notice.pinned ? '<span class="pill success">Fixado</span>' : ''}
                <span class="pill">${notice.audience === 'all' ? 'Todos' : 'Vendedores'}</span>
              </div>
              <h4>${notice.title}</h4>
              <p>${notice.body}</p>
              <div class="notice-meta">Publicado em ${formatters.shortDateTime(notice.createdAt)} por ${notice.createdByName || 'Admin'}</div>
              <div class="form-actions">
                <button class="btn-inline" data-action="delete-notice" data-id="${notice.id}">Excluir</button>
              </div>
            </article>
          `).join('') : renderEmptyState('Nenhum informativo publicado ainda.')}
        </div>
      </article>
    </section>
  `;
}
