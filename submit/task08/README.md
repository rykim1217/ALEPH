# 과제08 카드3 — 패스키 로그인

## 구현
- 카드1/2의 공개·비공개 구분과 패스키 등록 기능 유지
- 로그인 요청마다 서버가 새 authentication challenge 발급
- 등록된 공개키로 WebAuthn 서명 검증
- challenge는 인증 시도 후 삭제하여 재사용(replay) 방지
- 성공 시 8시간 HttpOnly / Secure / SameSite=Lax 세션 쿠키 발급
- 서버 DB에는 세션 토큰 원문이 아닌 SHA-256 해시만 저장
- `/api/private`는 유효 세션이 없으면 401, 있으면 비공개 데이터 반환
- 로그인 성공 직후 PORTFOLIO ARCHIVE / LEARNING LOG / PRIVATE SCHEDULE 내용이 버튼 추가 클릭 없이 바로 표시
- 로그아웃 시 DB 세션 삭제 + 쿠키 만료 + 비공개 내용 즉시 숨김

## 집 개인 PC에서 최종 확인할 순서
1. Windows Hello(PIN)가 가능한 개인 PC에서 패스키 1개 등록
2. `패스키 로그인` → Windows Hello 인증 → 세 카드가 OPEN으로 바뀌며 실제 내용 표시
3. 로그아웃 → 세 카드가 다시 LOCKED, `/api/private`는 401
4. Network에서 `login-options`를 두 번 요청해 challenge가 매번 다른지 확인
5. 성공한 `login-verify` 요청을 재전송하면 challenge가 이미 소비되어 거절되는지 확인

## DB
Vercel에 연결된 Neon PostgreSQL의 `DATABASE_URL` 사용.

## Card 4 — lost device / passkey recovery
- 한 계정에 패스키를 2개 이상 등록할 수 있습니다.
- 등록 목록에는 사람이 정한 이름과 등록 시각이 표시됩니다.
- 로그인한 상태에서만 등록 목록의 `삭제` 동작을 사용할 수 있습니다.
- 삭제 API는 현재 세션의 사용자 소유 credential만 삭제합니다.
- 삭제된 credential은 DB에서 제거되므로 이후 인증 허용 목록에 포함되지 않습니다.
- 마지막 패스키를 삭제하면 화면/API에서 새 패스키 등록이 필요하다는 안내를 제공합니다.


## 카드 5 — 계정 격리 검증
- 기본 주소는 A 계정(`rayeon-demo`)입니다.
- `?account=review-demo`는 합성 B 계정(`review-demo`)의 패스키 등록/로그인 검증용입니다.
- 비공개 데이터는 `t08_private_items.user_id`로 분리 저장합니다.
- `/api/private`는 요청의 account 값이 아니라 HttpOnly 세션의 user_id만 사용합니다.
- `/api/private?account=다른계정ID`를 보내도 `requestedAccountIgnored: true`와 함께 현재 세션 계정 자료만 반환합니다.
- 인증 실패/401/replay 거부 경로는 비공개 데이터를 변경하지 않으므로 거부 전후 `itemCount`가 유지됩니다.
- 두 계정 자료는 모두 과제 검증용 합성 데이터이며 실제 개인정보를 사용하지 않습니다.
