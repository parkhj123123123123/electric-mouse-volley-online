# 전기쥐 배구 온라인

서로 다른 Wi-Fi에서도 플레이할 수 있는 2인 온라인 배구 게임입니다.

## 기능

- 방 만들기 / 5자리 방 코드 참가
- 서로 다른 Wi-Fi / 모바일 데이터에서도 플레이
- PC 키보드 조작
- 휴대폰 터치 조작
- 서버에서 공/충돌/점수 계산
- 별도 이미지 파일 없이 바로 실행

## PC에서 테스트

Node.js 18 이상이 필요합니다.

```bash
npm install
npm start
```

브라우저에서:

```text
http://localhost:3000
```

로 접속하세요.

## Render 배포

이 저장소에는 `render.yaml`이 포함되어 있습니다. Render에서 Blueprint로 저장소를 연결하면 웹 서비스가 생성됩니다.

수동 설정 시:

- Build Command: `npm install`
- Start Command: `npm start`
- Environment: Node
- Port: `process.env.PORT` 자동 사용

## 조작

PC:
- A / D 또는 ← / → : 이동
- W / ↑ / Space : 점프

모바일:
- 화면 아래 ◀ ▶ JUMP 버튼
