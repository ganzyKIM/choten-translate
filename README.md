# 쵸텐짱의 제미나이 번역기

만화·웹툰 페이지의 말풍선을 번역해서 이미지 위에 다시 그려주는 웹 앱.
원문을 지우고 번역문으로 재조판하기 때문에 결과물이 그대로 완성된 번역 페이지가 된다.

## 기능

- 이미지 여러 장을 큐에 올려 일괄 번역
- 일본어·한국어·영어·중국어·스페인어·프랑스어·독일어·베트남어·태국어 지원, 좌우 스왑 버튼
- 세로쓰기 일본어 등 만화 조판 규칙을 반영
- 가리기 브러시로 특정 영역을 흰색으로 덮고 번역
- 실행취소
- 완료본 ZIP 일괄 다운로드
- 초텐쨩·아메 캐릭터 리액션, BGM 플레이어

## 화면

배포판은 로그인이 필요해서 스크린샷으로 흐름만 정리했다.

### 일괄 번역 (한국어 → 일본어)

큐에 올린 순서대로 자동 번역된다.

![한국어→일본어 일괄 번역 진행 화면](docs/screenshot-batch-translate.jpg)

위 포스터의 결과물. 레이아웃과 서체 느낌을 유지한 채 텍스트만 일본어로 다시 그려진다.

<p align="center">
  <img src="docs/sample-translated-poster.webp" alt="한국어 포스터를 일본어로 번역한 결과물" width="480">
</p>

### 번역 결과 비교 (일본어 → 한국어)

일본어 라이트노벨 표지. 오른쪽 뷰어의 원본과 비교하면 세로쓰기 제목이 같은 자리에 한국어 세로 조판으로
다시 그려진 걸 볼 수 있다.

![일본어→한국어 번역 결과를 원본과 비교](docs/screenshot-compare-ja-kr.jpg)

### 가리기 브러시

세이프티 필터에 걸려 번역이 거부될 때, 문제되는 영역만 브러시로 가리고 나머지를 번역한다.

![가리기 브러시로 특정 영역을 가린 화면](docs/screenshot-censor-brush.jpg)

## 실행

```bash
npm install
```

`.env.local`에 [AI Studio](https://aistudio.google.com/)에서 발급받은 키를 넣는다.

```
GEMINI_API_KEY=발급받은_키
```

```bash
npm run dev
```

## 스택

React · TypeScript · Vite ·
[`@google/genai`](https://www.npmjs.com/package/@google/genai)(`gemini-2.5-flash-image` 계열로 말풍선 삭제 + 재조판) ·
JSZip
