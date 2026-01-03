// script.js

// 1. 보안 및 설정 관련
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzAGmh0OFpCpSDTriwngEXxGW_52C4Rb7fpaXeg3-kjo4zziNSCPFpqZ3vlDv5gyswp/exec";

// --- State ---
let currentView = 'day';
let selectedDate = new Date();
let showWeekDesc = true; 
let showWeekTag = true; 
let weekStartDay = 1; // 1: 월요일 시작, 0: 일요일 시작
let filterTag = null; 
let hiddenTags = new Set(); 
let isHiddenTagsListVisible = false;
let editingTaskColor = 'bg-white'; // 수정 중인 업무 배경색
let editingTagStyle = 'text-indigo-600 bg-indigo-100'; // 수정 중인 태그 색상

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


// --- 일정 및 태그 색상 설정 ---
let selectedTaskColor = 'bg-white'; // 현재 선택된 입력 색상
const taskColors = [
    { name: '기본', class: 'bg-white' },
    { name: '중요(레드)', class: 'bg-red-50' },
    { name: '주의(옐로우)', class: 'bg-yellow-50' },
    { name: '참고(블루)', class: 'bg-blue-50' },
    { name: '성공(그린)', class: 'bg-green-50' }
];


// --- [수정] 태그 상태 관리 변수 ---
let frequentTags = ["WORK", "PROJECT", "STUDY"]; // 여기에 적힌 태그들이 입력창 상단에 버튼으로 고정됩니다.
let tagColorMap = {
    "WORK": "text-blue-600 bg-blue-100",
    "PROJECT": "text-purple-600 bg-purple-100",
    "STUDY": "text-emerald-600 bg-emerald-100"
};
let selectedNewTagColor = "text-indigo-600 bg-indigo-100"; // 기본 태그 색상

const tagColorOptions = [
    { name: 'Blue', class: 'text-blue-600 bg-blue-100' },
    { name: 'Purple', class: 'text-purple-600 bg-purple-100' },
    { name: 'Red', class: 'text-red-600 bg-red-100' },
    { name: 'Green', class: 'text-emerald-600 bg-emerald-100' },
    { name: 'Orange', class: 'text-orange-600 bg-orange-100' },
    { name: 'Pink', class: 'text-pink-600 bg-pink-100' }
];

// --- [태그 전용 색상 옵션] ---
const tagStyles = [
    { name: 'Indigo', class: 'text-indigo-600 bg-indigo-100' },
    { name: 'Red', class: 'text-red-600 bg-red-100' },
    { name: 'Blue', class: 'text-blue-600 bg-blue-100' },
    { name: 'Green', class: 'text-emerald-600 bg-emerald-100' },
    { name: 'Orange', class: 'text-orange-600 bg-orange-100' },
    { name: 'Pink', class: 'text-pink-600 bg-pink-100' }
];
// script.js 상단
let selectedNewTagStyle = 'text-indigo-600 bg-indigo-100'; // 이 이름으로 통일

// --- Utilities ---
// 설정창 열 때 태그 목록 그리기
function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
    renderTagSettings();
    updateToggleUI(); // 기존 설정 유지용
}

function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
    render(); // 메인 화면 갱신 (드롭다운 등)
}

function renderTagSettings() {
    const list = document.getElementById('custom-tag-list');
    const picker = document.getElementById('tag-color-picker');
    
    if (!picker || !list) return;

    // c => 로 시작했으므로 내부도 c.class를 사용합니다.
    picker.innerHTML = tagColorOptions.map(c => `
        <button onclick="selectTagStyle('${c.class}', this)" 
        class="tag-style-dot w-6 h-6 rounded-full ${c.class.split(' ')[1]} border-2 ${selectedNewTagStyle === c.class ? 'ring-2 ring-slate-400 ring-offset-1' : 'border-transparent'} transition-all"></button>
    `).join(''); // 마지막에 있던 불필요한 '}'를 제거했습니다.

    list.innerHTML = frequentTags.map(tag => `
        <div class="flex items-center gap-1 px-2 py-1 rounded-lg ${tagColorMap[tag] || 'bg-slate-100'} text-[10px] font-bold">
            #${tag}
            <button onclick="removeCustomTag('${tag}')" class="hover:text-red-500"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>
    `).join('');
    lucide.createIcons();
}

async function addCustomTag() {
    const input = document.getElementById('custom-tag-name');
    const name = input.value.trim().toUpperCase();
    if (!name) return alert("태그 이름을 입력하세요.");
    if (frequentTags.includes(name)) return alert("이미 존재하는 태그입니다.");

    frequentTags.push(name);
    tagColorMap[name] = selectedNewTagColor;
    input.value = '';
    renderTagSettings();
    await syncDataWithSheet(); // 즉시 동기화
}

async function removeCustomTag(tag) {
    if (!confirm(`'#${tag}' 태그를 삭제할까요?`)) return;
    frequentTags = frequentTags.filter(t => t !== tag);
    delete tagColorMap[tag];
    renderTagSettings();
    await syncDataWithSheet();
}

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
        pinnedMemos: pinnedMemos,
        tagColorMap: tagColorMap // 태그 정보 추가 전송
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
        if (data.tagSettings) {
            frequentTags = data.tagSettings.frequentTags;
            tagColorMap = data.tagSettings.tagColorMap;
        }

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
// script.js 내 render 함수 수정
function render() {
    updateHeader();
    updateSidebarNav();
    updateHashtagSidebar(); 
    updateProgress();
    updateFilterBadge();
    updateBulkActionBar(); 
    
    const container = document.getElementById('view-container');
    const headerDateNav = document.getElementById('header-date-container');
    const actionGroup = document.getElementById('header-action-group');
    const weekOptions = document.getElementById('week-view-options');
    
    container.innerHTML = '';

    // 데일리나 위클리일 때만 헤더 액션 그룹(전체선택/복사 등) 표시
    if (currentView === 'day' || currentView === 'week') {
        actionGroup?.classList.remove('hidden');
    } else {
        actionGroup?.classList.add('hidden');
    }

    if (currentView === 'record') {
        if(headerDateNav) headerDateNav.style.display = 'none';
        renderRecordView(container);
    } else {
        if(headerDateNav) headerDateNav.style.display = 'flex';
        
        if (currentView === 'day' || currentView === 'week') {
            container.innerHTML += renderPinnedMemoHTML('top');
        }

        if (currentView === 'week') {
            weekOptions?.classList.remove('hidden'); // 위클리 옵션 표시
            updateToggleUI();
            renderWeekView(container);
        } else {
            weekOptions?.classList.add('hidden');
            if (currentView === 'day') renderDayView(container);
            else if (currentView === 'month') {
                renderMonthView(container);
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
                onblur="updatePinnedMemo(this.value)" 
                oninput="autoResize(this)" 
                placeholder="${label}의 루틴이나 중요한 내용을 입력하세요..." 
                class="auto-resize-textarea w-full bg-transparent border-none text-white placeholder:text-indigo-300 focus:ring-0 outline-none text-sm font-bold resize-none leading-relaxed"
                rows="1"
            >${currentMemo}</textarea>
        </div>`;
}

function updatePinnedMemo(val) { 
    const key = getMemoKey();
    pinnedMemos[key] = val; 
    triggerAutoSync(); // 이제 입력할 때마다 구글 시트에 자동 저장됩니다.
}

function renderDayView(container) {
    // 1. 현재 날짜의 할 일 필터링 및 전체 선택 여부 계산
    const dayTasksFiltered = tasks.filter(t => t.date === selectedDate.toDateString() && (!filterTag || t.category === filterTag));
    const isAllSelected = dayTasksFiltered.length > 0 && dayTasksFiltered.every(t => selectedTaskIds.has(t.id));
    
    // 2. 전체 UI 구조를 하나의 변수에 담기
    const dayContent = `
        <div class="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <div class="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden mb-6">
                <div class="p-6 bg-slate-50/30 space-y-4">
                    <input id="new-task-input" type="text" placeholder="할 일을 입력하세요..." class="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-sm shadow-sm font-bold">
                    
                    <div class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div class="flex gap-2">
                            <div class="flex-1 relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 font-black">#</span>
                                <input id="new-tag-input" type="text" placeholder="새 태그 입력" class="w-full bg-slate-50 border-none rounded-xl pl-8 pr-4 py-2 text-xs font-bold text-indigo-600 uppercase outline-none focus:ring-2 focus:ring-indigo-100">
                            </div>
                            <button onclick="pinCurrentTag()" class="px-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-indigo-700 transition-all">목록에 고정/수정</button>
                        </div>
                        
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] font-black text-slate-400 uppercase">태그 색상:</span>
                            <div class="flex gap-1.5">
                                ${tagColorOptions.map(s => `
                                    <button onclick="selectTagStyle('${s.class}', this)" 
                                        class="tag-style-dot w-4 h-4 rounded-full ${s.class.split(' ')[1]} border-2 ${selectedNewTagStyle === s.class ? 'ring-2 ring-slate-400 ring-offset-1' : 'border-transparent'} transition-all"></button>
                                `).join('')}
                            </div>
                        </div>

                        <div class="flex flex-wrap gap-1.5 pt-2 border-t border-slate-50">
                            ${frequentTags.map(tag => `
                                <div class="group relative flex items-center">
                                    <button onclick="document.getElementById('new-tag-input').value='${tag}'" class="pl-2.5 pr-6 py-1 rounded-lg text-[10px] font-bold transition-all ${tagColorMap[tag] || 'bg-slate-100 text-slate-600'}">
                                        #${tag}
                                    </button>
                                    <button onclick="removeFrequentTag('${tag}')" class="absolute right-1 p-0.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                        <i data-lucide="x" class="w-3 h-3"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <textarea id="new-desc-input" oninput="autoResize(this)" placeholder="상세 내용" rows="1" class="auto-resize-textarea w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-sm shadow-sm resize-none"></textarea>
                    
                    <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div class="flex gap-2 items-center">
                            <span class="text-[9px] font-black text-slate-400 uppercase mr-1">업무 강조:</span>
                            ${taskColors.map(c => `<button onclick="selectedTaskColor='${c.class}'; document.querySelectorAll('.task-color-dot').forEach(d=>d.classList.remove('ring-2')); event.target.classList.add('ring-2','ring-slate-400')" class="task-color-dot w-5 h-5 rounded-full ${c.class} border border-slate-200 transition-all"></button>`).join('')}
                        </div>
                        <button onclick="addTask()" class="bg-indigo-600 text-white px-8 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg font-bold text-sm">일정 등록</button>
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-between mb-3 px-2">
                <div class="flex items-center gap-2 cursor-pointer" onclick="toggleSelectAll()">
                    <input type="checkbox" ${isAllSelected ? 'checked' : ''} class="w-4 h-4 rounded border-slate-300 text-indigo-600 pointer-events-none">
                    <span class="text-xs font-bold text-slate-500">전체 선택</span>
                </div>
            </div>

            <div id="task-list" class="space-y-3"></div>
        </div>`;
    
    // 3. 한 번에 container에 삽입
    container.innerHTML += dayContent; 
    
    // 4. 할 일 아이템 렌더링 및 아이콘 생성
    renderTaskList(dayTasksFiltered);
    lucide.createIcons();
}

function renderTaskList(dayTasks) {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    dayTasks.forEach((task) => {
        const isSelected = selectedTaskIds.has(task.id);
        const item = document.createElement('div');
        
        // 드래그 기능 및 스타일
        item.draggable = editingId !== task.id;
        item.ondragstart = (e) => handleTaskDragStart(e, task.id);
        item.ondragover = (e) => handleTaskDragOver(e);
        item.ondrop = (e) => handleTaskDrop(e, task.id);
        item.className = `group border transition-all hover:shadow-md rounded-2xl ${isSelected ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-slate-200'} ${!task.desc ? 'p-3' : 'p-4'} ${task.color || 'bg-white'}`;
        
        if (editingId === task.id) {
            // [수정 모드 UI]
            item.innerHTML = `
                <div class="flex flex-col gap-3">
                    <input id="edit-text-${task.id}" type="text" value="${task.text}" class="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none">
                    
                    <div class="bg-white/50 p-3 rounded-xl border border-slate-100 space-y-2">
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 font-black">#</span>
                            <input id="edit-tag-${task.id}" type="text" value="${task.category}" class="w-full bg-white border-none rounded-lg pl-6 pr-3 py-1.5 text-xs font-bold text-indigo-600 uppercase outline-none">
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] font-black text-slate-400 uppercase">태그 색상:</span>
                            <div class="flex gap-1">
                                ${tagColorOptions.map(s => `
                                    <button onclick="editingTagStyle='${s.class}'; render()" 
                                        class="w-3.5 h-3.5 rounded-full ${s.class.split(' ')[1]} border ${editingTagStyle === s.class ? 'ring-2 ring-slate-400' : ''}"></button>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <textarea id="edit-desc-${task.id}" oninput="autoResize(this)" class="auto-resize-textarea w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-2 text-sm resize-none outline-none" rows="1">${task.desc || ''}</textarea>
                    
                    <div class="flex justify-between items-center pt-2 border-t border-black/5">
                        <div class="flex gap-1.5 items-center">
                            <span class="text-[9px] font-black text-slate-400 uppercase mr-1">업무 강조:</span>
                            ${taskColors.map(c => `
                                <button onclick="editingTaskColor='${c.class}'; render()" 
                                    class="w-4 h-4 rounded-full ${c.class} border ${editingTaskColor === c.class ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}"></button>
                            `).join('')}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="cancelEdit()" class="px-4 py-1 text-xs font-bold text-slate-400">취소</button>
                            <button onclick="saveEdit(${task.id})" class="bg-indigo-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md">저장</button>
                        </div>
                    </div>
                </div>`;
        } else {
            // [일반 모드 UI]
            item.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="mt-1 text-slate-300 group-hover:text-slate-400 cursor-grab"><i data-lucide="grip-vertical" class="w-4 h-4"></i></div>
                    <button onclick="toggleTask(${task.id})" class="mt-1 shrink-0">
                        ${task.completed ? '<i data-lucide="check-circle-2" class="text-indigo-500 w-6 h-6"></i>' : '<i data-lucide="circle" class="text-slate-300 w-6 h-6"></i>'}
                    </button>
                    <input type="checkbox" onchange="toggleTaskSelection(${task.id})" ${isSelected ? 'checked' : ''} class="...">
                    <div class="flex-1 min-w-0 text-left">
                        <div class="flex items-center gap-2">
                            <p class="text-[15px] font-bold ${task.completed ? 'line-through text-slate-300' : 'text-slate-700'}">${task.text}</p>
                            <span class="text-[10px] font-black px-2 py-0.5 rounded-md ${getTagStyle(task.category)}">#${task.category}</span>
                        </div>
                        ${task.desc ? `<p class="mt-1 text-[13px] text-slate-400 whitespace-pre-wrap leading-relaxed">${task.desc}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onclick="startEdit(${task.id})" class="p-2 text-slate-300 hover:text-indigo-500"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                        <button onclick="deleteTask(${task.id})" class="p-2 text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>`;
        }
        taskList.appendChild(item);
    });
}

// 태그 스타일 함수 (이것도 꼭 있어야 합니다)
function getTagStyle(tag) {
    return tagColorMap[tag.toUpperCase()] || "text-indigo-400 bg-indigo-50"; 
}


/// --- View Renderer: Week (순서 변경 및 드래그 앤 드롭 추가 버전) ---
function renderWeekView(container) {
    const filtered = getFilteredTasks();
    const weekDays = [];
    const start = new Date(selectedDate);
    const dayNum = start.getDay();
    let diff = (weekStartDay === 1) ? (dayNum === 0 ? -6 : 1 - dayNum) : -dayNum;
    start.setDate(start.getDate() + diff);
    for (let i = 0; i < 7; i++) { 
        const d = new Date(start); d.setDate(d.getDate() + i); weekDays.push(d); 
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
                        const isSelected = selectedTaskIds.has(t.id);
                        const isCompact = !showWeekTag && (!showWeekDesc || !t.desc);
                        
                        return `
                            <div class="group relative border ${t.completed ? 'opacity-60 border-slate-100' : 'border-slate-200 shadow-sm hover:border-indigo-300'} rounded-xl transition-all cursor-grab active:cursor-grabbing ${isSelected ? 'border-indigo-400 ring-1 ring-indigo-400' : ''} 
                                ${isCompact ? 'p-2' : 'p-3'} ${t.color || 'bg-white'}"
                                draggable="true"
                                ondragstart="handleTaskDragStart(event, ${t.id})"
                                ondragover="handleTaskDragOver(event)"
                                ondrop="handleTaskDrop(event, ${t.id})"
                                ondragend="handleTaskDragEnd(event)">
                                
                                <div class="flex items-start gap-2 ${isCompact ? '' : 'mb-1'}">
                                    <div class="mt-1 text-slate-300 group-hover:text-slate-400"><i data-lucide="grip-vertical" class="w-3 h-3"></i></div>
                                    
                                    <input type="checkbox" onchange="toggleTaskSelection(${t.id})" ${isSelected ? 'checked' : ''} class="mt-1 w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 cursor-pointer">
                                    <button onclick="toggleTask(${t.id})" class="mt-0.5 shrink-0 transition-transform active:scale-90">
                                        ${t.completed ? '<i data-lucide="check-circle-2" class="text-indigo-500 w-3.5 h-3.5"></i>' : '<i data-lucide="circle" class="text-slate-300 w-3.5 h-3.5"></i>'}
                                    </button>
                                    <p class="text-[12px] font-bold leading-tight break-all ${t.completed ? 'line-through text-slate-400' : 'text-slate-700'}">${t.text}</p>
                                </div>

                                ${ (showWeekTag || !isCompact) ? `
                                <div class="flex items-center justify-between ${isCompact ? '' : 'mt-1'}">
                                    ${showWeekTag ? `<p class="text-[9px] font-black uppercase tracking-tighter px-1.5 rounded ${getTagStyle(t.category)}">#${t.category}</p>` : '<div></div>'}
                                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onclick="openCopyModal(${t.id})" class="p-1 text-slate-300 hover:text-indigo-500" title="복사"><i data-lucide="copy" class="w-3 h-3"></i></button>
                                        <button onclick="startEdit(${t.id})" class="p-1 text-slate-300 hover:text-indigo-500" title="수정"><i data-lucide="pencil" class="w-3 h-3"></i></button>
                                        <button onclick="deleteTask(${t.id})" class="p-1 text-slate-300 hover:text-red-500" title="삭제"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
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
    lucide.createIcons(); // 아이콘 재생성 필수
}

// --- View Renderer: Month ---
// --- View Renderer: Month (업무 표시 개수 6개로 확장) ---
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
                        ${dayTasks.slice(0, 6).map(t => `
                            <div class="flex items-center gap-1">
                                <div class="w-1.5 h-1.5 rounded-full ${t.completed ? 'bg-slate-300' : 'bg-indigo-400'}"></div>
                                <span class="text-[9px] truncate ${t.completed ? 'text-slate-300 line-through' : 'text-slate-600 font-medium'}">${t.text}</span>
                            </div>
                        `).join('')}
                        ${dayTasks.length > 6 ? `<div class="text-[9px] text-slate-400 pl-2.5">+${dayTasks.length - 6} more</div>` : ''}
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

// 입력창 색상 선택 시 시각적 표시 기능
function selectTaskInputColor(colorClass, btn) {
    selectedTaskColor = colorClass;
    // 모든 버튼의 강조 표시를 지우고 클릭한 것만 표시
    document.querySelectorAll('.task-color-dot').forEach(b => {
        b.classList.remove('ring-2', 'ring-slate-400', 'ring-offset-1');
    });
    btn.classList.add('ring-2', 'ring-slate-400', 'ring-offset-1');
}

// 태그 선택 드롭다운 토글
function toggleTagInput(selectEl) {
    const directBox = document.getElementById('direct-tag-box');
    if (selectEl.value === 'DIRECT') {
        directBox.classList.remove('hidden');
    } else {
        directBox.classList.add('hidden');
    }
}

async function toggleTask(id) { 
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t); 
    render(); 
    await triggerAutoSync();
}

async function deleteSelectedTasks() {
    if(!confirm(`선택한 ${selectedTaskIds.size}개의 일정을 삭제할까요?`)) return;
    tasks = tasks.filter(t => !selectedTaskIds.has(t.id));
    selectedTaskIds.clear(); // 선택 초기화
    render();
    await triggerAutoSync(); // 구글 시트에 즉시 반영
}

// --- [수정] 할 일 저장 기능 ---
async function saveEdit(id) {
    const text = document.getElementById(`edit-text-${id}`).value.trim();
    const tag = document.getElementById(`edit-tag-${id}`).value.trim().toUpperCase();
    const desc = document.getElementById(`edit-desc-${id}`).value.trim();
    
    // 만약 수정 중에 색상을 클릭했다면 editingTaskColor를 사용하고, 아니면 기존 색상을 유지합니다.
    const existingTask = tasks.find(t => t.id === id);
    const color = editingTaskColor || existingTask.color || 'bg-white'; 

    if (!text) return alert("내용을 입력해주세요.");

    tasks = tasks.map(t => {
        if (t.id === id) {
            return { ...t, text, desc, category: tag, color: color };
        }
        return t;
    });

    editingId = null; 
    editingTaskColor = null; // 초기화
    render(); 
    await triggerAutoSync();
}

function getTagStyle(tag) {
    return tagColorMap[tag.toUpperCase()] || "text-indigo-400 bg-indigo-50"; 
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

function startEdit(id) {
    editingId = id;
    const task = tasks.find(t => t.id === id);
    editingTaskColor = task.color || 'bg-white';
    editingTagStyle = tagColorMap[task.category] || 'text-indigo-600 bg-indigo-100';
    render(); 
}
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
    const descIcon = document.getElementById('desc-eye-icon');
    const tagIcon = document.getElementById('tag-eye-icon');
    
    if(!descBtn || !tagBtn) return;

    // 메모 표시 상태 업데이트
    if (showWeekDesc) {
        descBtn.classList.add('bg-indigo-50', 'text-indigo-600', 'border-indigo-100');
        descIcon?.setAttribute('data-lucide', 'eye');
        document.getElementById('desc-toggle-text').innerText = "메모 표시";
    } else {
        descBtn.classList.remove('bg-indigo-50', 'text-indigo-600', 'border-indigo-100');
        descIcon?.setAttribute('data-lucide', 'eye-off');
        document.getElementById('desc-toggle-text').innerText = "메모 숨김";
    }

    // 태그 표시 상태 업데이트
    if (showWeekTag) {
        tagBtn.classList.add('bg-indigo-50', 'text-indigo-600', 'border-indigo-100');
        tagIcon?.setAttribute('data-lucide', 'hash');
        document.getElementById('tag-toggle-text').innerText = "태그 표시";
    } else {
        tagBtn.classList.remove('bg-indigo-50', 'text-indigo-600', 'border-indigo-100');
        tagIcon?.setAttribute('data-lucide', 'eye-off');
        document.getElementById('tag-toggle-text').innerText = "태그 숨김";
    }
    
    lucide.createIcons();
}

function toggleSelectAll() {
    let visibleTasks = [];
    
    if (currentView === 'day') {
        // 데일리: 현재 선택된 날짜의 일정 필터링
        visibleTasks = tasks.filter(t => t.date === selectedDate.toDateString() && (!filterTag || t.category === filterTag));
    } else if (currentView === 'week') {
        // 위클리: 현재 화면에 보이는 7일간의 일정 필터링
        const start = new Date(selectedDate);
        const dayNum = start.getDay();
        let diff = (weekStartDay === 1) ? (dayNum === 0 ? -6 : 1 - dayNum) : -dayNum;
        start.setDate(start.getDate() + diff);
        
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start); 
            d.setDate(d.getDate() + i);
            weekDates.push(d.toDateString());
        }
        visibleTasks = tasks.filter(t => weekDates.includes(t.date) && (!filterTag || t.category === filterTag));
    }

    if (visibleTasks.length === 0) return;

    // 모든 가시적 업무가 이미 선택되었는지 확인
    const allVisibleSelected = visibleTasks.every(t => selectedTaskIds.has(t.id));
    
    if (allVisibleSelected) {
        visibleTasks.forEach(t => selectedTaskIds.delete(t.id));
    } else {
        visibleTasks.forEach(t => selectedTaskIds.add(t.id));
    }
    
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

// 메모 삭제 기능
async function deleteRecord(id) {
    if(!confirm("이 메모를 삭제할까요?")) return;
    records = records.filter(r => r.id !== id);
    render();
    await triggerAutoSync(); // 시트에 반영
}

// 메모 수정 시작
function startEditRecord(id) {
    editingRecordId = id;
    const rec = records.find(r => r.id === id);
    editingRecordColor = rec.color;
    render();
}

// 메모 수정 저장
async function saveEditRecord(id) {
    const title = document.getElementById(`edit-rec-title-${id}`).value.trim();
    const content = document.getElementById(`edit-rec-content-${id}`).value.trim();
    const tagInput = document.getElementById(`edit-rec-tags-${id}`).value.trim();
    
    if (!title) return alert("제목을 입력해주세요.");
    
    const hashtags = tagInput ? tagInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== "") : [];
    
    records = records.map(r => r.id === id ? { 
        ...r, title, content, hashtags, color: editingRecordColor || r.color 
    } : r);
    
    editingRecordId = null;
    render();
    await triggerAutoSync(); // 시트에 반영
}

// 수정 취소
function cancelEditRecord() {
    editingRecordId = null;
    render();
}


// ==========================================
// 1. 일정(TASK) 복사 및 붙여넣기 기능
// ==========================================

// [일괄 복사] 선택한 일정들을 클립보드에 담기
function copySelectedTasks() {
    if (selectedTaskIds.size === 0) return alert("복사할 일정을 선택해주세요.");
    clipboard = tasks.filter(t => selectedTaskIds.has(t.id)).map(t => ({ ...t }));
    selectedTaskIds.clear();
    render();
    alert(`${clipboard.length}개의 일정이 복사되었습니다. 원하는 날짜로 이동해 '붙여넣기' 버튼을 누르세요.`);
}

// [붙여넣기] 클립보드의 내용을 현재 날짜로 복사
async function pasteTasks() {
    if (clipboard.length === 0) return;
    
    const newTasks = clipboard.map(t => ({
        ...t,
        id: Date.now() + Math.random(), // 겹치지 않는 새 ID 생성
        date: selectedDate.toDateString(), // 현재 보고 있는 날짜로 설정
        completed: false // 복사본은 미완료 상태로
    }));
    
    tasks = [...tasks, ...newTasks];
    render();
    await triggerAutoSync(); // 구글 시트 동기화
    alert("일정이 붙여넣기 되었습니다.");
}

// [개별 복사 창 열기]
function openCopyModal(id) {
    taskToCopy = tasks.find(t => t.id === id);
    const modal = document.getElementById('copy-modal');
    if(modal) {
        modal.classList.remove('hidden');
        // 오늘 날짜를 기본값으로 설정
        document.getElementById('copy-target-date').value = new Date().toISOString().split('T')[0];
    }
}

// [개별 복사 취소]
function closeCopyModal() {
    document.getElementById('copy-modal').classList.add('hidden');
    taskToCopy = null;
}

// [개별 복사 실행] 날짜 선택 후 복사 확인 눌렀을 때
async function confirmCopy() {
    const targetDateStr = document.getElementById('copy-target-date').value;
    if (!targetDateStr || !taskToCopy) return;
    
    const targetDate = new Date(targetDateStr).toDateString();
    const newTask = {
        ...taskToCopy,
        id: Date.now(),
        date: targetDate,
        completed: false
    };
    
    tasks.push(newTask);
    closeCopyModal();
    render();
    await triggerAutoSync();
    alert("해당 날짜로 일정이 복사되었습니다.");
}

// 선택 해제
function clearSelection() {
    selectedTaskIds.clear();
    render();
}

// 체크박스 토글 (일정)
function toggleTaskSelection(id) {
    if (selectedTaskIds.has(id)) selectedTaskIds.delete(id);
    else selectedTaskIds.add(id);
    updateBulkActionBar();
    render();
}


// ==========================================
// 2. 메모(RECORD) 복사 및 붙여넣기 기능
// ==========================================

// [개별 복사] 메모 카드에서 복사 버튼 클릭
function copyRecord(id) {
    const rec = records.find(r => r.id === id);
    if (rec) {
        recordClipboard = [{ ...rec }];
        alert("메모가 복사되었습니다. '붙여넣기' 버튼을 누르면 상단에 추가됩니다.");
        render();
    }
}

// [일괄 복사] 선택한 메모들을 클립보드에 담기
function copySelectedRecords() {
    if (selectedRecordIds.size === 0) return alert("복사할 메모를 선택해주세요.");
    recordClipboard = records.filter(r => selectedRecordIds.has(r.id)).map(r => ({ ...r }));
    selectedRecordIds.clear();
    render();
    alert(`${recordClipboard.length}개의 메모가 복사되었습니다.`);
}

// [붙여넣기] 클립보드 내용을 메모 리스트 상단에 추가
async function pasteRecords() {
    if (recordClipboard.length === 0) return;
    
    const newRecords = recordClipboard.map(r => ({
        ...r,
        id: Date.now() + Math.random(),
        collapsed: false
    }));
    
    records = [...newRecords, ...records];
    render();
    await triggerAutoSync();
    alert("메모가 붙여넣기 되었습니다.");
}

// 체크박스 토글 (메모)
function toggleRecordSelection(id) {
    if (selectedRecordIds.has(id)) selectedRecordIds.delete(id);
    else selectedRecordIds.add(id);
    render();
}

// 메모 전체 선택 토글
function toggleSelectAllRecords() {
    // 현재 화면에 보이는 메모들만 필터링해서 선택
    const visibleRecords = records.filter(rec => {
        const matchesSearch = rec.title.toLowerCase().includes(recordSearchQuery) || rec.content.toLowerCase().includes(recordSearchQuery);
        const matchesFilter = !filterTag || rec.hashtags.includes(filterTag);
        return matchesSearch && matchesFilter;
    });
    
    const allSelected = visibleRecords.length > 0 && visibleRecords.every(r => selectedRecordIds.has(r.id));
    if (allSelected) visibleRecords.forEach(r => selectedRecordIds.delete(r.id));
    else visibleRecords.forEach(r => selectedRecordIds.add(r.id));
    render();
}

// 선택한 메모 일괄 삭제
async function deleteSelectedRecords() {
    if (selectedRecordIds.size === 0) return;
    if (!confirm(`선택한 ${selectedRecordIds.size}개의 메모를 삭제할까요?`)) return;
    
    records = records.filter(r => !selectedRecordIds.has(r.id));
    selectedRecordIds.clear();
    render();
    await triggerAutoSync();
}

// --- 업무 순서 변경 (Drag & Drop) 로직 ---
let draggedTaskId = null;

function handleTaskDragStart(e, id) {
    draggedTaskId = id;
    e.dataTransfer.effectAllowed = 'move';
    // 드래그 시 투명도 조절
    e.target.style.opacity = '0.5';
}

function handleTaskDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

// --- 업무 순서 및 날짜 변경 로직 (위클리 대응 버전) ---
async function handleTaskDrop(e, targetId) {
    e.preventDefault();
    if (draggedTaskId === null || draggedTaskId === targetId) return;

    const draggedIndex = tasks.findIndex(t => t.id === draggedTaskId);
    const targetIndex = tasks.findIndex(t => t.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
        const targetTask = tasks[targetIndex];
        const [draggedTask] = tasks.splice(draggedIndex, 1);
        
        // 중요: 드래그한 업무의 날짜를 목표 업무의 날짜로 변경합니다 (요일 간 이동 가능)
        draggedTask.date = targetTask.date;
        
        // 새로운 위치에 삽입
        tasks.splice(targetIndex, 0, draggedTask);
        
        render();
        await triggerAutoSync(); // 변경 사항 구글 시트 저장
    }
    draggedTaskId = null;
}

function handleTaskDragEnd(e) {
    e.target.style.opacity = '1';
}

// 드롭다운 선택에 따라 직접입력창 숨기기/보이기
function toggleTagInput(selectEl, directInputId) {
    const directInput = document.getElementById(directInputId);
    if (selectEl.value === 'DIRECT') {
        directInput.classList.remove('hidden');
        directInput.focus();
    } else {
        directInput.classList.add('hidden');
    }
}

async function saveEdit(id) {
    const text = document.getElementById(`edit-text-${id}`).value.trim();
    const tag = document.getElementById(`edit-tag-${id}`).value.trim().toUpperCase();
    const desc = document.getElementById(`edit-desc-${id}`).value.trim();

    if (!text) return alert("내용을 입력해주세요.");

    // 1. 태그 색상 맵 업데이트 (태그의 색상을 여기서 변경한 것으로 간주)
    if (tag) {
        tagColorMap[tag] = editingTagStyle;
    }

    // 2. 업무 데이터 업데이트
    tasks = tasks.map(t => {
        if (t.id === id) {
            return { ...t, text, desc, category: tag, color: editingTaskColor };
        }
        return t;
    });

    editingId = null; 
    render(); 
    await triggerAutoSync();
}

// 1. 고정 태그 버튼 클릭 시 입력창에 태그 입력
function setTagToInput(tag) {
    document.getElementById('new-tag-input').value = tag;
}

// 3. 기존 addTask 함수 수정 (태그 입력 방식 변경 반영)
async function addTask() {
    const text = document.getElementById('new-task-input').value.trim();
    const tag = document.getElementById('new-tag-input').value.trim().toUpperCase() || "WORK";
    
    if (!text) return alert("할 일을 입력해주세요.");

    const newTask = { 
        id: Date.now(), 
        text, 
        desc: document.getElementById('new-desc-input').value.trim(), 
        date: selectedDate.toDateString(), 
        completed: false, 
        category: tag,
        color: selectedTaskColor 
    };
    
    tasks.push(newTask);
    render();
    await triggerAutoSync();
}

// 1. 태그 색상 선택 함수
function selectTagStyle(styleClass, btn) {
    selectedNewTagStyle = styleClass;
    document.querySelectorAll('.tag-style-dot').forEach(dot => {
        dot.classList.remove('ring-2', 'ring-slate-400', 'ring-offset-1');
        dot.classList.add('border-transparent');
    });
    btn.classList.add('ring-2', 'ring-slate-400', 'ring-offset-1');
    btn.classList.remove('border-transparent');
}

// 태그 고정 및 색상 수정 함수
async function pinCurrentTag() {
    const tagInput = document.getElementById('new-tag-input');
    const newTag = tagInput.value.trim().toUpperCase();
    
    if (!newTag) return alert("태그 이름을 입력하세요.");
    
    if (!frequentTags.includes(newTag)) frequentTags.push(newTag);
    
    tagColorMap[newTag] = selectedNewTagStyle; // 여기서 색상을 적용
    
    render(); 
    await triggerAutoSync();
}

// 3. 고정 태그 삭제 함수
async function removeFrequentTag(tag) {
    if (!confirm(`#${tag} 태그를 고정 목록에서 삭제할까요?`)) return;
    frequentTags = frequentTags.filter(t => t !== tag);
    delete tagColorMap[tag];
    render();
    await triggerAutoSync();
}

// 4. 입력창에 태그 세팅
function setTagToInput(tag) {
    document.getElementById('new-tag-input').value = tag;
    // 해당 태그의 기존 색상이 있다면 피커도 해당 색상으로 시각적 업데이트 (선택 사항)
    if(tagColorMap[tag]) selectedNewTagStyle = tagColorMap[tag];
}

async function deleteTask(id) {
    if (!confirm("이 일정을 삭제할까요?")) return;
    
    // tasks 배열에서 해당 id 제외
    tasks = tasks.filter(t => t.id !== id);
    // 선택 목록(selectedTaskIds)에서도 제거
    selectedTaskIds.delete(id);
    
    render(); // 화면 갱신
    await triggerAutoSync(); // 구글 시트 자동 동기화
}

window.onload = init;