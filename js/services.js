import { PLATFORM_CONFIG } from './config.js';
import {
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
  Timestamp,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  createAuthUserWithoutSwitching
} from './firebase-init.js';

const collections = {
  users: 'users',
  clients: 'clients',
  purchases: 'purchases',
  sales: 'sales',
  expenses: 'expenses',
  notices: 'notices',
  settings: 'settings'
};

function normalizeDoc(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function toCurrency(value) {
  return Number(value || 0);
}

function monthStartDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function safeDate(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  return new Date(value);
}

export const formatters = {
  currency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toCurrency(value));
  },
  date(value) {
    const parsed = safeDate(value);
    if (!parsed || Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('pt-BR');
  },
  shortDateTime(value) {
    const parsed = safeDate(value);
    if (!parsed || Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }
};

export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function forgotPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function logout() {
  return signOut(auth);
}

export function onSessionChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getCurrentUserProfile(uid) {
  const snap = await getDoc(doc(db, collections.users, uid));
  return snap.exists() ? normalizeDoc(snap) : null;
}

export async function ensurePlatformSettings() {
  const ref = doc(db, collections.settings, 'platform');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      maxActiveVendors: PLATFORM_CONFIG.maxActiveVendors,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { maxActiveVendors: PLATFORM_CONFIG.maxActiveVendors };
  }
  return snap.data();
}

export async function getPlatformSettings() {
  const ref = doc(db, collections.settings, 'platform');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return {
      maxActiveVendors: PLATFORM_CONFIG.maxActiveVendors
    };
  }
  const settings = snap.data() || {};
  return {
    maxActiveVendors: settings.maxActiveVendors || PLATFORM_CONFIG.maxActiveVendors
  };
}

export async function getActiveVendorCount() {
  const q = query(collection(db, collections.users), where('role', '==', 'vendor'), where('status', '==', 'active'));
  const snap = await getDocs(q);
  return snap.size;
}

export async function getVendorCountSummary() {
  const snap = await getDocs(query(collection(db, collections.users), where('role', '==', 'vendor')));
  const result = { active: 0, pending: 0, blocked: 0, inactive: 0, total: snap.size };
  snap.forEach((docSnap) => {
    const status = docSnap.data().status;
    if (result[status] !== undefined) result[status] += 1;
  });
  return result;
}

export async function fetchVendors() {
  const q = query(collection(db, collections.users), where('role', '==', 'vendor'));
  const snap = await getDocs(q);
  return snap.docs.map(normalizeDoc).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function createVendorByAdmin(adminProfile, payload) {
  const settings = await getPlatformSettings();
  const desiredStatus = payload.status || 'active';

  if (desiredStatus === 'active') {
    const count = await getActiveVendorCount();
    if (count >= settings.maxActiveVendors) {
      throw new Error(`O limite de ${settings.maxActiveVendors} vendedores ativos foi atingido.`);
    }
  }

  const uid = await createAuthUserWithoutSwitching(payload.email, payload.password);

  await setDoc(doc(db, collections.users, uid), {
    uid,
    name: payload.name,
    email: payload.email,
    phone: payload.phone || '',
    city: payload.city || '',
    role: 'vendor',
    status: desiredStatus,
    createdAt: serverTimestamp(),
    createdByUid: adminProfile.uid,
    createdByName: adminProfile.name || adminProfile.email || 'Administrador',
    approvedAt: desiredStatus === 'active' ? serverTimestamp() : null,
    blockedAt: desiredStatus === 'blocked' ? serverTimestamp() : null,
    inactiveAt: desiredStatus === 'inactive' ? serverTimestamp() : null
  });

  return { uid, email: payload.email, password: payload.password, status: desiredStatus };
}

export async function updateVendorStatus(uid, status) {
  if (status === 'active') {
    const settings = await getPlatformSettings();
    const count = await getActiveVendorCount();
    const profile = await getCurrentUserProfile(uid);
    if (profile?.status !== 'active' && count >= settings.maxActiveVendors) {
      throw new Error(`O limite de ${settings.maxActiveVendors} vendedores ativos foi atingido.`);
    }
  }

  await updateDoc(doc(db, collections.users, uid), {
    status,
    approvedAt: status === 'active' ? serverTimestamp() : null,
    blockedAt: status === 'blocked' ? serverTimestamp() : null,
    inactiveAt: status === 'inactive' ? serverTimestamp() : null
  });
}

export async function updateVendorByAdmin(uid, payload) {
  const desiredStatus = payload.status || 'active';

  if (desiredStatus === 'active') {
    const settings = await getPlatformSettings();
    const count = await getActiveVendorCount();
    const profile = await getCurrentUserProfile(uid);
    if (profile?.status !== 'active' && count >= settings.maxActiveVendors) {
      throw new Error(`O limite de ${settings.maxActiveVendors} vendedores ativos foi atingido.`);
    }
  }

  await updateDoc(doc(db, collections.users, uid), {
    name: payload.name,
    email: payload.email,
    phone: payload.phone || '',
    city: payload.city || '',
    status: desiredStatus,
    approvedAt: desiredStatus === 'active' ? serverTimestamp() : null,
    blockedAt: desiredStatus === 'blocked' ? serverTimestamp() : null,
    inactiveAt: desiredStatus === 'inactive' ? serverTimestamp() : null
  });
}

export async function removeVendor(uid) {
  const batch = writeBatch(db);
  batch.delete(doc(db, collections.users, uid));

  const refsToClean = [
    query(collection(db, collections.clients), where('ownerId', '==', uid)),
    query(collection(db, collections.purchases), where('ownerId', '==', uid)),
    query(collection(db, collections.sales), where('ownerId', '==', uid)),
    query(collection(db, collections.expenses), where('ownerId', '==', uid))
  ];

  for (const q of refsToClean) {
    const snap = await getDocs(q);
    snap.forEach((docSnap) => batch.delete(docSnap.ref));
  }

  await batch.commit();
}

export async function createClient(ownerId, payload) {
  return addDoc(collection(db, collections.clients), {
    ownerId,
    name: payload.name,
    phone: payload.phone || '',
    city: payload.city || '',
    notes: payload.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateClient(ownerId, clientId, payload) {
  const ref = doc(db, collections.clients, clientId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Cliente não encontrado.');
  const data = snap.data() || {};
  if (data.ownerId !== ownerId) throw new Error('Permissão insuficiente para editar este cliente.');

  await updateDoc(ref, {
    name: payload.name,
    phone: payload.phone || '',
    city: payload.city || '',
    notes: payload.notes || '',
    updatedAt: serverTimestamp()
  });
}

export async function deleteClient(ownerId, clientId) {
  const ref = doc(db, collections.clients, clientId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Cliente não encontrado.');
  const data = snap.data() || {};
  if (data.ownerId !== ownerId) throw new Error('Permissão insuficiente para excluir este cliente.');

  const salesSnap = await getDocs(query(collection(db, collections.sales), where('ownerId', '==', ownerId)));
  const linkedSales = salesSnap.docs.some((item) => (item.data() || {}).clientId === clientId);
  if (linkedSales) throw new Error('Este cliente já possui vendas vinculadas e não pode ser excluído.');

  await deleteDoc(ref);
}

export async function fetchClients(ownerId) {
  const q = query(collection(db, collections.clients), where('ownerId', '==', ownerId));
  const snap = await getDocs(q);
  return snap.docs.map(normalizeDoc).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function createPurchase(ownerId, payload) {
  return addDoc(collection(db, collections.purchases), {
    ownerId,
    productName: payload.productName,
    quantity: Number(payload.quantity || 0),
    unitCost: Number(payload.unitCost || 0),
    total: Number(payload.quantity || 0) * Number(payload.unitCost || 0),
    paymentType: payload.paymentType,
    dueDate: payload.dueDate || '',
    date: payload.date,
    status: payload.paymentType === 'prazo' ? 'open' : 'paid',
    notes: payload.notes || '',
    createdAt: serverTimestamp()
  });
}

export async function fetchPurchases(ownerId = null) {
  const base = collection(db, collections.purchases);
  const q = ownerId ? query(base, where('ownerId', '==', ownerId)) : query(base);
  const snap = await getDocs(q);
  return snap.docs.map(normalizeDoc).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

export async function createSale(ownerId, payload) {
  return addDoc(collection(db, collections.sales), {
    ownerId,
    clientId: payload.clientId || '',
    clientName: payload.clientName || 'Cliente avulso',
    productName: payload.productName,
    quantity: Number(payload.quantity || 0),
    unitPrice: Number(payload.unitPrice || 0),
    total: Number(payload.quantity || 0) * Number(payload.unitPrice || 0),
    paymentType: payload.paymentType,
    dueDate: payload.dueDate || '',
    date: payload.date,
    status: payload.paymentType === 'prazo' ? 'open' : 'received',
    notes: payload.notes || '',
    receivedAmount: payload.paymentType === 'prazo' ? 0 : Number(payload.quantity || 0) * Number(payload.unitPrice || 0),
    createdAt: serverTimestamp()
  });
}

export async function fetchSales(ownerId = null) {
  const base = collection(db, collections.sales);
  const q = ownerId ? query(base, where('ownerId', '==', ownerId)) : query(base);
  const snap = await getDocs(q);
  return snap.docs.map(normalizeDoc).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

export async function createExpense(ownerId, payload) {
  return addDoc(collection(db, collections.expenses), {
    ownerId,
    description: payload.description,
    category: payload.category || 'Geral',
    amount: Number(payload.amount || 0),
    dueDate: payload.dueDate || '',
    date: payload.date,
    status: payload.status || 'open',
    notes: payload.notes || '',
    createdAt: serverTimestamp()
  });
}

export async function fetchExpenses(ownerId = null) {
  const base = collection(db, collections.expenses);
  const q = ownerId ? query(base, where('ownerId', '==', ownerId)) : query(base);
  const snap = await getDocs(q);
  return snap.docs.map(normalizeDoc).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

export async function markSaleAsReceived(id) {
  const ref = doc(db, collections.sales, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  await updateDoc(ref, {
    status: 'received',
    receivedAmount: Number(data.total || 0)
  });
}

export async function markExpenseAsPaid(id) {
  return updateDoc(doc(db, collections.expenses, id), { status: 'paid' });
}

export async function markPurchaseAsPaid(id) {
  return updateDoc(doc(db, collections.purchases, id), { status: 'paid' });
}

export async function publishNotice(authorProfile, payload) {
  return addDoc(collection(db, collections.notices), {
    title: payload.title,
    body: payload.body,
    audience: payload.audience || 'vendors',
    pinned: Boolean(payload.pinned),
    createdAt: serverTimestamp(),
    createdByUid: authorProfile.uid,
    createdByName: authorProfile.name || authorProfile.email || 'Admin'
  });
}

export async function fetchNotices() {
  const snap = await getDocs(query(collection(db, collections.notices)));
  return snap.docs.map(normalizeDoc).sort((a, b) => {
    const aPinned = a.pinned ? 1 : 0;
    const bPinned = b.pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const aDate = safeDate(a.createdAt)?.getTime() || 0;
    const bDate = safeDate(b.createdAt)?.getTime() || 0;
    return bDate - aDate;
  });
}

export async function deleteNotice(id) {
  return deleteDoc(doc(db, collections.notices, id));
}

export function computeVendorMetrics({ sales, purchases, expenses }) {
  const start = monthStartDate();
  const monthSales = sales.filter((item) => new Date(item.date) >= start);
  const monthPurchases = purchases.filter((item) => new Date(item.date) >= start);
  const monthExpenses = expenses.filter((item) => new Date(item.date) >= start);

  const salesAmount = monthSales.reduce((acc, item) => acc + toCurrency(item.total), 0);
  const purchasesAmount = monthPurchases.reduce((acc, item) => acc + toCurrency(item.total), 0);
  const expensesAmount = monthExpenses.reduce((acc, item) => acc + toCurrency(item.amount), 0);
  const receivableOpen = sales.filter((item) => item.status !== 'received').reduce((acc, item) => acc + toCurrency(item.total), 0);
  const payableOpen = purchases.filter((item) => item.status !== 'paid').reduce((acc, item) => acc + toCurrency(item.total), 0)
    + expenses.filter((item) => item.status !== 'paid').reduce((acc, item) => acc + toCurrency(item.amount), 0);
  const stockUnits = purchases.reduce((acc, item) => acc + Number(item.quantity || 0), 0)
    - sales.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
  const projectedCash = salesAmount - purchasesAmount - expensesAmount;
  const salesOnCredit = sales.filter((item) => item.paymentType === 'prazo');

  return {
    salesAmount,
    purchasesAmount,
    expensesAmount,
    receivableOpen,
    payableOpen,
    stockUnits,
    projectedCash,
    overdueClients: salesOnCredit.filter((item) => item.status !== 'received').length,
    totalSalesCount: monthSales.length
  };
}


export function buildReceivableClients(sales, clients = []) {
  const clientMap = new Map((clients || []).map((client) => [client.id, client]));
  const groups = new Map();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  sales.filter((item) => item.status !== 'received').forEach((item) => {
    const fallbackName = item.clientName || 'Cliente avulso';
    const key = item.clientId ? `client:${item.clientId}` : `name:${fallbackName.trim().toLowerCase()}`;
    const linkedClient = item.clientId ? clientMap.get(item.clientId) : null;
    const dueDate = safeDate(item.dueDate);
    const saleDate = safeDate(item.date);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        clientId: item.clientId || '',
        clientName: linkedClient?.name || fallbackName,
        phone: linkedClient?.phone || '',
        city: linkedClient?.city || '',
        notes: linkedClient?.notes || '',
        totalOpen: 0,
        pendingSales: 0,
        nextDueDate: null,
        lastSaleDate: null,
        overdueCount: 0
      });
    }

    const target = groups.get(key);
    target.totalOpen += toCurrency(item.total);
    target.pendingSales += 1;

    if (dueDate && !Number.isNaN(dueDate.getTime())) {
      if (!target.nextDueDate || dueDate < target.nextDueDate) target.nextDueDate = dueDate;
      if (dueDate < now) target.overdueCount += 1;
    }

    if (saleDate && !Number.isNaN(saleDate.getTime())) {
      if (!target.lastSaleDate || saleDate > target.lastSaleDate) target.lastSaleDate = saleDate;
    }
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (b.totalOpen !== a.totalOpen) return b.totalOpen - a.totalOpen;
    return (a.clientName || '').localeCompare(b.clientName || '');
  });
}

export function groupSalesByDay(sales) {
  const grouped = new Map();
  sales.forEach((sale) => {
    const label = sale.date || 'Sem data';
    grouped.set(label, (grouped.get(label) || 0) + toCurrency(sale.total));
  });
  return Array.from(grouped.entries())
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .slice(-10);
}

export function buildAdminVendorSummary(vendors, sales, purchases) {
  return vendors.map((vendor) => {
    const vendorSales = sales.filter((item) => item.ownerId === vendor.uid);
    const vendorPurchases = purchases.filter((item) => item.ownerId === vendor.uid);
    const soldValue = vendorSales.reduce((acc, item) => acc + toCurrency(item.total), 0);
    const boughtValue = vendorPurchases.reduce((acc, item) => acc + toCurrency(item.total), 0);
    const openReceivable = vendorSales.filter((item) => item.status !== 'received').reduce((acc, item) => acc + toCurrency(item.total), 0);

    return {
      uid: vendor.uid,
      name: vendor.name || vendor.email,
      status: vendor.status || 'pending',
      soldValue,
      boughtValue,
      openReceivable,
      totalSales: vendorSales.length,
      totalPurchases: vendorPurchases.length
    };
  }).sort((a, b) => b.soldValue - a.soldValue);
}
