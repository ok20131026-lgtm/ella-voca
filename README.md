# ELLA Vocabulary

Ella의 Yellow 교재용 통합 단어 앱입니다.

## 포함 기능

### 1) 단어 학습
Andy 단어학습 앱의 3단계 구조를 Ella 데이터에 맞게 적용했습니다.

- 1단계 외우기
  - 앞면: 영어단어 + 발음
  - 뒷면: 영어단어 + 한글 뜻 + 품사 + 영영정의 + `[해석]` 영영정의 해석
  - 영영정의의 `[ ]` 안 키워드는 파란색으로 강조
- 2단계 뜻 보고 고르기
  - 한글 뜻 + 영영정의 + `[해석]` 영영정의 해석
  - 품사 표시 안 함
  - 2지선다
  - 미응답 상태에서 다음 문제를 누르면 오답 처리
- 3단계 알파벳 조립
  - 한글 뜻 + 영영정의 + `[해석]` 영영정의 해석
  - 품사 표시 안 함
  - 정답 단어에 포함된 알파벳만 사용
  - 미응답 상태에서 다음 문제를 누르면 오답 처리

### 2) 영영정의 단어시험
기존 Luna-voca2의 핵심 시험 흐름을 유지해 새 Yellow 데이터로 교체한 버전입니다.

- Unit 1 Lesson 1 ~ Unit 10 Lesson 2
- 각 Lesson 15문항
- 영영정의만 보고 4지선다로 단어 선택
- `[ ]` 키워드는 강조색 적용
- 각 보기에서 영어단어 / 품사 / 발음 버튼 제공
- 힌트 보기
- 정답/오답 판정
- 결과 / 오답 보기 / 오답만 다시 풀기
- Lesson별 최고점 및 오답 기록

## 데이터

`data/vocabulary.json`

원본: `source_data/옐로우_단어_U1-U10_엑셀_정리_최종_매크로.xlsm`

- 20 Lessons
- Lesson당 15단어
- 총 300단어
- 단어 / 한글 뜻 / 영영정의 / 영영정의 해석 / 키워드 / 품사 / 발음자료 포함

## 저장 방식

현재 버전은 브라우저 localStorage를 사용합니다.

- 단어학습: `ella-voca-study-v1`
- 영영정의 시험: `ella-voca-test-v1`
- 다크모드: `ella-voca-dark`

서로 다른 기기에서 학습기록을 공유하려면 추후 Supabase를 연결하면 됩니다.

## 실행

Node.js 18 이상 권장. 외부 패키지 설치가 필요하지 않습니다.

```bash
npm run dev
```

브라우저에서 `http://localhost:4173` 접속.

## 빌드 확인

```bash
npm run build
```

빌드 결과는 `dist/` 폴더에 생성됩니다.

## Vercel 배포

1. 이 폴더 전체를 GitHub 저장소에 업로드합니다.
2. Vercel에서 해당 GitHub 저장소를 Import합니다.
3. Framework Preset: Other
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Deploy

환경변수는 현재 버전에서는 필요하지 않습니다.

## 주요 폴더

```text
index.html        앱 진입점
styles.css        전체 UI 스타일
app.js            단어학습/시험/발음/효과음/기록 로직
build.mjs         Vercel용 dist 빌드
dev-server.mjs    로컬 테스트 서버
data/
  vocabulary.json  300단어 공통 데이터
source_data/
  원본 Excel
reference/
  기존 앱 화면 참고 이미지
```
