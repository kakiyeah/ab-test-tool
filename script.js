// 全局变量
let testData = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let userNotes = {};
let sessionId = '';
let originalLabels = [];

// 页面元素
const pages = {
    home: document.getElementById('home-page'),
    loading: document.getElementById('loading-page'),
    test: document.getElementById('test-page'),
    submit: document.getElementById('submit-page'),
    result: document.getElementById('result-page')
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// 初始化应用
function initializeApp() {
    // 生成或恢复会话ID
    sessionId = localStorage.getItem('abTestSessionId') || generateSessionId();
    localStorage.setItem('abTestSessionId', sessionId);
    
    // 恢复测评进度
    const savedProgress = localStorage.getItem('abTestProgress');
    if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        if (progress.sessionId === sessionId) {
            testData = progress.testData || [];
            currentQuestionIndex = progress.currentQuestionIndex || 0;
            userAnswers = progress.userAnswers || [];
            userNotes = progress.userNotes || {};
            originalLabels = progress.originalLabels || [];
            
            if (testData.length > 0 && currentQuestionIndex < testData.length) {
                showPage('test');
                renderQuestion();
            }
        }
    }
}

// 生成10位会话ID
function generateSessionId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 设置事件监听器
function setupEventListeners() {
    // 文件上传
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);
    
    // 开始测评
    document.getElementById('start-test').addEventListener('click', startTest);
    
    // 导航按钮
    document.getElementById('prev-btn').addEventListener('click', previousQuestion);
    document.getElementById('next-btn').addEventListener('click', nextQuestion);
    document.getElementById('back-btn').addEventListener('click', showConfirmModal);
    
    // 模态框
    document.getElementById('confirm-back').addEventListener('click', goBack);
    document.getElementById('cancel-back').addEventListener('click', hideConfirmModal);
    document.getElementById('save-note').addEventListener('click', saveNote);
    document.getElementById('cancel-note').addEventListener('click', hideNoteModal);
    
    // 提交
    document.getElementById('submit-final').addEventListener('click', submitResults);
    document.getElementById('new-test').addEventListener('click', startNewTest);
    
    // 下载
    document.getElementById('download-csv').addEventListener('click', () => downloadResults('csv'));
    document.getElementById('download-xlsx').addEventListener('click', () => downloadResults('xlsx'));
    
    // 匿名复选框
    document.getElementById('anonymous-check').addEventListener('change', function() {
        const nicknameInput = document.getElementById('nickname-input');
        nicknameInput.disabled = this.checked;
        if (this.checked) {
            nicknameInput.value = '';
        }
    });
}

// 处理拖拽
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

// 处理文件
function processFile(file) {
    const allowedTypes = [
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];
    
    if (!allowedTypes.includes(file.type)) {
        alert('请上传CSV或Excel文件');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB限制
        alert('文件大小不能超过5MB');
        return;
    }
    
    showFileInfo(file);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        parseFile(content, file.name);
    };
    
    if (file.type === 'text/csv') {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

// 显示文件信息
function showFileInfo(file) {
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'block';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 解析文件
function parseFile(content, fileName) {
    try {
        let data = [];
        
        if (fileName.toLowerCase().endsWith('.csv')) {
            data = parseCSV(content);
        } else {
            data = parseExcel(content);
        }
        
        // 验证数据格式
        if (!validateData(data)) {
            return;
        }
        
        // 限制数据行数
        if (data.length > 500) {
            alert('数据行数不能超过500行');
            return;
        }
        
        testData = data;
        originalLabels = getOriginalLabels(data[0]);
        
    } catch (error) {
        alert('文件解析失败：' + error.message);
    }
}

// 解析CSV
function parseCSV(content) {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }
    }
    
    return data;
}

// 解析Excel
function parseExcel(content) {
    const workbook = XLSX.read(content, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data;
}

// 验证数据格式
function validateData(data) {
    if (data.length === 0) {
        alert('文件为空');
        return false;
    }
    
    const headers = Object.keys(data[0]);
    const requiredHeaders = ['回复A', '回复B'];
    const optionalHeaders = ['标准问题'];
    
    // 检查必需列
    for (const required of requiredHeaders) {
        if (!headers.includes(required)) {
            alert(`缺少必需列：${required}`);
            return false;
        }
    }
    
    // 检查可选列
    const hasStandardQuestion = headers.includes('标准问题');
    
    // 检查是否有C、D选项
    const hasOptionC = headers.includes('回复C');
    const hasOptionD = headers.includes('回复D');
    
    return true;
}

// 获取原始标签
function getOriginalLabels(headers) {
    const labels = [];
    if (headers['回复A']) labels.push('A');
    if (headers['回复B']) labels.push('B');
    if (headers['回复C']) labels.push('C');
    if (headers['回复D']) labels.push('D');
    return labels;
}

// 开始测评
function startTest() {
    if (testData.length === 0) {
        alert('请先上传数据文件');
        return;
    }
    
    // 重置测评状态
    currentQuestionIndex = 0;
    userAnswers = [];
    userNotes = {};
    
    showPage('loading');
    
    // 模拟加载过程
    const progressBar = document.getElementById('progress-bar');
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => {
                showPage('test');
                renderQuestion();
            }, 500);
        }
        progressBar.style.width = progress + '%';
    }, 200);
}

// 显示页面
function showPage(pageName) {
    Object.values(pages).forEach(page => page.classList.remove('active'));
    pages[pageName].classList.add('active');
}

// 渲染问题
function renderQuestion() {
    if (currentQuestionIndex >= testData.length) {
        showSubmitPage();
        return;
    }
    
    const question = testData[currentQuestionIndex];
    const standardQuestion = document.getElementById('standard-question');
    const optionsContainer = document.getElementById('options-container');
    
    // 显示标准问题（如果有）
    if (question['标准问题']) {
        standardQuestion.textContent = question['标准问题'];
        standardQuestion.style.display = 'block';
    } else {
        standardQuestion.style.display = 'none';
    }
    
    // 创建选项
    const options = [];
    if (question['回复A']) options.push({ label: 'A', content: question['回复A'], original: 'A' });
    if (question['回复B']) options.push({ label: 'B', content: question['回复B'], original: 'B' });
    if (question['回复C']) options.push({ label: 'C', content: question['回复C'], original: 'C' });
    if (question['回复D']) options.push({ label: 'D', content: question['回复D'], original: 'D' });
    
    // 随机排序选项
    shuffleArray(options);
    
    // 渲染选项卡片
    optionsContainer.innerHTML = '';
    options.forEach(option => {
        const card = createOptionCard(option, currentQuestionIndex);
        optionsContainer.appendChild(card);
    });
    
    // 更新导航状态
    updateNavigation();
    updateProgress();
    
    // 保存进度
    saveProgress();
}

// 创建选项卡片
function createOptionCard(option, questionIndex) {
    const card = document.createElement('div');
    card.className = 'option-card';
    if (userAnswers[questionIndex] === option.original) {
        card.classList.add('selected');
    }
    
    card.innerHTML = `
        <div class="option-label">${option.label}</div>
        <div class="option-content">${option.content}</div>
        <div class="note-icon" data-question="${questionIndex}" data-option="${option.original}">
            <i class="fas fa-sticky-note"></i>
        </div>
    `;
    
    // 添加点击事件
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.note-icon')) {
            selectOption(option.original, questionIndex);
        }
    });
    
    // 添加备注事件
    const noteIcon = card.querySelector('.note-icon');
    noteIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        showNoteModal(questionIndex, option.original);
    });
    
    return card;
}

// 选择选项
function selectOption(option, questionIndex) {
    userAnswers[questionIndex] = option;
    
    // 更新卡片样式
    const cards = document.querySelectorAll('.option-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    const selectedCard = Array.from(cards).find(card => {
        const noteIcon = card.querySelector('.note-icon');
        return noteIcon.dataset.option === option;
    });
    
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    updateNavigation();
    saveProgress();
}

// 更新导航状态
function updateNavigation() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.disabled = currentQuestionIndex === 0;
    
    if (currentQuestionIndex === testData.length - 1) {
        nextBtn.innerHTML = '<i class="fas fa-check"></i>';
    } else {
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    }
}

// 更新进度
function updateProgress() {
    const progressText = document.getElementById('progress-text');
    const progressDots = document.getElementById('progress-dots');
    
    progressText.textContent = `${currentQuestionIndex + 1} / ${testData.length}`;
    
    // 创建进度点
    progressDots.innerHTML = '';
    for (let i = 0; i < testData.length; i++) {
        const dot = document.createElement('div');
        dot.className = 'progress-dot';
        if (i < currentQuestionIndex) {
            dot.classList.add('answered');
        } else if (i === currentQuestionIndex) {
            dot.classList.add('current');
        }
        
        if (i <= currentQuestionIndex || userAnswers[i]) {
            dot.addEventListener('click', () => goToQuestion(i));
        }
        
        progressDots.appendChild(dot);
    }
}

// 跳转到指定问题
function goToQuestion(index) {
    if (index <= currentQuestionIndex || userAnswers[index]) {
        currentQuestionIndex = index;
        renderQuestion();
    }
}

// 上一题
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

// 下一题
function nextQuestion() {
    if (currentQuestionIndex === testData.length - 1) {
        // 最后一题，检查是否已选择
        if (!userAnswers[currentQuestionIndex]) {
            alert('请选择一个选项');
            return;
        }
        showSubmitPage();
    } else {
        // 检查当前题是否已答
        if (!userAnswers[currentQuestionIndex]) {
            alert('请选择一个选项');
            return;
        }
        currentQuestionIndex++;
        renderQuestion();
    }
}

// 显示提交页面
function showSubmitPage() {
    showPage('submit');
    
    // 播放提交动画
    const animation = document.getElementById('submit-animation');
    animation.style.animation = 'none';
    setTimeout(() => {
        animation.style.animation = 'bounce 0.6s ease';
    }, 10);
}

// 显示确认对话框
function showConfirmModal() {
    document.getElementById('confirm-modal').classList.add('active');
}

// 隐藏确认对话框
function hideConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
}

// 显示备注对话框
function showNoteModal(questionIndex, option) {
    const modal = document.getElementById('note-modal');
    const textarea = document.getElementById('note-text');
    
    const noteKey = `${questionIndex}-${option}`;
    textarea.value = userNotes[noteKey] || '';
    
    modal.dataset.questionIndex = questionIndex;
    modal.dataset.option = option;
    modal.classList.add('active');
}

// 隐藏备注对话框
function hideNoteModal() {
    document.getElementById('note-modal').classList.remove('active');
}

// 保存备注
function saveNote() {
    const modal = document.getElementById('note-modal');
    const textarea = document.getElementById('note-text');
    const questionIndex = modal.dataset.questionIndex;
    const option = modal.dataset.option;
    
    const noteKey = `${questionIndex}-${option}`;
    userNotes[noteKey] = textarea.value.trim();
    
    hideNoteModal();
    saveProgress();
}

// 返回首页
function goBack() {
    hideConfirmModal();
    clearProgress();
    showPage('home');
}

// 提交结果
function submitResults() {
    const nicknameInput = document.getElementById('nickname-input');
    const anonymousCheck = document.getElementById('anonymous-check');
    
    let nickname = '';
    if (!anonymousCheck.checked) {
        nickname = nicknameInput.value.trim();
        if (!nickname) {
            alert('请输入昵称或选择匿名');
            return;
        }
    } else {
        nickname = '匿名';
    }
    
    // 保存结果
    const results = {
        sessionId: sessionId,
        nickname: nickname,
        uploadTime: new Date().toISOString(),
        testData: testData,
        userAnswers: userAnswers,
        userNotes: userNotes,
        originalLabels: originalLabels
    };
    
    localStorage.setItem('abTestResults', JSON.stringify(results));
    
    // 显示结果页面
    document.getElementById('session-id').textContent = sessionId;
    showPage('result');
}

// 开始新测评
function startNewTest() {
    clearProgress();
    showPage('home');
}

// 下载结果
function downloadResults(format) {
    const results = JSON.parse(localStorage.getItem('abTestResults'));
    if (!results) {
        alert('没有可下载的结果');
        return;
    }
    
    const data = prepareDownloadData(results);
    
    if (format === 'csv') {
        downloadCSV(data);
    } else {
        downloadXLSX(data);
    }
}

// 准备下载数据
function prepareDownloadData(results) {
    const headers = ['序号', '标准问题', '回复A', '回复B', '回复C', '回复D', '测评结论', '标注', '备注'];
    const data = [headers];
    
    results.testData.forEach((row, index) => {
        const answer = results.userAnswers[index];
        const noteKey = `${index}-${answer}`;
        const note = results.userNotes[noteKey] || '';
        
        const dataRow = [
            index + 1,
            row['标准问题'] || '',
            row['回复A'] || '',
            row['回复B'] || '',
            row['回复C'] || '',
            row['回复D'] || '',
            answer || '',
            '', // 标注列
            note
        ];
        data.push(dataRow);
    });
    
    return data;
}

// 下载CSV
function downloadCSV(data) {
    const csvContent = data.map(row => 
        row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ab_test_results_${sessionId}.csv`;
    link.click();
}

// 下载XLSX
function downloadXLSX(data) {
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    
    XLSX.writeFile(workbook, `ab_test_results_${sessionId}.xlsx`);
}

// 保存进度
function saveProgress() {
    const progress = {
        sessionId: sessionId,
        testData: testData,
        currentQuestionIndex: currentQuestionIndex,
        userAnswers: userAnswers,
        userNotes: userNotes,
        originalLabels: originalLabels
    };
    localStorage.setItem('abTestProgress', JSON.stringify(progress));
}

// 清除进度
function clearProgress() {
    localStorage.removeItem('abTestProgress');
    testData = [];
    currentQuestionIndex = 0;
    userAnswers = [];
    userNotes = {};
    originalLabels = [];
}

// 工具函数：随机排序数组
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
