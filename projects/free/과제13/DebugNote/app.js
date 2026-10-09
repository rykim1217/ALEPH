const codeInput = document.getElementById('codeInput');
const runBtn = document.getElementById('runBtn');
const clearBtn = document.getElementById('clearBtn');
const exampleSelect = document.getElementById('exampleSelect');
const engineStatus = document.getElementById('engineStatus');
const emptyState = document.getElementById('emptyState');
const resultContent = document.getElementById('resultContent');
const resultStatus = document.getElementById('resultStatus');
const outputText = document.getElementById('outputText');
const learnEmpty = document.getElementById('learnEmpty');
const analysisPanel = document.getElementById('analysisPanel');
const resultTab = document.getElementById('resultTab');
const learnTab = document.getElementById('learnTab');
const resultView = document.getElementById('resultView');
const learnView = document.getElementById('learnView');
const historyBtn = document.getElementById('historyBtn');
const historyCount = document.getElementById('historyCount');
const historyDrawer = document.getElementById('historyDrawer');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const researchConnectBtn = document.getElementById('researchConnectBtn');
const researchModal = document.getElementById('researchModal');

const HISTORY_KEY = 'debugnote-history-v3';
const HISTORY_LIMIT = 10;
let activeWorker = null;
let historyItems = loadHistory();

const examples = {
  print: `print("Hello, DebugNote!")`,
  variable: `name = "Rayeon"\nage = 27\nprint(name, age)`,
  if: `score = 82\n\nif score >= 80:\n    print("합격")\nelse:\n    print("다시 도전")`,
  loop: `for i in range(1, 6):\n    print(i)`,
  function: `def add(a, b):\n    return a + b\n\nprint(add(3, 5))`,
  list: `fruits = ["apple", "banana", "grape"]\nfor fruit in fruits:\n    print(fruit)`,
  syntaxError: `for i in range(5)\n    print(i)`,
  nameError: `total = 10\nprint(totla)`,
  typeError: `age = 27\nprint("나이: " + age)`,
  zeroError: `number = 10\nprint(number / 0)`
};

function setEngineStatus(text, state = 'loading') {
  engineStatus.textContent = text;
  engineStatus.className = `engine-status ${state}`;
}

function setTab(tabName) {
  const isResult = tabName === 'result';
  resultTab.classList.toggle('active', isResult);
  learnTab.classList.toggle('active', !isResult);
  resultTab.setAttribute('aria-selected', String(isResult));
  learnTab.setAttribute('aria-selected', String(!isResult));
  resultView.classList.toggle('active', isResult);
  learnView.classList.toggle('active', !isResult);
}

resultTab.addEventListener('click', () => setTab('result'));
learnTab.addEventListener('click', () => setTab('learn'));

exampleSelect.addEventListener('change', () => {
  const key = exampleSelect.value;
  if (!key) return;
  if (codeInput.value.trim() && codeInput.value !== examples[key]) {
    const ok = window.confirm('현재 입력한 코드를 예제로 바꿀까요?');
    if (!ok) {
      exampleSelect.value = '';
      return;
    }
  }
  codeInput.value = examples[key];
  resetViews();
  codeInput.focus();
  exampleSelect.value = '';
});

clearBtn.addEventListener('click', () => {
  if (codeInput.value.trim() && !window.confirm('현재 입력한 코드를 지울까요?')) return;
  codeInput.value = '';
  resetViews();
  codeInput.focus();
});

codeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') {
    event.preventDefault();
    const start = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    codeInput.value = codeInput.value.slice(0, start) + '    ' + codeInput.value.slice(end);
    codeInput.selectionStart = codeInput.selectionEnd = start + 4;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    runCode();
  }
});

runBtn.addEventListener('click', runCode);

function resetViews() {
  emptyState.classList.remove('hidden');
  resultContent.classList.add('hidden');
  learnEmpty.classList.remove('hidden');
  analysisPanel.classList.add('hidden');
  analysisPanel.innerHTML = '';
  setTab('result');
}

function createPythonWorker() {
  const workerCode = `
    self.importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
    let pyodideReadyPromise = null;

    async function getPyodide() {
      if (!pyodideReadyPromise) {
        pyodideReadyPromise = loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
      }
      return await pyodideReadyPromise;
    }

    self.onmessage = async (event) => {
      const { code } = event.data;
      try {
        const pyodide = await getPyodide();
        let stdout = '';
        let stderr = '';
        pyodide.setStdout({ batched: (s) => { stdout += s + '\\n'; } });
        pyodide.setStderr({ batched: (s) => { stderr += s + '\\n'; } });
        const result = await pyodide.runPythonAsync(code);
        if (result !== undefined && result !== null && stdout.trim() === '') stdout = String(result);
        self.postMessage({ ok: true, stdout: stdout.trimEnd(), stderr: stderr.trimEnd() });
      } catch (error) {
        self.postMessage({ ok: false, error: String(error) });
      }
    };
  `;
  return new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' })));
}

async function runCode() {
  const code = codeInput.value.trimEnd();
  if (!code.trim()) {
    showResult(false, '실행할 Python 코드를 입력해 주세요.', '입력 필요');
    showInputGuide();
    setTab('result');
    return;
  }

  if (activeWorker) activeWorker.terminate();
  activeWorker = createPythonWorker();

  runBtn.disabled = true;
  runBtn.textContent = '실행 중…';
  showResult(null, 'Python 코드를 실행하고 있습니다…', '실행 중');
  analysisPanel.classList.add('hidden');
  learnEmpty.classList.remove('hidden');
  setEngineStatus('Python 실행 중…', 'loading');
  setTab('result');

  const timeout = setTimeout(() => {
    if (!activeWorker) return;
    activeWorker.terminate();
    activeWorker = null;
    const output = '실행 시간이 너무 길어 중단했습니다. 무한 반복문이나 오래 걸리는 코드를 확인해 주세요.';
    showResult(false, output, '실행 시간 초과');
    const parsed = { type: 'Timeout', message: '실행 시간이 제한을 초과했습니다.' };
    showErrorAnalysis(parsed, code);
    addHistory({ ok: false, code, output, errorType: 'Timeout' });
    finishRun();
  }, 8000);

  activeWorker.onmessage = (event) => {
    clearTimeout(timeout);
    const data = event.data;
    if (data.ok) {
      const output = (data.stdout || data.stderr || '').trim() || '정상적으로 실행되었습니다. (출력 없음)';
      showResult(true, output, '정상 실행');
      showSuccessAnalysis(code);
      addHistory({ ok: true, code, output, errorType: '' });
    } else {
      const parsed = parsePythonError(data.error);
      const output = cleanError(data.error);
      showResult(false, output, parsed.type);
      showErrorAnalysis(parsed, code);
      addHistory({ ok: false, code, output, errorType: parsed.type });
    }
    activeWorker.terminate();
    activeWorker = null;
    finishRun();
  };

  activeWorker.onerror = () => {
    clearTimeout(timeout);
    showResult(false, 'Python 실행 엔진을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.', '엔진 오류');
    setEngineStatus('Python 엔진 오류', 'error');
    runBtn.disabled = false;
    runBtn.textContent = '▶ 실행';
  };

  activeWorker.postMessage({ code });
}

function finishRun() {
  runBtn.disabled = false;
  runBtn.textContent = '▶ 실행';
  setEngineStatus('Python 준비됨', 'ready');
}

function showResult(ok, text, label) {
  emptyState.classList.add('hidden');
  resultContent.classList.remove('hidden');
  outputText.textContent = text;
  outputText.className = `output${ok === false ? ' error' : ''}`;
  resultStatus.className = 'status-line';
  if (ok === true) resultStatus.classList.add('success');
  else if (ok === false) resultStatus.classList.add('error');
  else resultStatus.classList.add('warning');
  resultStatus.textContent = label;
}

function showInputGuide() {
  learnEmpty.classList.add('hidden');
  analysisPanel.classList.remove('hidden');
  analysisPanel.innerHTML = `
    <div class="analysis-card highlight">
      <h4>먼저 코드를 입력해 주세요.</h4>
      <p>왼쪽 입력창에 Python 코드를 작성하거나 상단의 예제를 불러온 뒤 실행할 수 있습니다.</p>
    </div>`;
}

function showSuccessAnalysis(code) {
  learnEmpty.classList.add('hidden');
  analysisPanel.classList.remove('hidden');
  const concepts = detectConcepts(code);
  analysisPanel.innerHTML = `
    <div class="analysis-card highlight">
      <div class="analysis-heading"><span class="analysis-ok">✓ 실행 오류가 확인되지 않았습니다.</span></div>
      <p>현재 코드는 실제로 정상 실행되었습니다. 오류라고 가정해 불필요한 수정을 제안하지 않습니다.</p>
    </div>
    <div class="analysis-card">
      <h4>이 코드에서 확인할 수 있는 개념</h4>
      <p>${escapeHtml(concepts)}</p>
    </div>
    <div class="analysis-card">
      <h4>다음 학습</h4>
      <p>값이나 조건을 한 부분씩 바꾼 뒤 다시 실행해 출력이 어떻게 달라지는지 확인해 보세요.</p>
    </div>`;
}

function showErrorAnalysis(parsed, code) {
  learnEmpty.classList.add('hidden');
  analysisPanel.classList.remove('hidden');
  const guide = getErrorGuide(parsed, code);
  const fixBlock = guide.fixed
    ? `<div class="analysis-card"><h4>④ 수정 예시</h4><pre>${escapeHtml(guide.fixed)}</pre></div>
       <div class="analysis-actions"><button id="applyFixBtn" class="button secondary" type="button">수정 코드 적용</button></div>`
    : `<div class="analysis-card"><h4>④ 수정 예시</h4><p>${escapeHtml(guide.noFix || '현재 코드만으로 한 가지 수정안을 안전하게 확정하기 어렵습니다. 위 원인과 힌트를 확인해 직접 수정한 뒤 다시 실행해 보세요.')}</p></div>`;

  analysisPanel.innerHTML = `
    <div class="analysis-card highlight">
      <div class="analysis-heading"><span class="analysis-type">${escapeHtml(parsed.type)}</span></div>
      <p>${escapeHtml(parsed.message)}</p>
    </div>
    <div class="analysis-card"><h4>① 어디가 문제인가요?</h4><p>${escapeHtml(guide.where)}</p></div>
    <div class="analysis-card"><h4>② 왜 오류가 났나요?</h4><p>${escapeHtml(guide.cause)}</p></div>
    <div class="analysis-card"><h4>③ 먼저 확인할 힌트</h4><p>${escapeHtml(guide.hint)}</p></div>
    ${fixBlock}`;

  const applyFixBtn = document.getElementById('applyFixBtn');
  if (applyFixBtn && guide.fixed) {
    applyFixBtn.addEventListener('click', () => {
      codeInput.value = guide.fixed;
      codeInput.focus();
    });
  }
  setTab('learn');
}

function cleanError(errorText) {
  const parsed = parsePythonError(errorText);
  const lines = String(errorText).split('\n');
  const start = Math.max(0, lines.findIndex((line) => line.includes('Traceback')));
  const useful = lines.slice(start >= 0 ? start : 0)
    .filter((line) => !/pyodide|wasm|CodeRunner|coroutine = eval\(|await CodeRunner/i.test(line));
  const compact = useful.filter((line, i) => line.trim() || (i > 0 && useful[i - 1]?.trim()));
  const text = compact.slice(-10).join('\n').trim();
  return text || `${parsed.type}: ${parsed.message}`;
}

function parsePythonError(errorText) {
  const text = String(errorText || '');
  // Pyodide wraps Python exceptions in "PythonError:". The real exception is
  // the last concrete *Error line in the traceback, so always prefer that.
  const exceptionRegex = /(?:^|\n)\s*((?:[A-Za-z_][A-Za-z0-9_.]*\.)?([A-Za-z_][A-Za-z0-9_]*(?:Error|Exception))):\s*([^\n]*)/g;
  const matches = [...text.matchAll(exceptionRegex)];
  let type = 'PythonError';
  let message = 'Python 실행 중 오류가 발생했습니다.';
  if (matches.length) {
    const last = matches[matches.length - 1];
    type = last[2] || last[1].split('.').pop();
    message = (last[3] || '').trim() || `${type}가 발생했습니다.`;
  }

  const lineMatches = [...text.matchAll(/File\s+"<exec>",\s+line\s+(\d+)/g)];
  const line = lineMatches.length ? Number(lineMatches[lineMatches.length - 1][1]) : null;

  let suggestion = '';
  const suggestionMatch = message.match(/Did you mean:\s*['\"]([^'\"]+)['\"]\??/i);
  if (suggestionMatch) suggestion = suggestionMatch[1];

  let unknownName = '';
  const unknownMatch = message.match(/name\s+['\"]([^'\"]+)['\"]\s+is not defined/i);
  if (unknownMatch) unknownName = unknownMatch[1];

  return { type, message, line, suggestion, unknownName, raw: text };
}

function getLineText(code, line) {
  if (!line || line < 1) return '';
  return code.split('\n')[line - 1] ?? '';
}

function describeLine(code, line) {
  const text = getLineText(code, line).trim();
  if (!line) return '오류 메시지에 표시된 코드를 확인하세요.';
  return text ? `${line}번째 줄 \`${text}\` 부분을 확인하세요.` : `${line}번째 줄을 확인하세요.`;
}

function getAssignedNames(code) {
  const names = new Set();
  for (const line of code.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_]\w*)\s*=(?!=)/);
    if (m) names.add(m[1]);
    const fn = line.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(/);
    if (fn) names.add(fn[1]);
  }
  return [...names];
}

function replaceWholeWord(code, from, to) {
  return code.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'g'), to);
}

function getErrorGuide(parsed, code) {
  const { type, message, line } = parsed;
  const lineText = getLineText(code, line);

  if (type === 'SyntaxError') {
    let fixed = null;
    let where = describeLine(code, line);
    const lines = code.split('\n');
    const colonCandidates = /expected ':'/i.test(message) || /invalid syntax/i.test(message);
    if (colonCandidates) {
      let idx = line ? line - 1 : -1;
      if (idx < 0 || !/^\s*(for|if|while|def|elif|else|try|except|with|class)\b/.test(lines[idx] || '')) {
        idx = lines.findIndex((l) => /^\s*(for|if|while|def|elif|else|try|except|with|class)\b/.test(l) && !l.trimEnd().endsWith(':'));
      }
      if (idx >= 0 && !lines[idx].trimEnd().endsWith(':')) {
        lines[idx] = lines[idx].replace(/\s*$/, '') + ':';
        fixed = lines.join('\n');
        where = `${idx + 1}번째 줄 \`${code.split('\n')[idx].trim()}\` 끝을 확인하세요.`;
      }
    }
    return {
      where,
      cause: /expected ':'/i.test(message)
        ? '코드 블록을 시작하는 문장 끝에 필요한 콜론(:)이 빠져 Python이 문장을 완성된 문법으로 해석하지 못했습니다.'
        : 'Python 문법 규칙에 맞지 않는 부분이 있어 코드를 해석하지 못했습니다.',
      hint: fixed
        ? 'for, if, while, def처럼 아래에 들여쓴 블록이 이어지는 문장은 보통 끝에 콜론(:)이 필요합니다.'
        : '괄호와 따옴표가 짝을 이루는지, 콜론(:)이나 쉼표가 빠지지 않았는지 오류가 표시된 줄과 바로 앞줄을 함께 확인해 보세요.',
      fixed,
      noFix: '문법 오류의 원인이 여러 가지일 수 있어 자동으로 한 가지 수정안을 확정하지 않았습니다. 오류가 표시된 줄 주변의 괄호·따옴표·콜론을 확인해 주세요.'
    };
  }

  if (type === 'IndentationError' || type === 'TabError') {
    return {
      where: describeLine(code, line),
      cause: 'Python은 들여쓰기로 코드 블록의 범위를 구분하는데, 이 줄의 들여쓰기 수준이 주변 블록과 맞지 않습니다.',
      hint: '같은 블록의 문장은 같은 칸 수만큼 들여쓰고, 가능하면 탭과 공백을 섞지 마세요.',
      fixed: null,
      noFix: '의도한 블록 구조를 코드만 보고 확정하기 어려워 자동으로 들여쓰기를 바꾸지 않았습니다.'
    };
  }

  if (type === 'NameError') {
    const unknown = parsed.unknownName || message.match(/name ['\"]([^'\"]+)['\"] is not defined/i)?.[1] || '';
    const assigned = getAssignedNames(code);
    let replacement = parsed.suggestion || '';
    if (!replacement && unknown) {
      replacement = assigned
        .map((name) => ({ name, d: levenshtein(name, unknown) }))
        .sort((a, b) => a.d - b.d)[0]?.name || '';
      if (replacement && levenshtein(replacement, unknown) > Math.max(2, Math.floor(unknown.length / 3))) replacement = '';
    }
    const fixed = unknown && replacement ? replaceWholeWord(code, unknown, replacement) : null;
    return {
      where: line ? `${line}번째 줄에서 정의되지 않은 이름${unknown ? ` \`${unknown}\`` : ''}을 사용했습니다.` : (unknown ? `\`${unknown}\`을 사용한 부분을 확인하세요.` : '정의되지 않은 이름을 사용한 줄을 확인하세요.'),
      cause: unknown
        ? `\`${unknown}\`이라는 이름이 현재 코드에서 정의되어 있지 않습니다.${replacement ? ` Python이 \`${replacement}\`을(를) 비슷한 이름으로 제안했습니다.` : ''}`
        : '정의되지 않은 변수나 함수 이름을 사용했습니다.',
      hint: replacement
        ? `앞에서 선언한 \`${replacement}\`과 철자를 비교해 보세요.`
        : '변수나 함수를 사용하기 전에 선언했는지, 대소문자와 철자가 정확히 같은지 확인해 보세요.',
      fixed,
      noFix: '비슷한 이름을 확실하게 찾지 못해 자동으로 변수명을 바꾸지 않았습니다. 선언한 변수명과 철자를 비교해 주세요.'
    };
  }

  if (type === 'TypeError') {
    let fixed = null;
    let cause = '서로 호환되지 않는 자료형끼리 연산했거나 함수가 기대하지 않는 자료형을 전달했습니다.';
    let hint = '오류가 난 연산의 각 값이 str, int, float, list 중 어떤 자료형인지 확인해 보세요.';

    const concat = message.match(/can only concatenate str \(not ["']?([^"']+)["']?\) to str/i);
    if (concat || /can only concatenate str/i.test(message)) {
      cause = '문자열(str)에 문자열이 아닌 값을 + 연산자로 바로 이어 붙이려고 했습니다.';
      hint = '문자열과 숫자를 함께 출력하려면 숫자를 str()로 바꾸거나 print()에 쉼표로 나눠 전달할 수 있습니다.';
      if (line) {
        const original = getLineText(code, line);
        const m = original.match(/print\((['"`][^'"`]*['"`]\s*\+)\s*([A-Za-z_]\w*)\)/);
        if (m) {
          const lines = code.split('\n');
          lines[line - 1] = original.replace(m[0], `print(${m[1]} str(${m[2]}))`);
          fixed = lines.join('\n');
        }
      }
    }
    return {
      where: describeLine(code, line),
      cause,
      hint,
      fixed,
      noFix: '어떤 자료형으로 바꾸는 것이 맞는지는 코드의 의도에 따라 달라질 수 있어 자동 수정은 하지 않았습니다.'
    };
  }

  if (type === 'ZeroDivisionError') {
    return {
      where: line ? `${line}번째 줄의 나눗셈 연산을 확인하세요.` : '나눗셈(/, //, %)을 수행하는 부분을 확인하세요.',
      cause: '분모가 0인 상태에서 나눗셈을 시도했습니다. Python에서는 0으로 나눌 수 없습니다.',
      hint: '나누기 전에 분모가 0인지 조건문으로 확인하거나, 분모를 계산하는 값이 왜 0이 되었는지 확인해 보세요.',
      fixed: null,
      noFix: '0일 때 어떤 값을 사용하거나 어떤 동작을 해야 하는지는 프로그램의 목적에 따라 달라 자동 수정하지 않았습니다.'
    };
  }

  if (type === 'IndexError') {
    return {
      where: describeLine(code, line),
      cause: '리스트·튜플·문자열의 실제 범위를 벗어난 인덱스를 사용했습니다.',
      hint: 'len()으로 길이를 확인하고, 인덱스가 0부터 길이-1 사이인지 확인해 보세요.',
      fixed: null,
      noFix: '어떤 요소를 의도했는지 알 수 없어 인덱스 값을 자동으로 바꾸지 않았습니다.'
    };
  }

  if (type === 'KeyError') {
    const key = message.match(/^['\"]?(.*?)['\"]?$/)?.[1] || '';
    return {
      where: describeLine(code, line),
      cause: `딕셔너리에 존재하지 않는 키${key ? ` \`${key}\`` : ''}를 []로 직접 조회했습니다.`,
      hint: '키 이름의 철자를 확인하고, 키가 없을 수도 있다면 dict.get() 또는 in 검사를 사용할 수 있습니다.',
      fixed: null,
      noFix: '없는 키를 어떤 값으로 처리할지는 프로그램의 의도에 따라 달라 자동 수정하지 않았습니다.'
    };
  }

  if (type === 'ValueError') {
    return {
      where: describeLine(code, line),
      cause: '자료형 자체는 맞지만, 함수나 변환이 처리할 수 없는 값이 전달되었습니다.',
      hint: 'int(), float() 같은 변환 함수라면 입력 문자열이 실제 숫자 형태인지 확인해 보세요.',
      fixed: null,
      noFix: '허용해야 할 값의 범위가 프로그램마다 달라 입력값을 자동으로 바꾸지 않았습니다.'
    };
  }

  if (type === 'AttributeError') {
    const attr = message.match(/has no attribute ['\"]([^'\"]+)['\"]/i)?.[1] || '';
    return {
      where: describeLine(code, line),
      cause: `해당 객체에 존재하지 않는 속성이나 메서드${attr ? ` \`${attr}\`` : ''}를 사용했습니다.`,
      hint: '객체의 자료형을 확인하고, 그 자료형에서 제공하는 메서드 이름과 철자를 확인해 보세요.',
      fixed: null,
      noFix: '어떤 메서드를 의도했는지 코드만으로 확정하기 어려워 자동 수정하지 않았습니다.'
    };
  }

  if (type === 'UnboundLocalError') {
    return {
      where: describeLine(code, line),
      cause: '함수 안에서 지역 변수에 값이 할당되기 전에 그 변수를 사용했습니다.',
      hint: '함수 내부에서 해당 변수가 모든 실행 경로에서 먼저 할당되는지 확인해 보세요.',
      fixed: null,
      noFix: '변수의 올바른 초기값을 알 수 없어 자동으로 값을 넣지 않았습니다.'
    };
  }

  if (type === 'ImportError' || type === 'ModuleNotFoundError') {
    return {
      where: describeLine(code, line),
      cause: '불러오려는 모듈이나 이름을 현재 브라우저 Python 환경에서 찾지 못했습니다.',
      hint: '모듈 이름의 철자를 확인하고, DebugNote의 브라우저 실행 환경에서 지원되는 라이브러리인지 확인해 보세요.',
      fixed: null,
      noFix: '외부 패키지 설치가 필요한 경우가 있어 코드를 자동으로 변경하지 않았습니다.'
    };
  }

  if (type === 'Timeout') {
    return {
      where: '반복문이나 매우 큰 계산이 있는 부분을 확인하세요.',
      cause: '코드가 DebugNote의 실행 제한 시간 안에 끝나지 않았습니다.',
      hint: 'while 조건이 계속 참이 되는지, 반복 횟수가 지나치게 크지 않은지 확인해 보세요.',
      fixed: null,
      noFix: '반복을 몇 번 수행해야 하는지는 코드의 목적에 따라 달라 자동 수정하지 않았습니다.'
    };
  }

  return {
    where: describeLine(code, line),
    cause: `${type}: ${message}`,
    hint: '오류 메시지와 표시된 줄의 값을 확인해 보세요. DebugNote가 자동으로 분류하지 못한 오류라도 실제 Python 오류명과 메시지는 그대로 표시합니다.',
    fixed: null,
    noFix: '이 오류는 현재 자동 수정 규칙의 범위를 벗어나 있어 코드를 임의로 바꾸지 않았습니다.'
  };
}

function detectConcepts(code) {
  const concepts = [];
  if (/\bprint\s*\(/.test(code)) concepts.push('출력(print)');
  if (/^\s*[A-Za-z_]\w*\s*=/m.test(code)) concepts.push('변수');
  if (/\bif\b/.test(code)) concepts.push('조건문');
  if (/\b(for|while)\b/.test(code)) concepts.push('반복문');
  if (/\bdef\b/.test(code)) concepts.push('함수');
  if (/\[[^\]]*\]/.test(code)) concepts.push('리스트/인덱싱');
  if (/\{[^}]*\}/.test(code)) concepts.push('딕셔너리');
  return concepts.length ? concepts.join(' · ') : '기본 Python 표현식';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));
  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyItems.slice(0, HISTORY_LIMIT)));
  renderHistory();
}

function addHistory({ ok, code, output, errorType }) {
  historyItems.unshift({ id: Date.now(), ok, code, output, errorType, time: new Date().toISOString() });
  historyItems = historyItems.slice(0, HISTORY_LIMIT);
  saveHistory();
}

function renderHistory() {
  historyCount.textContent = historyItems.length;
  if (!historyItems.length) {
    historyList.innerHTML = '<div class="history-empty">아직 실행 기록이 없습니다.</div>';
    return;
  }
  historyList.innerHTML = historyItems.map((item, index) => {
    const date = new Date(item.time);
    const timeText = date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
      <article class="history-item">
        <div class="history-meta">
          <span class="history-status ${item.ok ? 'ok' : 'bad'}">${item.ok ? '✓ 정상' : `✕ ${escapeHtml(item.errorType || '오류')}`}</span>
          <span class="history-time">${escapeHtml(timeText)}</span>
        </div>
        <pre class="history-code">${escapeHtml(item.code)}</pre>
        <p class="history-result">${escapeHtml(item.output)}</p>
        <div class="history-actions">
          <button class="button ghost history-view" data-index="${index}" type="button">결과 보기</button>
          <button class="button secondary history-load" data-index="${index}" type="button">코드 불러오기</button>
        </div>
      </article>`;
  }).join('');

  historyList.querySelectorAll('.history-load').forEach((button) => {
    button.addEventListener('click', () => {
      const item = historyItems[Number(button.dataset.index)];
      if (!item) return;
      if (codeInput.value.trim() && codeInput.value !== item.code && !window.confirm('현재 입력한 코드를 실행 기록의 코드로 바꿀까요?')) return;
      codeInput.value = item.code;
      closeHistory();
      resetViews();
      codeInput.focus();
    });
  });

  historyList.querySelectorAll('.history-view').forEach((button) => {
    button.addEventListener('click', () => {
      const item = historyItems[Number(button.dataset.index)];
      if (!item) return;
      showResult(item.ok, item.output, item.ok ? '기록된 정상 실행' : (item.errorType || '기록된 오류'));
      if (item.ok) showSuccessAnalysis(item.code);
      else {
        learnEmpty.classList.add('hidden');
        analysisPanel.classList.remove('hidden');
        analysisPanel.innerHTML = `<div class="analysis-card highlight"><h4>${escapeHtml(item.errorType || '오류')}</h4><p>이 항목은 이전 실행 기록입니다. 코드를 다시 불러온 뒤 실행하면 현재 환경에서 오류 설명을 다시 확인할 수 있습니다.</p></div>`;
      }
      closeHistory();
      setTab('result');
    });
  });
}

function openHistory() {
  renderHistory();
  historyDrawer.classList.add('open');
  historyDrawer.setAttribute('aria-hidden', 'false');
}

function closeHistory() {
  historyDrawer.classList.remove('open');
  historyDrawer.setAttribute('aria-hidden', 'true');
}


function openResearchModal() {
  researchModal.classList.add('open');
  researchModal.setAttribute('aria-hidden', 'false');
}

function closeResearchModal() {
  researchModal.classList.remove('open');
  researchModal.setAttribute('aria-hidden', 'true');
}

researchConnectBtn.addEventListener('click', openResearchModal);
researchModal.querySelectorAll('[data-close-research]').forEach((el) => el.addEventListener('click', closeResearchModal));
historyBtn.addEventListener('click', openHistory);
historyDrawer.querySelectorAll('[data-close-history]').forEach((el) => el.addEventListener('click', closeHistory));
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (researchModal.classList.contains('open')) closeResearchModal();
  if (historyDrawer.classList.contains('open')) closeHistory();
});
clearHistoryBtn.addEventListener('click', () => {
  if (!historyItems.length) return;
  if (!window.confirm('저장된 실행 기록을 모두 삭제할까요?')) return;
  historyItems = [];
  saveHistory();
});

codeInput.value = examples.loop;
renderHistory();
resetViews();
setEngineStatus('첫 실행 때 Python 엔진을 불러옵니다', 'loading');
