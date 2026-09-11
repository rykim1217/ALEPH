# DebugNote

Python 학습자가 브라우저에서 코드를 직접 실행하고, 실제 오류가 발생했을 때 원인·힌트·수정 방향을 확인할 수 있는 학습용 웹 애플리케이션입니다.

## 핵심 기능
- 브라우저에서 Python 코드 실제 실행 (Pyodide)
- 단일 코드 편집기 + 실행 결과 2단 화면
- 정상 코드에는 불필요한 수정 제안 없음
- SyntaxError / NameError / TypeError 등 오류 원인과 힌트 제공
- 일부 오류의 수정 예시 적용 및 재실행
- 기초 예제 / 오류 학습 예제 불러오기
- 최근 실행 기록 10개를 브라우저 localStorage에 저장하고 다시 불러오기
- 실행마다 새 Python Worker를 사용하여 이전 변수 상태를 유지하지 않음
- 8초 이상 실행되는 코드는 중단하여 무한 반복 위험 완화

## 실행 방법
정적 웹 파일이므로 `index.html`, `style.css`, `app.js`를 같은 폴더에 두고 웹 서버에서 열면 됩니다.
Pyodide를 CDN에서 불러오기 때문에 인터넷 연결이 필요합니다.

예: VS Code Live Server, Vercel, GitHub Pages 등

## 파일
- `index.html` — 화면 구조
- `style.css` — UI 스타일
- `app.js` — Python 실행, 오류 안내, 예제, 실행 기록 기능

- 상단의 **연구와 앱 연결 보기**에서 논문 결과가 DebugNote의 실행·분석 원칙으로 어떻게 반영되었는지 확인할 수 있습니다.
