# 쵸텐짱의 제미나이 번역기 (만화 번역기)

Gemini 이미지 모델로 만화/웹툰 페이지의 말풍선 텍스트를 다른 언어로 번역해서 이미지 위에 그대로 다시 그려주는 웹 앱입니다. 원문을 완전히 지우고 번역문으로 재작화(typeset)하는 방식이라, 결과물이 바로 완성된 번역 페이지가 됩니다.

## 기능

- 이미지를 여러 장 올려 **일괄 번역**(자동 번역) 가능
- 원문/번역 언어 선택: 일본어·한국어·영어·중국어·스페인어·프랑스어·독일어·베트남어·태국어, 좌우 스왑 버튼 지원
- 세로쓰기(일본어) 텍스트 인식 등 만화 특유의 조판 규칙 고려
- **가리기(censor) 브러시**로 특정 영역을 흰색으로 덮은 뒤 번역 — 검열/수정 용도
- 실행취소(undo)로 이전 상태 복원
- 완료된 이미지를 압축(ZIP)해서 한 번에 다운로드
- 초텐쨩/아메 캐릭터가 진행 상황에 맞춰 말풍선으로 리액션, 배경음악(BGM) 플레이어 내장

## 스크린샷

*(추가 예정)*

## 실행 방법

**요구 사항**: Node.js

```bash
npm install
```

`.env.local`에 자신의 Gemini API 키를 설정합니다.

```
GEMINI_API_KEY=여기에_발급받은_키
```

```bash
npm run dev
```

API 키는 [Google AI Studio](https://aistudio.google.com/)에서 발급받으며, 로컬 `.env.local`에만 저장됩니다(git에 커밋되지 않음 — `.env.example`은 값이 없는 템플릿입니다).

## 기술 스택

- React + TypeScript + Vite
- [`@google/genai`](https://www.npmjs.com/package/@google/genai) — Gemini 이미지 생성/편집 모델(`gemini-2.5-flash-image` 등)로 말풍선 텍스트 삭제 + 번역문 재작화
- JSZip — 번역 완료 이미지 일괄 압축 다운로드
