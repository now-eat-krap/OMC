// 앱 라우터 설정
// react-router를 사용하여 페이지 네비게이션 처리
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import BacktestPage from './pages/BacktestPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/backtest" element={<BacktestPage />} />
    </Routes>
  )
}

export default App
