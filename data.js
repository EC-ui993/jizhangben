/* ===================================================================
   记账本 — 共享数据层 & 工具函数
   所有页面通过 <script src="data.js"> 引入，数据基于 localStorage 互通
   =================================================================== */

// ==================== 常量 ====================

const KEY_CATEGORIES = 'jzb_categories';   // 分类数据
const KEY_EXPENSES = 'jzb_expenses';       // 支出数据
const KEY_BUDGET = 'jzb_budget';           // 月度预算

// 预设的常用 emoji，用于分类图标选择
const EMOJI_LIST = [
  '🍚','🍜','🍞','☕','🍵','🍔','🍕','🥗',
  '🚌','🚇','🚗','🚲','⛽','🅿️',
  '🛒','👗','👟','💄','🎁','📦',
  '🎮','🎬','🎵','📚','🎯','⚽',
  '🏠','💡','💧','🔌','📱','💻',
  '💊','🏥','🐱','🐶','✂️','📌',
];

// 首次使用时自动生成的默认分类
const DEFAULT_CATEGORIES = [
  { id: 1, name: '午饭', emoji: '🍚' },
  { id: 2, name: '晚饭', emoji: '🍜' },
  { id: 3, name: '交通', emoji: '🚌' },
  { id: 4, name: '购物', emoji: '🛒' },
  { id: 5, name: '娱乐', emoji: '🎮' },
  { id: 6, name: '住房', emoji: '🏠' },
  { id: 7, name: '零食', emoji: '🍿' },
  { id: 8, name: '其他', emoji: '📌' },
];

// ==================== 全局状态（所有页面共享） ====================

let categories = [];        // 所有分类
let expenses = [];          // 所有支出记录
let monthlyBudget = 0;      // 月度预算

// ==================== localStorage 读写 ====================

/** 从 localStorage 读取所有数据 */
function loadData() {
  try {
    categories = JSON.parse(localStorage.getItem(KEY_CATEGORIES));
    expenses   = JSON.parse(localStorage.getItem(KEY_EXPENSES));
    monthlyBudget = parseFloat(localStorage.getItem(KEY_BUDGET)) || 0;
  } catch (e) {
    // 数据损坏时重置
    categories = null;
    expenses = null;
  }

  // 首次使用：用默认分类初始化
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)); // 深拷贝
    saveCategories();
  }
  if (!expenses || !Array.isArray(expenses)) {
    expenses = [];
    saveExpenses();
  }
}

function saveCategories() {
  localStorage.setItem(KEY_CATEGORIES, JSON.stringify(categories));
}

function saveExpenses() {
  localStorage.setItem(KEY_EXPENSES, JSON.stringify(expenses));
}

function saveBudget() {
  localStorage.setItem(KEY_BUDGET, monthlyBudget);
}

// ==================== 工具函数 ====================

/** 生成唯一 ID */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/** 根据 ID 查找分类 */
function findCategory(id) {
  return categories.find(c => c.id == id);
}

// ---- 日期工具 ----

/** 格式化日期为 YYYY-MM-DD 字符串 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 将 YYYY-MM-DD 字符串解析为 Date 对象 */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 获取今天的日期字符串 */
function getTodayStr() {
  return formatDate(new Date());
}

/** 获取某周的周一 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;  // 周日归到当周
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 获取某周的周日 */
function getWeekEnd(date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** 判断日期字符串是否在指定周期内 */
function isDateInPeriod(dateStr, period, anchorDate) {
  const d = parseDate(dateStr);
  const anchor = new Date(anchorDate);

  if (period === 'day') {
    return formatDate(d) === formatDate(anchor);
  } else if (period === 'week') {
    const ws = getWeekStart(anchor);
    const we = getWeekEnd(anchor);
    return d >= ws && d <= we;
  } else if (period === 'month') {
    return d.getFullYear() === anchor.getFullYear()
        && d.getMonth() === anchor.getMonth();
  }
  return false;
}

/** 获取指定周期内的所有支出记录 */
function getExpensesInPeriod(period, anchorDate) {
  return expenses.filter(e => isDateInPeriod(e.date, period, anchorDate));
}

/** 计算一组支出的总金额 */
function calcTotal(expList) {
  return expList.reduce((sum, e) => sum + e.amount, 0);
}

/** 格式化金额为 ¥X.XX */
function formatMoney(amount) {
  return '¥' + amount.toFixed(2);
}

/** HTML 转义，防止 XSS 攻击 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== Toast 提示 ====================

let toastTimer;

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 1800);
}
