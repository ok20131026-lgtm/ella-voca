# GitHub + Vercel 배포 순서

## 1. GitHub
1. 새 저장소를 만듭니다. 예: `ella-vocabulary`
2. 이 ZIP을 풀고 `ella-vocabulary-app` 폴더 안의 파일을 모두 저장소 최상단에 업로드합니다.
3. `Commit changes`를 누릅니다.

필수 루트 파일:
- index.html
- styles.css
- app.js
- package.json
- build.mjs
- vercel.json
- data/vocabulary.json

## 2. Vercel
1. Add New → Project
2. GitHub의 `ella-vocabulary` 저장소 Import
3. Framework Preset: Other
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Install Command는 비워두거나 기본값 사용 가능 (외부 패키지 없음)
7. Deploy

## 3. 업데이트
`data/vocabulary.json`, `app.js`, `styles.css` 등을 GitHub에서 수정 후 Commit하면 Vercel이 자동 재배포합니다.

## 4. 모바일 확인
- iPhone Safari / Android Chrome에서 확인
- 배포 직후 이전 화면이 보이면 탭을 닫고 다시 열거나 새로고침

## 5. 현재 데이터
- 20 Lessons
- 각 15단어
- 총 300단어
