// 서버가 주는 시각 문자열을 초 단위 UTC 타임스탬프로.
//
// 백엔드는 거래 시각을 "2026-01-12 10:00:00" 또는 "2026-01-12T10:00:00" 처럼
// 타임존 표기 없이 보내고, 의미는 UTC 다(캔들 타임스탬프와 같은 축).
// 이걸 new Date(str) 에 그대로 넣으면 브라우저가 로컬 시간으로 읽어서 한국에서는
// 9시간이 당겨진다. 15분봉이면 마커가 36봉 앞에 찍힌다.
// 타임존 표기가 이미 있으면(Z, +09:00) 그대로 둔다.
export function serverTimeToUnix(value: string): number {
  const iso = value.includes(' ') ? value.replace(' ', 'T') : value
  const hasZone = iso.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(iso)
  return new Date(hasZone ? iso : `${iso}Z`).getTime() / 1000
}
