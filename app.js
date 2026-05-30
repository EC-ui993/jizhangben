/* ===================================================================
   记账本 — Vue 3 SPA
   所有功能迁移自原 vanilla JS 三页面版本
   =================================================================== */

const { createApp, reactive, ref, computed, watch, onMounted, onUnmounted, nextTick, provide, inject } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

// ==================== 常量 ====================

const KEY_CATEGORIES = 'jzb_categories';
const KEY_EXPENSES = 'jzb_expenses';
const KEY_BUDGET = 'jzb_budget';

const EMOJI_LIST = [
  '🍚','🍜','🍞','☕','🍵','🍔','🍕','🥗',
  '🚌','🚇','🚗','🚲','⛽','🅿️',
  '🛒','👗','👟','💄','🎁','📦',
  '🎮','🎬','🎵','📚','🎯','⚽',
  '🏠','💡','💧','🔌','📱','💻',
  '💊','🏥','🐱','🐶','✂️','📌',
];

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

// ==================== 响应式 Store ====================

const store = reactive({
  categories: [],
  expenses: [],
  monthlyBudget: 0,
});

function loadData() {
  try {
    store.categories = JSON.parse(localStorage.getItem(KEY_CATEGORIES));
    store.expenses   = JSON.parse(localStorage.getItem(KEY_EXPENSES));
    store.monthlyBudget = parseFloat(localStorage.getItem(KEY_BUDGET)) || 0;
  } catch (e) { store.categories = null; store.expenses = null; }
  if (!store.categories || !Array.isArray(store.categories) || store.categories.length === 0) {
    store.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    saveCategories();
  }
  if (!store.expenses || !Array.isArray(store.expenses)) {
    store.expenses = [];
    saveExpenses();
  }
}

function saveCategories() { localStorage.setItem(KEY_CATEGORIES, JSON.stringify(store.categories)); }
function saveExpenses()   { localStorage.setItem(KEY_EXPENSES, JSON.stringify(store.expenses)); }
function saveBudget()     { localStorage.setItem(KEY_BUDGET, store.monthlyBudget); }

function findCategory(id) { return store.categories.find(c => c.id == id); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 7); }

const sortedCategories = computed(() => {
  const others = store.categories.filter(c => c.name === '其他');
  const rest = store.categories.filter(c => c.name !== '其他');
  return [...rest, ...others];
});

function insertCategoryBeforeOthers(cat) {
  const idx = store.categories.findIndex(c => c.name === '其他');
  if (idx >= 0) store.categories.splice(idx, 0, cat);
  else store.categories.push(cat);
  saveCategories();
}

function moveCategory(fromIdx, toIdx) {
  const others = store.categories.filter(c => c.name === '其他');
  const rest = store.categories.filter(c => c.name !== '其他');
  if (fromIdx < 0 || fromIdx >= rest.length || toIdx < 0 || toIdx >= rest.length) return;
  const [moved] = rest.splice(fromIdx, 1);
  rest.splice(toIdx, 0, moved);
  store.categories.length = 0;
  store.categories.push(...rest, ...others);
  saveCategories();
}

function swapExpenseOrder(id1, id2) {
  const i1 = store.expenses.findIndex(e => e.id == id1);
  const i2 = store.expenses.findIndex(e => e.id == id2);
  if (i1 < 0 || i2 < 0) return;
  [store.expenses[i1], store.expenses[i2]] = [store.expenses[i2], store.expenses[i1]];
  saveExpenses();
}

// ==================== 日期工具 ====================

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function parseDate(str) { const [y,m,d]=str.split('-').map(Number); return new Date(y,m-1,d); }
function getTodayStr() { return formatDate(new Date()); }
function getWeekStart(date) {
  const d = new Date(date); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate()+diff); d.setHours(0,0,0,0); return d;
}
function getWeekEnd(date) { const s=getWeekStart(date); const e=new Date(s); e.setDate(e.getDate()+6); e.setHours(23,59,59,999); return e; }
function isDateInPeriod(dateStr, period, anchorDate) {
  const d=parseDate(dateStr), a=new Date(anchorDate);
  if (period==='day') return formatDate(d)===formatDate(a);
  if (period==='week') { const ws=getWeekStart(a),we=getWeekEnd(a); return d>=ws&&d<=we; }
  return d.getFullYear()===a.getFullYear()&&d.getMonth()===a.getMonth();
}
function getExpensesInPeriod(period, anchorDate) { return store.expenses.filter(e=>isDateInPeriod(e.date,period,anchorDate)); }
function calcTotal(list) { return list.reduce((s,e)=>s+e.amount,0); }
function formatMoney(v) { return '¥'+v.toFixed(2); }
function escapeHtml(str) { const d=document.createElement('div'); d.textContent=str; return d.innerHTML; }

// ==================== 全局 Toast ====================

const toastMsg = ref('');
let toastTimer;
function showToast(msg) {
  toastMsg.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = ''; }, 1800);
}

// ==================== 全局弹窗状态 ====================

const modals = reactive({
  expense: { show: false, categoryId: null, expenseId: null },
  category: { show: false, categoryId: null },
});

function openExpenseModal(categoryId) {
  modals.expense.show = true; modals.expense.categoryId = categoryId; modals.expense.expenseId = null;
}
function openEditExpenseModal(expenseId) {
  modals.expense.show = true; modals.expense.expenseId = expenseId; modals.expense.categoryId = null;
}
function closeExpenseModal() { modals.expense.show = false; }
function openCategoryModal(categoryId) {
  modals.category.show = true; modals.category.categoryId = categoryId;
}
function closeCategoryModal() { modals.category.show = false; }

// ==================== 组件：底部导航 ====================

const BottomNav = {
  template: `
    <nav class="bottom-nav">
      <router-link class="nav-tab" to="/record" active-class="active">
        <span class="nav-icon">📝</span><span>记账</span>
      </router-link>
      <router-link class="nav-tab" to="/categories" active-class="active">
        <span class="nav-icon">📂</span><span>项目管理</span>
      </router-link>
      <router-link class="nav-tab" to="/settings" active-class="active">
        <span class="nav-icon">⚙️</span><span>设置</span>
      </router-link>
    </nav>
  `,
};

// ==================== 组件：记账弹窗 ====================

const ExpenseModal = {
  props: ['categoryId', 'expenseId'],
  emits: ['close'],
  setup(props, { emit }) {
    const amount = ref('');
    const date = ref(getTodayStr());
    const note = ref('');
    const isEdit = ref(false);
    const catEmoji = ref('📌');
    const catName = ref('未知');
    const showDelete = ref(false);

    function init() {
      if (props.expenseId) {
        const exp = store.expenses.find(e => e.id == props.expenseId);
        if (exp) {
          isEdit.value = true; showDelete.value = true;
          catEmoji.value = exp.categoryEmoji; catName.value = exp.categoryName;
          amount.value = exp.amount; date.value = exp.date; note.value = exp.note || '';
          return;
        }
      }
      isEdit.value = false; showDelete.value = false;
      const cat = findCategory(props.categoryId);
      catEmoji.value = cat ? cat.emoji : '📌';
      catName.value = cat ? cat.name : '未知';
      amount.value = ''; date.value = getTodayStr(); note.value = '';
    }

    watch(() => props.expenseId, init, { immediate: true });
    watch(() => props.categoryId, init);

    function save() {
      const v = parseFloat(amount.value);
      if (isNaN(v) || v < 0) { showToast('请输入有效的金额'); return; }
      if (!date.value) { showToast('请选择日期'); return; }
      const cat = findCategory(props.expenseId ? store.expenses.find(e=>e.id==props.expenseId)?.categoryId : props.categoryId);
      if (!cat) { showToast('分类不存在'); return; }
      const amt = Math.round(v * 100) / 100;

      if (props.expenseId) {
        const exp = store.expenses.find(e => e.id == props.expenseId);
        if (exp) { exp.categoryId=cat.id; exp.categoryName=cat.name; exp.categoryEmoji=cat.emoji; exp.amount=amt; exp.date=date.value; exp.note=note.value.trim(); }
      } else {
        store.expenses.push({ id:generateId(), categoryId:cat.id, categoryName:cat.name, categoryEmoji:cat.emoji, amount:amt, date:date.value, note:note.value.trim() });
      }
      saveExpenses();
      emit('close');
      showToast(props.expenseId ? '已更新 ✓' : '已记录 ✓');
    }

    function del() {
      if (!props.expenseId || !confirm('确定要删除这条支出记录吗？此操作不可恢复。')) return;
      store.expenses = store.expenses.filter(e => e.id != props.expenseId);
      saveExpenses();
      emit('close');
      showToast('已删除');
    }

    function onOverlayClick(e) { if (e.target === e.currentTarget) emit('close'); }

    return { amount, date, note, isEdit, catEmoji, catName, showDelete, save, del, onOverlayClick };
  },
  template: `
    <div class="modal-overlay" @click="onOverlayClick">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">{{ isEdit ? '编辑支出' : '记录支出' }}</div>
        <div class="modal-field">
          <label>分类</label>
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg);border-radius:8px;">
            <span style="font-size:20px;">{{ catEmoji }}</span>
            <span style="font-weight:500;">{{ catName }}</span>
          </div>
        </div>
        <div class="modal-field">
          <label>金额 (元)</label>
          <input type="number" v-model="amount" placeholder="0.00" step="0.01" min="0" inputmode="decimal" @keydown.enter="save">
        </div>
        <div class="modal-field">
          <label>日期</label>
          <input type="date" v-model="date">
        </div>
        <div class="modal-field">
          <label>备注（选填）</label>
          <input type="text" v-model="note" placeholder="例如：和同事一起吃饭">
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="$emit('close')">取消</button>
          <button class="btn-primary" @click="save">保存</button>
        </div>
        <button class="btn-delete-item" v-if="showDelete" @click="del">🗑 删除这条记录</button>
      </div>
    </div>
  `,
};

// ==================== 组件：分类弹窗 ====================

const CategoryModal = {
  props: ['categoryId'],
  emits: ['close'],
  setup(props, { emit }) {
    const name = ref('');
    const selectedEmoji = ref('📌');

    function init() {
      selectedEmoji.value = '📌';
      if (props.categoryId) {
        const cat = findCategory(props.categoryId);
        if (cat) { name.value = cat.name; selectedEmoji.value = cat.emoji; return; }
      }
      name.value = '';
    }

    watch(() => props.categoryId, init, { immediate: true });

    function pickEmoji(emoji) { selectedEmoji.value = emoji; }

    function save() {
      if (!name.value.trim()) { showToast('请输入分类名称'); return; }
      if (props.categoryId) {
        const cat = findCategory(props.categoryId);
        if (cat) {
          cat.name = name.value.trim(); cat.emoji = selectedEmoji.value;
          store.expenses.forEach(e => { if (e.categoryId == cat.id) { e.categoryName = cat.name; e.categoryEmoji = cat.emoji; } });
          saveExpenses();
        }
      } else {
        insertCategoryBeforeOthers({ id: generateId(), name: name.value.trim(), emoji: selectedEmoji.value });
      }
      emit('close');
      showToast(props.categoryId ? '分类已更新 ✓' : '分类已添加 ✓');
    }

    function onOverlayClick(e) { if (e.target === e.currentTarget) emit('close'); }

    return { name, selectedEmoji, pickEmoji, save, onOverlayClick, EMOJI_LIST };
  },
  template: `
    <div class="modal-overlay" @click="onOverlayClick">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div class="modal-title">{{ categoryId ? '编辑分类' : '添加分类' }}</div>
        <div class="modal-field">
          <label>选择图标</label>
          <div class="emoji-picker">
            <button v-for="e in EMOJI_LIST" :key="e" class="emoji-option" :class="{ selected: selectedEmoji === e }" @click="pickEmoji(e)">{{ e }}</button>
          </div>
        </div>
        <div class="modal-field">
          <label>分类名称</label>
          <input type="text" v-model="name" placeholder="例如：午饭、交通、购物">
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="$emit('close')">取消</button>
          <button class="btn-primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  `,
};

// ==================== 视图：记账页 ====================

const RecordView = {
  setup() {
    const currentPeriod = ref('day');
    const currentDate = ref(new Date());

    const periodTitle = computed(() => {
      if (currentPeriod.value === 'day') {
        const today = getTodayStr(), cur = formatDate(currentDate.value);
        if (cur === today) return '今天';
        const yesterday = formatDate(new Date(Date.now() - 86400000));
        if (cur === yesterday) return '昨天';
        return cur;
      } else if (currentPeriod.value === 'week') {
        const ws = getWeekStart(currentDate.value), we = getWeekEnd(currentDate.value);
        return `${ws.getMonth()+1}月${ws.getDate()}日 - ${we.getMonth()+1}月${we.getDate()}日`;
      }
      return currentDate.value.getFullYear()+'年'+(currentDate.value.getMonth()+1)+'月';
    });

    const isToday = computed(() => currentPeriod.value === 'day' && formatDate(currentDate.value) === getTodayStr());

    const periodExpenses = computed(() => getExpensesInPeriod(currentPeriod.value, currentDate.value));
    const totalAmount = computed(() => calcTotal(periodExpenses.value));
    const isOverBudget = computed(() => store.monthlyBudget > 0 && totalAmount.value > store.monthlyBudget);

    const groupedExpenses = computed(() => {
      const g = {};
      periodExpenses.value.forEach(e => { if (!g[e.date]) g[e.date] = []; g[e.date].push(e); });
      const dates = Object.keys(g).sort((a,b) => b.localeCompare(a));
      return dates.map(d => ({ date: d, items: g[d], total: calcTotal(g[d]), weekDay: ['日','一','二','三','四','五','六'][parseDate(d).getDay()] }));
    });

    function changePeriod(delta) {
      const d = new Date(currentDate.value);
      if (currentPeriod.value === 'day') d.setDate(d.getDate()+delta);
      else if (currentPeriod.value === 'week') d.setDate(d.getDate()+delta*7);
      else d.setMonth(d.getMonth()+delta);
      currentDate.value = d;
    }
    function goToToday() { currentDate.value = new Date(); }
    function setPeriod(p) { currentPeriod.value = p; }

    // 长按箭头自动连跳
    function makeAutoRepeat(el, delta) {
      let repeatTimer = null, startTimer = null;
      function start(e) { e.preventDefault(); changePeriod(delta); startTimer=setTimeout(()=>{repeatTimer=setInterval(()=>changePeriod(delta),150);},400); }
      function stop() { clearTimeout(startTimer); clearInterval(repeatTimer); }
      el.addEventListener('mousedown', start); el.addEventListener('touchstart', start, {passive:false});
      el.addEventListener('mouseup', stop); el.addEventListener('mouseleave', stop);
      el.addEventListener('touchend', stop); el.addEventListener('touchcancel', stop);
    }

    onMounted(() => {
      makeAutoRepeat(document.getElementById('btnPrev'), -1);
      makeAutoRepeat(document.getElementById('btnNext'), 1);
      setupCategoryDrag();
      setupExpenseDrag();
    });

    // 分类网格拖拽
    function setupCategoryDrag() {
      const content = document.getElementById('content');
      if (!content) return;
      const drag = { active:false, fromIdx:-1, toIdx:-1, startX:0, startY:0, timer:null, el:null, items:[] };

      function getItems() { return [...document.querySelectorAll('.category-item[data-cat-index]:not([data-cat-index=""])')]; }
      function getTarget(cx,cy) { let b=drag.fromIdx, d=Infinity; getItems().forEach((it,i)=>{const r=it.getBoundingClientRect();const dst=Math.hypot(cx-(r.left+r.width/2),cy-(r.top+r.height/2));if(dst<d){d=dst;b=i;}});return b; }
      function activate() { drag.active=true; drag.el.classList.add('drag-active'); drag.items=getItems(); if(navigator.vibrate)navigator.vibrate(10); }
      function update(cx,cy){const n=getTarget(cx,cy);if(n!==drag.toIdx){drag.toIdx=n;drag.items.forEach((it,i)=>{it.classList.remove('drag-target');if(i===n&&i!==drag.fromIdx)it.classList.add('drag-target');});}}
      function commit(){if(drag.toIdx>=0&&drag.toIdx!==drag.fromIdx){moveCategory(drag.fromIdx,drag.toIdx);}}
      function deact(){drag.active=false;drag.fromIdx=-1;drag.toIdx=-1;if(drag.el)drag.el.classList.remove('drag-active');drag.el=null;drag.items.forEach(i=>i.classList.remove('drag-target'));drag.items=[];}

      content.addEventListener('touchstart', function(e){
        if(drag.active)return;const it=e.target.closest('.category-item');if(!it||!it.dataset.catIndex||it.dataset.catIndex==='')return;
        drag.fromIdx=parseInt(it.dataset.catIndex);drag.toIdx=drag.fromIdx;drag.startX=e.touches[0].clientX;drag.startY=e.touches[0].clientY;drag.el=it;
        drag.timer=setTimeout(activate,500);
      });
      content.addEventListener('touchmove',function(e){
        if(!drag.timer&&!drag.active)return;const dx=e.touches[0].clientX-drag.startX,dy=e.touches[0].clientY-drag.startY;
        if(!drag.active){if(Math.abs(dx)>15||Math.abs(dy)>15){clearTimeout(drag.timer);drag.timer=null;}return;}
        e.preventDefault();update(e.touches[0].clientX,e.touches[0].clientY);
      },{passive:false});
      content.addEventListener('touchend',function(){clearTimeout(drag.timer);drag.timer=null;if(drag.active){commit();deact();}});
      content.addEventListener('touchcancel',function(){clearTimeout(drag.timer);drag.timer=null;if(drag.active)deact();});
      content.addEventListener('mousedown',function(e){
        if(drag.active)return;const it=e.target.closest('.category-item');if(!it||!it.dataset.catIndex||it.dataset.catIndex==='')return;
        drag.fromIdx=parseInt(it.dataset.catIndex);drag.toIdx=drag.fromIdx;drag.startX=e.clientX;drag.startY=e.clientY;drag.el=it;
        drag.timer=setTimeout(activate,500);
      });
      document.addEventListener('mousemove',function(e){
        if(!drag.timer&&!drag.active)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
        if(!drag.active){if(Math.abs(dx)>15||Math.abs(dy)>15){clearTimeout(drag.timer);drag.timer=null;}return;}
        e.preventDefault();update(e.clientX,e.clientY);
      });
      document.addEventListener('mouseup',function(){clearTimeout(drag.timer);drag.timer=null;if(drag.active){commit();deact();}});
    }

    // 支出明细拖拽
    function setupExpenseDrag() {
      const content = document.getElementById('content');
      if (!content) return;
      const dg = { active:false, fromId:'', toIdx:-1, fromDate:'', startX:0, startY:0, timer:null, el:null, items:[] };

      function getItems() { return [...document.querySelectorAll('.expense-item')]; }
      function activate() { dg.active=true; dg.el.classList.add('drag-active'); dg.items=getItems(); if(navigator.vibrate)navigator.vibrate(10); }
      function update(cy){
        const items=dg.items;let b=-1;
        for(let i=0;i<items.length;i++){const r=items[i].getBoundingClientRect();if(cy<r.top+r.height/2){b=i;break;}}
        if(b<0)b=items.length-1;
        if(b!==dg.toIdx){dg.toIdx=b;items.forEach(it=>it.classList.remove('drag-target'));const t=items[b];if(t&&t.dataset.expenseId!==dg.fromId&&t.dataset.expenseDate===dg.fromDate)t.classList.add('drag-target');}
      }
      function commit(){
        const items=getItems(),t=items[dg.toIdx];
        if(t&&t.dataset.expenseId!==dg.fromId&&t.dataset.expenseDate===dg.fromDate){swapExpenseOrder(dg.fromId,t.dataset.expenseId);}
      }
      function deact(){dg.active=false;dg.fromId='';dg.toIdx=-1;if(dg.el)dg.el.classList.remove('drag-active');dg.el=null;document.querySelectorAll('.expense-item.drag-target').forEach(i=>i.classList.remove('drag-target'));dg.items=[];}

      content.addEventListener('touchstart', function(e){
        const it=e.target.closest('.expense-item');if(!it||e.target.closest('button'))return;
        dg.fromId=it.dataset.expenseId;dg.fromDate=it.dataset.expenseDate;dg.toIdx=-1;dg.startY=e.touches[0].clientY;dg.el=it;
        dg.timer=setTimeout(activate,500);
      });
      content.addEventListener('touchmove',function(e){
        if(!dg.timer&&!dg.active)return;const dy=Math.abs(e.touches[0].clientY-dg.startY);
        if(!dg.active){if(dy>15){clearTimeout(dg.timer);dg.timer=null;}return;}
        e.preventDefault();update(e.touches[0].clientY);
      },{passive:false});
      content.addEventListener('touchend',function(){clearTimeout(dg.timer);dg.timer=null;if(dg.active){commit();deact();}});
      content.addEventListener('touchcancel',function(){clearTimeout(dg.timer);dg.timer=null;if(dg.active)deact();});
      content.addEventListener('mousedown',function(e){
        const it=e.target.closest('.expense-item');if(!it||e.target.closest('button'))return;
        dg.fromId=it.dataset.expenseId;dg.fromDate=it.dataset.expenseDate;dg.toIdx=-1;dg.startY=e.clientY;dg.el=it;
        dg.timer=setTimeout(activate,500);
      });
      document.addEventListener('mousemove',function(e){
        if(!dg.timer&&!dg.active)return;const dy=Math.abs(e.clientY-dg.startY);
        if(!dg.active){if(dy>15){clearTimeout(dg.timer);dg.timer=null;}return;}
        e.preventDefault();update(e.clientY);
      });
      document.addEventListener('mouseup',function(){clearTimeout(dg.timer);dg.timer=null;if(dg.active){commit();deact();}});
    }

    function onRecord(catId) { openExpenseModal(catId); }
    function onEditExpense(expId) { openEditExpenseModal(expId); }
    function onDeleteExpense(expId) { if(confirm('确定要删除这条支出记录吗？')){store.expenses=store.expenses.filter(e=>e.id!=expId);saveExpenses();showToast('已删除');} }

    return { currentPeriod, currentDate, periodTitle, isToday, groupedExpenses, totalAmount, isOverBudget, periodExpenses, sortedCategories, changePeriod, goToToday, setPeriod, onRecord, onEditExpense, onDeleteExpense, formatMoney, escapeHtml };
  },
  template: `
    <header class="header">
      <div class="period-nav">
        <span class="nav-side"><button id="btnPrev" title="上一个周期">◀</button></span>
        <span class="period-title" @click="goToToday">{{ periodTitle }}</span>
        <span class="nav-side nav-side-right">
          <button class="today-btn" @click="goToToday">今天</button>
          <button id="btnNext" title="下一个周期" :style="{ display: isToday ? 'none' : '' }">▶</button>
        </span>
      </div>
      <div class="period-tabs">
        <button class="period-tab" :class="{ active: currentPeriod === 'day' }" @click="setPeriod('day')">📅 日</button>
        <button class="period-tab" :class="{ active: currentPeriod === 'week' }" @click="setPeriod('week')">📊 周</button>
        <button class="period-tab" :class="{ active: currentPeriod === 'month' }" @click="setPeriod('month')">📈 月</button>
      </div>
    </header>

    <div class="summary-bar">
      <div>
        <div class="summary-label">合计支出</div>
        <div class="summary-amount" :class="{ 'over-budget': isOverBudget }">{{ formatMoney(totalAmount) }}</div>
      </div>
      <div class="summary-count">{{ periodExpenses.length }} 笔</div>
    </div>

    <div class="content" id="content">
      <div class="category-section">
        <div class="section-title">💡 点击分类快速记账</div>
        <div class="category-grid">
          <div v-for="(cat, index) in sortedCategories" :key="cat.id"
               class="category-item"
               :data-cat-index="cat.name === '其他' ? '' : index"
               @click="onRecord(cat.id)">
            <span class="category-emoji">{{ cat.emoji }}</span>
            <span class="category-name">{{ cat.name }}</span>
          </div>
        </div>
      </div>

      <div class="expense-section">
        <div class="section-title">📋 支出明细</div>
        <div v-if="groupedExpenses.length === 0" class="empty-state">
          <div class="icon">📭</div>
          <div class="text">这个周期还没有支出记录<br>点击上方分类开始记账吧</div>
        </div>
        <template v-for="group in groupedExpenses" :key="group.date">
          <div class="date-group-header">
            <span>📅 {{ group.date }} 星期{{ group.weekDay }}</span>
            <span class="date-group-total">{{ formatMoney(group.total) }}</span>
          </div>
          <div v-for="exp in group.items" :key="exp.id"
               class="expense-item"
               :data-expense-date="exp.date"
               :data-expense-id="exp.id"
               @click="onEditExpense(exp.id)">
            <div class="expense-icon">{{ exp.categoryEmoji }}</div>
            <div class="expense-info">
              <div class="expense-category">{{ exp.categoryName }}</div>
              <div class="expense-note" v-if="exp.note" v-text="exp.note"></div>
            </div>
            <span class="expense-amount">{{ formatMoney(exp.amount) }}</span>
            <button class="expense-delete" @click.stop="onDeleteExpense(exp.id)" title="删除">×</button>
          </div>
        </template>
      </div>
    </div>
  `,
};

// ==================== 视图：项目管理 ====================

const CategoriesView = {
  setup() {
    function onEdit(id) { openCategoryModal(id); }
    function onDelete(id) {
      const cat = findCategory(id); if (!cat) return;
      const count = store.expenses.filter(e => e.categoryId == id).length;
      let msg = `确定要删除「${cat.emoji} ${cat.name}」分类吗？`;
      if (count > 0) msg += `\n\n该分类下有 ${count} 条支出记录，删除后这些记录仍会保留。`;
      if (!confirm(msg)) return;
      store.categories = store.categories.filter(c => c.id != id);
      saveCategories();
      showToast('分类已删除');
    }
    function onAdd() { openCategoryModal(null); }
    function catCount(id) { return store.expenses.filter(e => e.categoryId == id).length; }

    onMounted(() => setupListDrag());

    function setupListDrag() {
      const content = document.getElementById('content');
      if (!content) return;
      const drag = { active:false, fromIdx:-1, toIdx:-1, startX:0, startY:0, timer:null, el:null, cards:[] };

      function getCards() { return [...document.querySelectorAll('.category-card[data-cat-index]:not([data-cat-index=""])')]; }
      function getTarget(cy){const cards=getCards();for(let i=0;i<cards.length;i++){const r=cards[i].getBoundingClientRect();if(cy<r.top+r.height/2)return i;}return cards.length-1;}
      function activate(){drag.active=true;drag.el.classList.add('drag-active');drag.cards=getCards();if(navigator.vibrate)navigator.vibrate(10);}
      function update(cy){const n=getTarget(cy);if(n!==drag.toIdx){drag.toIdx=n;drag.cards.forEach((c,i)=>{c.classList.remove('drag-target');if(i===n&&i!==drag.fromIdx)c.classList.add('drag-target');});}}
      function commit(){if(drag.toIdx>=0&&drag.toIdx!==drag.fromIdx){moveCategory(drag.fromIdx,drag.toIdx);}}
      function deact(){drag.active=false;drag.fromIdx=-1;drag.toIdx=-1;if(drag.el)drag.el.classList.remove('drag-active');drag.el=null;drag.cards.forEach(c=>c.classList.remove('drag-target'));drag.cards=[];}

      content.addEventListener('touchstart',function(e){
        if(drag.active)return;const card=e.target.closest('.category-card');if(!card||!card.dataset.catIndex||card.dataset.catIndex==='')return;if(e.target.closest('button'))return;
        drag.fromIdx=parseInt(card.dataset.catIndex);drag.toIdx=drag.fromIdx;drag.startY=e.touches[0].clientY;drag.el=card;drag.timer=setTimeout(activate,500);
      });
      content.addEventListener('touchmove',function(e){
        if(!drag.timer&&!drag.active)return;const dy=Math.abs(e.touches[0].clientY-drag.startY);
        if(!drag.active){if(dy>15){clearTimeout(drag.timer);drag.timer=null;}return;}
        e.preventDefault();update(e.touches[0].clientY);
      },{passive:false});
      content.addEventListener('touchend',function(){clearTimeout(drag.timer);drag.timer=null;if(drag.active){commit();deact();}});
      content.addEventListener('touchcancel',function(){clearTimeout(drag.timer);drag.timer=null;if(drag.active)deact();});
      content.addEventListener('mousedown',function(e){
        if(drag.active)return;const card=e.target.closest('.category-card');if(!card||!card.dataset.catIndex||card.dataset.catIndex==='')return;if(e.target.closest('button'))return;
        drag.fromIdx=parseInt(card.dataset.catIndex);drag.toIdx=drag.fromIdx;drag.startY=e.clientY;drag.el=card;drag.timer=setTimeout(activate,500);
      });
      document.addEventListener('mousemove',function(e){
        if(!drag.timer&&!drag.active)return;const dy=Math.abs(e.clientY-drag.startY);
        if(!drag.active){if(dy>15){clearTimeout(drag.timer);drag.timer=null;}return;}
        e.preventDefault();update(e.clientY);
      });
      document.addEventListener('mouseup',function(){clearTimeout(drag.timer);drag.timer=null;if(drag.active){commit();deact();}});
    }

    return { sortedCategories, onEdit, onDelete, onAdd, catCount };
  },
  template: `
    <div class="content" id="content">
      <div class="category-list">
        <div class="section-title">📂 管理支出分类</div>
        <div v-if="sortedCategories.length === 0" class="empty-state">
          <div class="icon">📭</div><div class="text">还没有分类，点击下方按钮添加</div>
        </div>
        <div v-for="(cat, index) in sortedCategories" :key="cat.id"
             class="category-card"
             :data-cat-index="cat.name === '其他' ? '' : index"
             :data-category-id="cat.id">
          <span class="cat-emoji">{{ cat.emoji }}</span>
          <div class="cat-info">
            <div class="cat-name">{{ cat.name }}</div>
            <div class="cat-count">{{ catCount(cat.id) }} 条记录</div>
          </div>
          <div class="cat-actions">
            <button class="btn-icon" @click="onEdit(cat.id)" title="编辑">✏️</button>
            <button class="btn-icon danger" @click="onDelete(cat.id)" title="删除">🗑</button>
          </div>
        </div>
        <button class="btn-add" @click="onAdd">＋ 添加新分类</button>
      </div>
    </div>
  `,
};

// ==================== 视图：设置页 ====================

const SettingsView = {
  setup() {
    const budgetInput = ref(store.monthlyBudget || '');

    const totalAll = computed(() => calcTotal(store.expenses));
    const thisMonth = computed(() => store.expenses.filter(e => isDateInPeriod(e.date, 'month', new Date())));
    const monthTotal = computed(() => calcTotal(thisMonth.value));
    const isOver = computed(() => store.monthlyBudget > 0 && monthTotal.value > store.monthlyBudget);

    function onBudgetChange() {
      store.monthlyBudget = parseFloat(budgetInput.value) || 0;
      saveBudget();
      showToast('月度预算已更新');
    }

    function exportData() {
      const data = { exportTime: new Date().toLocaleString(), categories: store.categories, expenses: store.expenses, budget: store.monthlyBudget };
      const text = JSON.stringify(data, null, 2);
      navigator.clipboard.writeText(text).then(() => showToast('数据已复制到剪贴板 📋')).catch(() => {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        showToast('数据已复制到剪贴板 📋');
      });
    }

    function clearAll() {
      if (!confirm('⚠️ 确定要清除所有数据吗？\n\n这将删除所有支出记录和自定义分类，恢复为默认状态。\n\n此操作不可恢复！')) return;
      if (!confirm('再次确认：真的要清除所有数据吗？')) return;
      localStorage.removeItem(KEY_CATEGORIES); localStorage.removeItem(KEY_EXPENSES);
      store.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      store.expenses = [];
      saveCategories(); saveExpenses();
      showToast('所有数据已清除');
    }

    return { budgetInput, totalAll, monthTotal, isOver, store, onBudgetChange, exportData, clearAll, formatMoney };
  },
  template: `
    <div class="content">
      <div class="settings-section">
        <div class="setting-card">
          <label>💰 月度预算（元）</label>
          <input type="number" v-model="budgetInput" placeholder="例如：2000" step="0.01" min="0" @change="onBudgetChange">
          <div style="margin-top:8px;font-size:12px;color:var(--text-muted);">
            本月已支出 <strong :style="{ color: isOver ? 'var(--danger)' : 'var(--text)' }">{{ formatMoney(monthTotal) }}</strong>
            <template v-if="store.monthlyBudget > 0"> / 预算 {{ formatMoney(store.monthlyBudget) }}</template>
            <template v-if="isOver"> ⚠️ 已超预算！</template>
          </div>
        </div>

        <div class="setting-card">
          <label>📊 数据统计</label>
          <div style="font-size:14px;line-height:2;">
            <div>总支出记录：<strong>{{ store.expenses.length }}</strong> 笔</div>
            <div>累计支出：<strong>{{ formatMoney(totalAll) }}</strong></div>
            <div>支出分类：<strong>{{ store.categories.length }}</strong> 个</div>
            <div>本月支出：<strong>{{ formatMoney(monthTotal) }}</strong></div>
          </div>
        </div>

        <div class="setting-card">
          <label>🛠️ 数据管理</label>
          <button class="btn-secondary" @click="exportData">📋 复制数据到剪贴板</button>
          <button class="btn-danger" style="margin-top:10px;" @click="clearAll">⚠️ 清除所有数据</button>
        </div>

        <div class="about-text">
          💰 记账本 v2.0<br>
          一个简单实用的个人记账工具<br>
          数据保存在浏览器本地，安全可靠<br>
          基于 Vue 3 重构
        </div>
      </div>
    </div>
  `,
};

// ==================== 路由 ====================

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/record' },
    { path: '/record', component: RecordView },
    { path: '/categories', component: CategoriesView },
    { path: '/settings', component: SettingsView },
  ],
});

// ==================== 启动 ====================

const app = createApp({
  setup() {
    loadData();
    return { modals, toastMsg, closeExpenseModal, closeCategoryModal };
  },
  template: `
    <div class="app-container">
      <router-view></router-view>
      <bottom-nav></bottom-nav>
    </div>
    <expense-modal v-if="modals.expense.show" :category-id="modals.expense.categoryId" :expense-id="modals.expense.expenseId" @close="closeExpenseModal"></expense-modal>
    <category-modal v-if="modals.category.show" :category-id="modals.category.categoryId" @close="closeCategoryModal"></category-modal>
    <div class="toast" :class="{ show: toastMsg }" v-text="toastMsg"></div>
  `,
});

app.component('BottomNav', BottomNav);
app.component('ExpenseModal', ExpenseModal);
app.component('CategoryModal', CategoryModal);

app.use(router);
app.mount('#app');

console.log('💰 记账本 v2.0 (Vue 3) 已就绪！');
