// script.js

// 1. 보안 및 설정 관련
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyFOW3H7RP_TOeRd1RvSYlCTRbbaXMi5KDx4anTDSyxmKScbVwcDaMwTok0Oh0J4ZLw/exec";

// --- State ---
let currentView = 'day';
let selectedDate = new Date();
let showWeekDesc = true; 
let showWeekTag = true; 
let weekStartDay = 1; // 1: 월요일 시작, 0: 일요일 시작
let filterTag = null; 
let hiddenTags = new Set(); 
let isHiddenTagsListVisible = false;

// 고정 메모 (View별 독립 저장용)
let pinnedMemos = {}; 

let tasks = [
    { id: 1, text: "신규 기획서 작성", desc: "주요 타겟층 분석 데이터 포함할 것", date: new Date().toDateString(), completed: false, category: "WORK" },
    { id: 2, text: "디자인 시스템 검토", desc: "컬러 팔레트 명암비 웹 접근성 체크 필요", date: new Date().toDateString(), completed: true, category: "PROJECT" }
];

let records = [
    { id: 101, title: "업무 생산성 팁", content: "1. 뽀모도로 기법 활용\n2. 중요한 일은 오전에 배치", hashtags: ["PROD", "WORK"], color: "bg-yellow-100", collapsed: false },
    { id: 102, title: "참고 사이트 리스트", content: "- TailwindCSS Docs\n- Lucide Icons\n- Pinterest", hashtags: ["REF", "DESIGN"], color: "bg-blue-100", collapsed: true }
];

// 기타 UI State
let recordSearchQuery = "";
let draggedRecordId = null;
let editingRecordId = null;
let editingRecordColor = null; 
let selectedRecColor = 'bg-yellow-100';
let selectedRecordIds = new Set();
let recordClipboard = []; 
let editingId = null; 
let taskToCopy = null;
let selectedTaskIds = new Set();
let clipboard = []; 

const holidays = {
    '1-1': '신정', '3-1': '삼일절', '5-5': '어린이날', '6-6': '현충일',
    '8-15': '광복절', '10-3': '개천절', '10-9': '한글날', '12-25': '성탄절'
};

// --- Utilities ---
function isHoliday(date) {
    const key = `${date.getMonth() + 1}-${date.getDate()}`;
    return holidays[key] || false;
}

function getDateColorClass(date) {
    if (!date) return '';
    const day = date.getDay();
    if (day === 0 || isHoliday(date)) return 'holiday-red';
    if (day === 6) return 'saturday-blue';
    return '';
}

function getBgClass(date) {
    if (!date) return '';
    const day = date.getDay();
    if (day === 0 || isHoliday(date)) return 'bg-holiday';
    if (day === 6) return 'bg-saturday';
    return 'bg-white';
}

// 텍스트 영역 높이 자동 조절
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// --- View별 독립 저장 키 생성 함수 ---
function getMemoKey() {
    const d = new Date(selectedDate);
    if (currentView === 'day') {
        return `day_${d.toDateString()}`;
    } else if (currentView === 'week') {
        // 해당 주차의 시작일을 찾아 키로 사용 (동일 주차 공유)
        const dayNum = d.getDay();
        const diff = (weekStartDay === 1) ? (dayNum === 0 ? -6 : 1 - dayNum) : -dayNum;
        d.setDate(d.getDate() + diff);
        return `week_${d.toDateString()}`;
    } else if (currentView === 'month') {
        return `month_${d.getFullYear()}_${d.getMonth()}`;
    }
    return d.toDateString();
}

// --- Google Sheets Sync Logic ---

async function triggerAutoSync() {
    console.log("데이터 변경 감지: 실시간 동기화 시도 중...");
    await syncDataWithSheet();
}

async function syncDataWithSheet() {
    const syncBtn = document.getElementById('sync-btn');
    const syncIcon = document.getElementById('sync-icon');
    
    if (syncIcon) syncIcon.classList.add('animate-spin');
    if (syncBtn) {
        syncBtn.disabled = true;
        const span = syncBtn.querySelector('span');
        if (span) span.innerText = "동기화 중...";
    }

    const payload = {
        type: 'sync_all',
        tasks: tasks,
        records: records,
        pinnedMemos: pinnedMemos 
    };

    try {
        await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain' }, 
            body: JSON.stringify(payload)
        });
        console.log("동기화 요청 성공");
    } catch (error) {
        console.error("Sync Error:", error);
    } finally {
        if (syncIcon) syncIcon.classList.remove('animate-spin');
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> <span>구글 시트 동기화</span>`;
        }
        lucide.createIcons();
    }
}

async function loadDataFromServer() {
    try {
        const response = await fetch(GAS_WEB_APP_URL);
        const data = await response.json();
        
        if (data.tasks) tasks = data.tasks;
        if (data.records) records = data.records;
        if (data.pinnedMemos) pinnedMemos = data.pinnedMemos;
        
        console.log("서버 데이터 로드 완료");
    } catch (error) {
        console.error("데이터 로드 실패:", error);
    } finally {
        render();
    }
}

// --- Initialization ---
async function init() {
    await loadDataFromServer();
}

// --- Core Render Logic ---
function render() {
    updateHeader();
    updateSidebarNav();
    updateHashtagSidebar(); 
    updateProgress();
    updateFilterBadge();
    updateBulkActionBar(); 
    
    const container = document.getElementById('view-container');
    const headerDateNav = document.getElementById('header-date-container');
    
    container.innerHTML = '';

    if (currentView === 'record') {
        if(headerDateNav) headerDateNav.style.display = 'none';
        renderRecordView(container);
    } else {
        if(headerDateNav) headerDateNav.style.display = 'flex';
        const weekOptions = document.getElementById('week-view-options');
        
        // 데일리/위클리 상단 고정 메모
        if (currentView === 'day' || currentView === 'week') {
            container.innerHTML += renderPinnedMemoHTML('top');
        }

        if (currentView === 'week') {
            weekOptions.classList.remove('hidden');
            updateToggleUI();
            renderWeekView(container);
        } else {
            weekOptions.classList.add('hidden');
            if (currentView === 'day') renderDayView(container);
            else if (currentView === 'month') {
                renderMonthView(container);
                // 먼슬리 하단 고정 메모
                container.innerHTML += renderPinnedMemoHTML('bottom');
            }
        }
    }
    
    document.querySelectorAll('.auto-resize-textarea').forEach(autoResize);
    lucide.createIcons();
}

// 고정 메모 HTML 생성
function renderPinnedMemoHTML(position = 'top') {
    const key = getMemoKey();
    const currentMemo = pinnedMemos[key] || '';
    const mtClass = position === 'bottom' ? 'mt-8' : 'mb-6';
    const label = currentView.toUpperCase();
    
    return `
        <div class="pinned-memo-container bg-indigo-600 rounded-3xl p-5 ${mtClass} shadow-lg shadow-indigo-100 relative overflow-hidden transition-all">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <i data-lucide="pin" class="w-4 h-4 text-indigo-200"></i>
                    <span class="text-[11px] font-black text-indigo-100 tracking-widest uppercase">${label} 고정 메모</span>
                </div>
                <span class="text-[9px] text-indigo-300 font-bold opacity-60">자동 크기 조절</span>
            </div>
            <textarea 
                oninput="updatePinnedMemo(this.value); autoResize(this)" 
                placeholder="${label}의 루틴이나 중요한 내용을 입력하세요..." 
                class="auto-resize-textarea w-full bg-transparent border-none text-white placeholder:text-indigo-300 focus:ring-0 outline-none text-sm font-bold resize-none leading-relaxed"
                rows="1"
            >${currentMemo}</textarea>
        </div>`;
}

function updatePinnedMemo(val) { 
    const key = getMemoKey();
    pinnedMemos[key] = val; 
    // 입력할 때마다 실시간 동기화를 하려면 아래 주석 해제 (단, 서버 부하 주의)
    // triggerAutoSync();
}

// --- View Renderer: Day ---
function renderDayView(container) {
    const dayTasksFiltered = tasks.filter(t => t.date === selectedDate.toDateString() && (!filterTag || t.category === filterTag));
    const allSelected = dayTasksFiltered.length > 0 && dayTasksFiltered.every(t => selectedTaskIds.has(t.id));
    
    const dayContent = `
        <div class="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <div class="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden mb-6">
                <div class="p-6 bg-slate-50/30 space-y-3">
                    <div class="flex gap-2">
                        <input id="new-task-input" type="text" placeholder="할 일을 입력하세요..." class="flex-[3] bg-white border border-slate-200 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-sm transition-all shadow-sm">
                        <div class="flex-1 relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 font-bold">#</span>
                            <input id="new-tag-input" type="text" placeholder="태그" class="w-full bg-white border border-slate-200 rounded-2xl pl-8 pr-4 py-3 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-sm transition-all shadow-sm uppercase font-bold text-indigo-600">
                        </div>
                    </div>
                    <textarea id="new-desc-input" placeholder="상세 내용 (선택사항)" rows="2" class="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-sm transition-all shadow-sm resize-none"></textarea>
                    <div class="flex gap-2">
                        <button onclick="addTask()" class="flex-1 bg-indigo-600 text-white py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg font-bold text-sm flex items-center justify-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> 일정 추가</button>
                        ${clipboard.length > 0 ? `<button onclick="pasteTasks()" class="px-6 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-bold text-sm flex items-center gap-2"><i data-lucide="clipboard" class="w-4 h-4"></i> 붙여넣기 (${clipboard.length})</button>` : ''}
                    </div>
                </div>
            </div>
            <div class="flex items-center justify-between px-4 mb-3">
                <div class="flex items-center gap-3">
                    <input type="checkbox" onchange="toggleSelectAll()" ${allSelected ? 'checked' : ''} id="select-all-cb" class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                    <label for="select-all-cb" class="text-xs font-bold text-slate-400 cursor-pointer select-none">전체 선택</label>
                </div>
            </div>
            <div id="task-list" class="space-y-3"></div>
        </div>`;
    
    container.innerHTML += dayContent; 
    const taskList = document.getElementById('task-list');
    
    if (dayTasksFiltered.length === 0) {
        taskList.innerHTML = `<div class="py-20 text-center text-slate-300 font-medium bg-white rounded-3xl border border-dashed border-slate-200">일정이 없습니다.</div>`;
    } else {
        dayTasksFiltered.forEach((task) => {
            const isSelected = selectedTaskIds.has(task.id);
            const item = document.createElement('div');
            item.className = `group bg-white border transition-all hover:shadow-md rounded-2xl p-4 ${isSelected ? 'border-indigo-400 bg-indigo-50/20 ring-1 ring-indigo-400' : 'border-slate-200'}`;
            
            if (editingId === task.id) {
                item.innerHTML = `
                    <div class="flex flex-col gap-3">
                        <div class="flex gap-2">
                            <input id="edit-text-${task.id}" type="text" value="${task.text}" class="flex-[3] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold">
                            <input id="edit-tag-${task.id}" type="text" value="${task.category}" class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm uppercase font-black text-indigo-500">
                        </div>
                        <textarea id="edit-desc-${task.id}" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm resize-none" rows="2">${task.desc || ''}</textarea>
                        <div class="flex justify-end gap-2">
                            <button onclick="cancelEdit()" class="px-4 py-2 text-xs font-bold text-slate-400">취소</button>
                            <button onclick="saveEdit(${task.id})" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md">저장</button>
                        </div>
                    </div>`;
            } else {
                item.innerHTML = `
                    <div class="flex items-start gap-4">
                        <div class="mt-1 flex items-center gap-3">
                            <input type="checkbox" onchange="toggleTaskSelection(${task.id})" ${isSelected ? 'checked' : ''} class="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer">
                        </div>
                        <button onclick="toggleTask(${task.id})" class="mt-1 transition-all hover:scale-110 shrink-0">
                            ${task.completed ? '<i data-lucide="check-circle-2" class="text-indigo-500 w-6 h-6"></i>' : '<i data-lucide="circle" class="text-slate-300 w-6 h-6"></i>'}
                        </button>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <p class="text-[15px] font-bold tracking-tight ${task.completed ? 'line-through text-slate-300' : 'text-slate-700'}">${task.text}</p>
                                <span class="text-[10px] text-indigo-400 font-black shrink-0">#${task.category}</span>
                            </div>
                            ${task.desc ? `<p class="mt-1 text-[13px] text-slate-400 leading-relaxed line-clamp-2">${task.desc}</p>` : ''}
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onclick="openCopyModal(${task.id})" class="p-2 text-slate-300 hover:text-indigo-500 rounded-xl"><i data-lucide="copy" class="w-4 h-4"></i></button>
                            <button onclick="startEdit(${task.id})" class="p-2 text-slate-300 hover:text-indigo-500 rounded-xl"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                            <button onclick="deleteTask(${task.id})" class="p-2 text-slate-300 hover:text-red-500 rounded-xl"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>`;
            }
            taskList.appendChild(item);
        });
    }
    const input = document.getElementById('new-task-input');
    if(input) input.addEventListener('keypress', e => e.key === 'Enter' && addTask());
}

// --- View Renderer: Week ---
function renderWeekView(container) {
    const filtered = getFilteredTasks();
    const weekDays = [];
    const start = new Date(selectedDate);
    const dayNum = start.getDay();
    let diff = (weekStartDay === 1) ? (dayNum === 0 ? -6 : 1 - dayNum) : -dayNum;
    start.setDate(start.getDate() + diff);
    for (let i = 0; i < 7; i++) { 
        const d = new Date(start); 
        d.setDate(d.getDate() + i); 
        weekDays.push(d); 
    }
    
    let weekHtml = `<div class="grid grid-cols-7 gap-1 min-h-[calc(100vh-250px)] bg-slate-200 border-t border-slate-200 rounded-3xl overflow-hidden shadow-inner">`; 
    
    weekDays.forEach((day) => {
        const isToday = day.toDateString() === new Date().toDateString();
        const dayTasks = filtered.filter(t => t.date === day.toDateString());
        const colorClass = getDateColorClass(day);
        const bgClass = getBgClass(day);
        
        weekHtml += `
            <div class="flex flex-col bg-white ${bgClass} min-w-0">
                <div class="text-center py-6 px-4 border-b border-slate-100 sticky top-0 bg-inherit z-10">
                    <p class="text-[10px] font-black uppercase tracking-widest ${colorClass || 'text-slate-400'}">${day.toLocaleDateString('ko-KR', { weekday: 'short' })}</p>
                    <p class="text-xl font-black mt-2 inline-flex items-center justify-center ${isToday ? 'bg-indigo-600 text-white w-10 h-10 rounded-2xl shadow-lg' : colorClass || 'text-slate-800'}">${day.getDate()}</p>
                </div>
                <div class="flex-1 p-2 space-y-2 overflow-y-auto">
                    ${dayTasks.map(t => {
                        return `
                            <div class="group relative bg-white border ${t.completed ? 'opacity-60 border-slate-100' : 'border-slate-200 shadow-sm hover:border-indigo-300'} rounded-xl p-3 transition-all">
                                <div class="flex items-start gap-2 ${(!showWeekTag && !showWeekDesc && !t.desc) ? '' : 'mb-1'}">
                                    <button onclick="toggleTask(${t.id})" class="mt-0.5 shrink-0 transition-transform active:scale-90">
                                        ${t.completed ? '<i data-lucide="check-circle-2" class="text-indigo-500 w-3.5 h-3.5"></i>' : '<i data-lucide="circle" class="text-slate-300 w-3.5 h-3.5"></i>'}
                                    </button>
                                    <p class="text-[12px] font-bold leading-tight break-all ${t.completed ? 'line-through text-slate-400' : 'text-slate-700'}">${t.text}</p>
                                </div>
                                ${ (showWeekTag || t.desc) ? `
                                <div class="flex items-center justify-between mt-1">
                                    ${showWeekTag ? `<p class="text-[9px] text-indigo-400 font-bold uppercase tracking-tighter">#${t.category}</p>` : '<div></div>'}
                                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onclick="startEdit(${t.id})" class="p-1 text-slate-300 hover:text-indigo-500"><i data-lucide="pencil" class="w-3 h-3"></i></button>
                                        <button onclick="deleteTask(${t.id})" class="p-1 text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                                    </div>
                                </div>` : ''}
                                ${(showWeekDesc && t.desc) ? `<p class="mt-1.5 text-[10px] text-slate-400 italic leading-snug border-l-2 border-slate-100 pl-1.5 break-all whitespace-pre-wrap">${t.desc}</p>` : ''}
                            </div>`;
                    }).join('')}
                    <button onclick="changeToDayAndAdd('${day.toDateString()}')" class="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-200 hover:border-indigo-400 hover:text-indigo-400 hover:bg-white transition-all flex justify-center"><i data-lucide="plus" class="w-4 h-4"></i></button>
                </div>
            </div>`;
    });
    weekHtml += `</div>`;
    container.innerHTML += weekHtml;
}

// --- View Renderer: Month ---
function renderMonthView(container) {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    let html = `<div class="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            ${days.map(d => `<div class="py-3 text-center text-[10px] font-black text-slate-400">${d}</div>`).join('')}
        </div>
        <div class="grid grid-cols-7">`;

    for (let i = 0; i < firstDay; i++) {
        html += `<div class="calendar-cell bg-slate-50/50 border-b border-r border-slate-100 last:border-r-0"></div>`;
    }

    for (let d = 1; d <= lastDate; d++) {
        const currentDate = new Date(year, month, d);
        const dateStr = currentDate.toDateString();
        const isToday = dateStr === new Date().toDateString();
        const colorClass = getDateColorClass(currentDate);
        
        const dayTasks = tasks.filter(t => t.date === dateStr && (!filterTag || t.category === filterTag));

        html += `
            <div onclick="changeToDay('${dateStr}')" class="calendar-cell p-2 border-b border-r border-slate-100 last:border-r-0 hover:bg-indigo-50 cursor-pointer transition-colors relative group">
                <div class="text-xs font-bold ${isToday ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md' : colorClass || 'text-slate-700'}">${d}</div>
                ${dayTasks.length > 0 ? `
                    <div class="mt-2 space-y-1">
                        ${dayTasks.slice(0, 3).map(t => `
                            <div class="flex items-center gap-1">
                                <div class="w-1.5 h-1.5 rounded-full ${t.completed ? 'bg-slate-300' : 'bg-indigo-400'}"></div>
                                <span class="text-[9px] truncate ${t.completed ? 'text-slate-300 line-through' : 'text-slate-600 font-medium'}">${t.text}</span>
                            </div>
                        `).join('')}
                        ${dayTasks.length > 3 ? `<div class="text-[9px] text-slate-400 pl-2.5">+${dayTasks.length - 3} more</div>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    const totalCells = firstDay + lastDate;
    const remaining = 7 - (totalCells % 7);
    if (remaining < 7) {
        for (let i = 0; i < remaining; i++) {
            html += `<div class="calendar-cell bg-slate-50/50 border-b border-r border-slate-100 last:border-r-0"></div>`;
        }
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

// --- RECORD View Renderer ---
function renderRecordView(container) {
    const colors = ['bg-yellow-100', 'bg-blue-100', 'bg-green-100', 'bg-pink-100', 'bg-purple-100'];
    
    const filteredRecords = records.filter(rec => {
        const matchesSearch = 
            rec.title.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
            rec.content.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
            rec.hashtags.some(tag => tag.toLowerCase().includes(recordSearchQuery.toLowerCase()));
        
        const matchesFilter = !filterTag || rec.hashtags.includes(filterTag);
        return matchesSearch && matchesFilter;
    });

    const allSelected = filteredRecords.length > 0 && filteredRecords.every(r => selectedRecordIds.has(r.id));

    let html = `
        <div class="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24 px-4 text-left">
            <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg text-white">
                        <i data-lucide="sticky-note" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-2xl font-black text-slate-800 tracking-tighter">RECORD</h3>
                </div>
                <div class="relative w-full md:w-80">
                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                    <input type="text" oninput="handleRecordSearch(this.value)" value="${recordSearchQuery}" placeholder="제목, 내용, 태그 검색..." 
                        class="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-sm">
                </div>
            </div>

            <div class="flex items-center justify-between mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" onchange="toggleSelectAllRecords()" ${allSelected ? 'checked' : ''} id="rec-select-all" class="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer">
                        <label for="rec-select-all" class="text-sm font-bold text-slate-600 cursor-pointer">전체 선택</label>
                    </div>
                    ${selectedRecordIds.size > 0 ? `
                        <span class="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg">${selectedRecordIds.size}개 선택됨</span>
                    ` : ''}
                </div>
                <div class="flex gap-2">
                    ${recordClipboard.length > 0 ? `
                        <button onclick="pasteRecords()" class="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-600 hover:bg-emerald-100 transition-all active:scale-95">
                            <i data-lucide="clipboard" class="w-3.5 h-3.5"></i> 붙여넣기 (${recordClipboard.length})
                        </button>
                    ` : ''}
                    <button onclick="copySelectedRecords()" class="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                        <i data-lucide="copy" class="w-3.5 h-3.5"></i> 선택 복사
                    </button>
                    <button onclick="deleteSelectedRecords()" class="flex items-center gap-2 px-4 py-2 bg-white border border-red-100 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 transition-all">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> 선택 삭제
                    </button>
                </div>
            </div>

            <div class="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 mb-12 transition-all hover:shadow-2xl hover:border-indigo-200">
                <input id="rec-title" type="text" placeholder="메모 제목을 입력하세요..." class="w-full bg-transparent border-none text-xl font-bold focus:ring-0 mb-4 placeholder:text-slate-300" />
                <textarea id="rec-content" placeholder="내용을 입력하세요..." rows="4" class="w-full bg-transparent border-none text-base focus:ring-0 resize-none text-left placeholder:text-slate-300 leading-relaxed"></textarea>
                
                <div class="flex items-center gap-3 mt-4 px-1 group">
                    <div class="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 transition-all group-focus-within:border-indigo-200">
                        <i data-lucide="hash" class="w-4 h-4 text-indigo-400"></i>
                        <input id="rec-tags" type="text" placeholder="태그 (쉼표 구분)" class="bg-transparent border-none text-xs font-bold text-indigo-600 focus:ring-0 outline-none uppercase w-48" />
                    </div>
                </div>

                <div class="flex justify-between items-center mt-6 pt-6 border-t border-slate-100">
                    <div class="flex gap-3">
                        ${colors.map(c => `<button onclick="selectRecordColor(this, '${c}')" class="new-record-color-btn color-dot w-8 h-8 rounded-full ${c} border border-black/5 hover:scale-110 transition-all shadow-sm ${selectedRecColor === c ? 'ring-2 ring-slate-400 ring-offset-2' : ''}"></button>`).join('')}
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="addRecord()" class="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 active:scale-95">메모 등록</button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" id="record-grid">
                ${filteredRecords.map(rec => {
                    const isEditing = editingRecordId === rec.id;
                    const isSelected = selectedRecordIds.has(rec.id);
                    const cardColor = isEditing && editingRecordColor ? editingRecordColor : rec.color;
                    const searchData = (rec.title + ' ' + rec.content + ' ' + rec.hashtags.join(' ')).toLowerCase();
                    
                    return `
                    <div class="record-card group ${cardColor} rounded-3xl p-6 shadow-sm border ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-black/5'} flex flex-col transition-all h-fit ${isEditing ? 'ring-4 ring-indigo-500/30 shadow-2xl scale-105 z-10' : 'hover:shadow-xl hover:-translate-y-1'}"
                         data-id="${rec.id}"
                         data-search="${searchData}"
                         draggable="${!isEditing}" 
                         ondragstart="handleRecDragStart(${rec.id})" 
                         ondragover="handleRecDragOver(event)" 
                         ondrop="handleRecDrop(${rec.id})">
                        
                        ${isEditing ? `
                            <div class="space-y-3">
                                <input id="edit-rec-title-${rec.id}" type="text" value="${rec.title}" class="w-full bg-white/80 border-none rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500">
                                <textarea id="edit-rec-content-${rec.id}" class="w-full bg-white/80 border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 resize-none text-left" rows="5">${rec.content}</textarea>
                                <input id="edit-rec-tags-${rec.id}" type="text" value="${rec.hashtags.join(', ')}" class="w-full bg-white/80 border-none rounded-xl px-3 py-2 text-[10px] font-bold text-indigo-600 uppercase focus:ring-2 focus:ring-indigo-500">
                                
                                <div class="flex gap-2 pt-2 justify-center">
                                    ${colors.map(c => `
                                        <button onclick="setEditRecordColor(${rec.id}, '${c}')" class="w-6 h-6 rounded-full ${c} border border-black/10 ${cardColor === c ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}"></button>
                                    `).join('')}
                                </div>

                                <div class="flex justify-end gap-2 pt-2 border-t border-black/5 mt-2">
                                    <button onclick="cancelEditRecord()" class="px-3 py-1.5 text-xs font-bold text-slate-500">취소</button>
                                    <button onclick="saveEditRecord(${rec.id})" class="bg-indigo-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md">저장</button>
                                </div>
                            </div>
                        ` : `
                            <div class="flex items-start gap-3 mb-4">
                                <input type="checkbox" onchange="toggleRecordSelection(${rec.id})" ${isSelected ? 'checked' : ''} class="mt-1.5 w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer">
                                <div class="flex-1 min-w-0">
                                    <h4 onclick="toggleRecord(${rec.id})" class="font-black text-slate-800 cursor-pointer text-lg tracking-tight truncate">${rec.title}</h4>
                                </div>
                                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onclick="startEditRecord(${rec.id})" class="p-1.5 hover:bg-black/5 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors" title="수정">
                                        <i data-lucide="pencil" class="w-4 h-4"></i>
                                    </button>
                                    <button onclick="copyRecord(${rec.id})" class="p-1.5 hover:bg-black/5 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors" title="복사">
                                        <i data-lucide="copy" class="w-4 h-4"></i>
                                    </button>
                                    <button onclick="deleteRecord(${rec.id})" class="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500 transition-colors" title="삭제">
                                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>

                            ${rec.hashtags.length > 0 ? `
                                <div class="flex flex-wrap gap-1.5 mb-4">
                                    ${rec.hashtags.map(tag => `<span class="bg-white/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-black text-indigo-600 border border-black/5 shadow-sm">#${tag}</span>`).join('')}
                                </div>
                            ` : ''}

                            <div class="${rec.collapsed ? 'hidden' : 'block'} animate-fade-in mb-4">
                                <p class="text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap py-3 border-t border-black/5 text-left font-medium">${rec.content}</p>
                            </div>
                            
                            <div class="flex justify-between items-center mt-auto">
                                <button onclick="toggleRecord(${rec.id})" class="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1">
                                    ${rec.collapsed ? '<i data-lucide="chevron-down" class="w-3.5 h-3.5"></i> Expand' : '<i data-lucide="chevron-up" class="w-3.5 h-3.5"></i> Collapse'}
                                </button>
                                <div class="w-2 h-2 rounded-full bg-black/10 cursor-grab active:cursor-grabbing"></div>
                            </div>
                        `}
                    </div>
                `;}).join('')}
            </div>
            ${filteredRecords.length === 0 ? '<div class="w-full py-40 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-3xl"><i data-lucide="inbox" class="w-12 h-12 mb-4"></i><p class="font-bold">검색 결과가 없거나 기록이 비어있습니다.</p></div>' : ''}
        </div>
    `;
    container.innerHTML = html;
}

// --- Logic Functions (with Sync) ---

async function addTask() {
    const text = document.getElementById('new-task-input').value.trim();
    if (!text) return;
    
    const newTask = { 
        id: Date.now(), 
        text, 
        desc: document.getElementById('new-desc-input').value.trim(), 
        date: selectedDate.toDateString(), 
        completed: false, 
        category: (document.getElementById('new-tag-input').value.trim() || "WORK").toUpperCase() 
    };
    
    tasks.push(newTask);
    render();
    await triggerAutoSync();
}

async function toggleTask(id) { 
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t); 
    render(); 
    await triggerAutoSync();
}

async function deleteTask(id) { 
    if(!confirm("이 일정을 삭제할까요?")) return;
    tasks = tasks.filter(t => t.id !== id); 
    render(); 
    await triggerAutoSync();
}

async function saveEdit(id) {
    const text = document.getElementById(`edit-text-${id}`).value.trim();
    const tag = document.getElementById(`edit-tag-${id}`) ? document.getElementById(`edit-tag-${id}`).value.trim().replace('#','') : null;
    const desc = document.getElementById(`edit-desc-${id}`).value.trim();
    if (!text) return;
    tasks = tasks.map(t => {
        if (t.id === id) {
            return { ...t, text, desc, category: tag ? tag.toUpperCase() : t.category };
        }
        return t;
    });
    editingId = null; 
    render();
    await triggerAutoSync();
}

async function addRecord() {
    const title = document.getElementById('rec-title').value.trim();
    const content = document.getElementById('rec-content').value.trim();
    const tagInput = document.getElementById('rec-tags').value.trim();
    
    if (!title) return alert("제목을 입력해주세요.");

    const hashtags = tagInput ? tagInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== "") : [];
    
    records.unshift({
        id: Date.now(),
        title,
        content,
        hashtags,
        color: selectedRecColor,
        collapsed: false
    });
    
    recordSearchQuery = "";
    render(); 
    await triggerAutoSync();
}

// --- 기타 UI 제어 함수 ---

function setView(v) { currentView = v; editingId = null; render(); }

function changeDate(offset) {
    const newDate = new Date(selectedDate);
    if (currentView === 'day') newDate.setDate(newDate.getDate() + offset);
    else if (currentView === 'week') newDate.setDate(newDate.getDate() + (offset * 7));
    else if (currentView === 'month') newDate.setMonth(newDate.getMonth() + offset);
    selectedDate = newDate; editingId = null; render();
}

function goToday() { selectedDate = new Date(); editingId = null; render(); }

function toggleFilter(tag) { filterTag = (filterTag === tag) ? null : tag; render(); }

function clearFilter() { filterTag = null; render(); }

function selectRecordColor(btn, color) {
    selectedRecColor = color;
    document.querySelectorAll('.new-record-color-btn').forEach(b => {
        b.classList.remove('ring-2', 'ring-slate-400', 'ring-offset-2');
    });
    btn.classList.add('ring-2', 'ring-slate-400', 'ring-offset-2');
}

function handleRecordSearch(val) {
    recordSearchQuery = val.toLowerCase();
    const cards = document.querySelectorAll('.record-card');
    cards.forEach(card => {
        const text = card.dataset.search;
        if (text.includes(recordSearchQuery)) card.style.display = 'flex';
        else card.style.display = 'none';
    });
}

function startEdit(id) { editingId = id; render(); }
function cancelEdit() { editingId = null; render(); }

function toggleRecord(id) {
    records = records.map(r => r.id === id ? { ...r, collapsed: !r.collapsed } : r);
    renderRecordView(document.getElementById('view-container'));
    lucide.createIcons();
}

function updateHeader() {
    const headerDate = document.getElementById('header-date');
    const colorClass = getDateColorClass(selectedDate);
    if(headerDate) {
        headerDate.className = `text-lg font-bold ${colorClass || 'text-slate-800'}`;
        if (currentView === 'month') headerDate.innerText = selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
        else headerDate.innerText = selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
    }
}

function updateSidebarNav() {
    const navIds = ['day', 'week', 'month', 'record'];
    navIds.forEach(id => {
        const btn = document.getElementById(`nav-${id}`);
        if (!btn) return;
        const isActive = (id === currentView);
        btn.className = `w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${isActive ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`;
    });
}

function updateProgress() {
    const todayTasks = tasks.filter(t => t.date === new Date().toDateString());
    const completed = todayTasks.filter(t => t.completed).length;
    const percent = todayTasks.length > 0 ? (completed / todayTasks.length) * 100 : 0;
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');
    if(bar) bar.style.width = `${percent}%`;
    if(text) text.innerText = `${completed}/${todayTasks.length} 완료`;
}

function updateFilterBadge() {
    const badge = document.getElementById('filter-badge');
    const name = document.getElementById('filter-tag-name');
    if (filterTag) { 
        if(badge) badge.classList.remove('hidden'); 
        if(name) name.innerText = `#${filterTag}`; 
    } else { 
        if(badge) badge.classList.add('hidden'); 
    }
}

function updateHashtagSidebar() {
    const activeList = document.getElementById('hashtag-list-active');
    const hiddenList = document.getElementById('hashtag-list-hidden');
    if(!activeList || !hiddenList) return;

    const taskTags = tasks.map(t => t.category);
    const recordTags = records.flatMap(r => r.hashtags);
    const uniqueTags = [...new Set([...taskTags, ...recordTags])].filter(tag => tag && tag.trim() !== '').sort();

    let activeHtml = ''; let hiddenHtml = '';
    uniqueTags.forEach(tag => {
        const isHidden = hiddenTags.has(tag);
        const tagItem = `
            <div class="group flex items-center justify-between px-3 py-1.5 rounded-xl transition-all hover:bg-slate-50 ${filterTag === tag ? 'tag-active' : 'text-slate-500'}">
                <button onclick="toggleFilter('${tag}')" class="flex-1 flex items-center gap-2 text-left overflow-hidden">
                    <span class="font-bold text-indigo-400 text-xs shrink-0">#</span>
                    <span class="text-xs font-bold tracking-tight truncate">${tag}</span>
                </button>
                <button onclick="toggleTagHide('${tag}')" class="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-500 transition-all">
                    <i data-lucide="${isHidden ? 'eye' : 'eye-off'}" class="w-3 h-3"></i>
                </button>
            </div>`;
        if (isHidden) hiddenHtml += tagItem; else activeHtml += tagItem;
    });
    activeList.innerHTML = activeHtml || '<p class="px-3 py-2 text-[11px] text-slate-300 italic">No tags</p>';
    hiddenList.innerHTML = hiddenHtml || '<p class="px-3 py-2 text-[11px] text-slate-200 italic">Empty</p>';
    lucide.createIcons();
}

function getFilteredTasks() {
    if (!filterTag) return tasks;
    return tasks.filter(t => t.category === filterTag);
}

function toggleWeekDesc() { showWeekDesc = !showWeekDesc; render(); }
function toggleWeekTag() { showWeekTag = !showWeekTag; render(); }

function updateToggleUI() {
    const descBtn = document.getElementById('week-desc-btn');
    const tagBtn = document.getElementById('week-tag-btn');
    if(!descBtn || !tagBtn) return;
    if (showWeekDesc) descBtn.classList.add('bg-indigo-50', 'text-indigo-600', 'border-indigo-100');
    else descBtn.classList.remove('bg-indigo-50', 'text-indigo-600', 'border-indigo-100');
    if (showWeekTag) tagBtn.classList.add('bg-indigo-50', 'text-indigo-600', 'border-indigo-100');
    else tagBtn.classList.remove('bg-indigo-50', 'text-indigo-600', 'border-indigo-100');
}

function toggleSelectAll() {
    const visibleTasks = tasks.filter(t => t.date === selectedDate.toDateString() && (!filterTag || t.category === filterTag));
    const allVisibleSelected = visibleTasks.length > 0 && visibleTasks.every(t => selectedTaskIds.has(t.id));
    if (allVisibleSelected) visibleTasks.forEach(t => selectedTaskIds.delete(t.id));
    else visibleTasks.forEach(t => selectedTaskIds.add(t.id));
    render();
}

function updateBulkActionBar() {
    const bar = document.getElementById('bulk-action-bar');
    const count = document.getElementById('selected-count');
    if(!bar) return;
    const size = selectedTaskIds.size;
    if (currentView === 'record' || size === 0) {
        bar.classList.add('translate-y-32');
        bar.classList.remove('translate-y-0');
    } else {
        bar.classList.remove('translate-y-32'); 
        bar.classList.add('translate-y-0'); 
        if(count) count.innerText = size; 
    }
}

function changeToDay(dateString) { selectedDate = new Date(dateString); currentView = 'day'; editingId = null; render(); }
function changeToDayAndAdd(dateString) { changeToDay(dateString); setTimeout(() => document.getElementById('new-task-input').focus(), 100); }

window.onload = init;