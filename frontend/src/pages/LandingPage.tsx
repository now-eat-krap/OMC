// 랜딩 페이지 (메인 페이지)
// 프리미엄 미래적 디자인, Hyperspeed 배경, Scroll Snap 섹션
import { useRef, useEffect, useCallback, useState } from 'react'
import Hyperspeed from '../components/effects/Hyperspeed'
import ElectricBorder from '../components/effects/ElectricBorder'
import StarBorder from '../components/effects/StarBorder'
import AnimatedContent from '../components/effects/AnimatedContent'
import Navbar from '../components/layout/Navbar'
import { Link } from 'react-router-dom'

// 전체 섹션 수
const TOTAL_SECTIONS = 4

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const isScrolling = useRef(false)

  // 특정 섹션으로 즉시 스크롤
  const scrollToSection = useCallback(
    (sectionIndex: number) => {
      if (!containerRef.current || isScrolling.current) {
        return
      }

      const clampedIndex = Math.max(0, Math.min(sectionIndex, TOTAL_SECTIONS - 1))
      if (clampedIndex === currentSection) {
        return
      }

      isScrolling.current = true
      setCurrentSection(clampedIndex)

      const sectionHeight = window.innerHeight
      containerRef.current.scrollTo({
        top: clampedIndex * sectionHeight,
        behavior: 'smooth',
      })

      // 스크롤 완료 후 다시 스크롤 허용 (딜레이)
      setTimeout(() => {
        isScrolling.current = false
      }, 800)
    },
    [currentSection]
  )

  // wheel 이벤트로 섹션 전환
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      if (isScrolling.current) {
        return
      }

      if (e.deltaY > 0) {
        // 아래로 스크롤
        scrollToSection(currentSection + 1)
      } else if (e.deltaY < 0) {
        // 위로 스크롤
        scrollToSection(currentSection - 1)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [currentSection, scrollToSection])

  return (
    <div
      id="snap-main-container"
      ref={containerRef}
      className="h-screen overflow-y-auto"
      style={{ scrollBehavior: 'smooth' }}
    >
      {/* 네비게이션 바 - 고정 */}
      <Navbar />

      {/* ===== 섹션 1: 히어로 ===== */}
      <section className="relative w-full h-screen snap-start snap-always bg-black text-white">
        {/* Hyperspeed 배경 */}
        <div className="absolute inset-0 z-0">
          <Hyperspeed
            effectOptions={{
              distortion: 'turbulentDistortion',
              length: 400,
              roadWidth: 10,
              islandWidth: 2,
              lanesPerRoad: 4,
              fov: 90,
              fovSpeedUp: 150,
              speedUp: 2,
              carLightsFade: 0.4,
              totalSideLightSticks: 20,
              lightPairsPerRoadWay: 40,
              shoulderLinesWidthPercentage: 0.05,
              brokenLinesWidthPercentage: 0.1,
              brokenLinesLengthPercentage: 0.5,
              lightStickWidth: [0.12, 0.5],
              lightStickHeight: [1.3, 1.7],
              movingAwaySpeed: [60, 80],
              movingCloserSpeed: [-120, -160],
              carLightsLength: [400 * 0.03, 400 * 0.2],
              carLightsRadius: [0.05, 0.14],
              carWidthPercentage: [0.3, 0.5],
              carShiftX: [-0.8, 0.8],
              carFloorSeparation: [0, 5],
              colors: {
                roadColor: 0x080808,
                islandColor: 0x0a0a0a,
                background: 0x0a0a0f,
                shoulderLines: 0xffffff,
                brokenLines: 0xffffff,
                leftCars: [0xa855f7, 0x7c3aed, 0xc084fc],
                rightCars: [0x06b6d4, 0x0891b2, 0x22d3ee],
                sticks: 0xa855f7,
              },
            }}
          />
        </div>

        {/* 그라데이션 오버레이 */}
        <div className="absolute inset-0 pointer-events-none z-[5]">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/70"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30"></div>
        </div>

        {/* 히어로 콘텐츠 */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
          <div className="text-center max-w-5xl mx-auto">
            {/* 서브 타이틀 */}
            <AnimatedContent
              distance={50}
              direction="vertical"
              reverse={false}
              duration={0.8}
              delay={0.2}
              threshold={0.1}
            >
              <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                <span className="text-sm text-purple-300 font-medium tracking-wide">
                  AI 기반 전략 분석 플랫폼
                </span>
              </div>
            </AnimatedContent>

            {/* 메인 타이틀 */}
            <AnimatedContent
              distance={80}
              direction="vertical"
              reverse={false}
              duration={1}
              delay={0.4}
              threshold={0.1}
            >
              <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight leading-none mb-8">
                <span className="block text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                  YOUR STRATEGY
                </span>
                <span className="block mt-2 bg-gradient-to-r from-purple-400 via-violet-500 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(168,85,247,0.4)]">
                  VERIFIED
                </span>
              </h1>
            </AnimatedContent>

            {/* 설명 */}
            <AnimatedContent
              distance={60}
              direction="vertical"
              reverse={false}
              duration={0.8}
              delay={0.6}
              threshold={0.1}
            >
              <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed font-light">
                과거 데이터로 검증된 전략만이 미래의 수익을 보장합니다.
                <br className="hidden sm:block" />
                <span className="text-white/80">실시간 백테스팅</span>으로 당신의 트레이딩을
                혁신하세요.
              </p>
            </AnimatedContent>

            {/* CTA 버튼 */}
            <AnimatedContent
              distance={40}
              direction="vertical"
              reverse={false}
              duration={0.8}
              delay={0.8}
              threshold={0.1}
            >
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <StarBorder
                  as={Link}
                  to="/backtest"
                  color="#A855F7"
                  speed="4s"
                  thickness={5}
                  className="w-full sm:w-auto"
                >
                  <span className="flex items-center justify-center gap-2 font-bold text-lg">
                    백테스팅 시작
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </span>
                </StarBorder>
              </div>
            </AnimatedContent>
          </div>

          {/* 스크롤 인디케이터 */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
              <div className="w-1 h-2 bg-white/50 rounded-full"></div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 섹션 2: 기능 소개 ===== */}
      <section className="relative w-full h-screen snap-start snap-always bg-[#0A0A0F] text-white flex items-center justify-center">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedContent
            distance={60}
            direction="vertical"
            reverse={false}
            duration={0.8}
            threshold={0.3}
          >
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold mb-4">
                <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  왜 OMC인가?
                </span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                복잡한 코딩 없이, 누구나 쉽게 전략을 검증하세요
              </p>
            </div>
          </AnimatedContent>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 기능 1: 노코드 */}
            <AnimatedContent
              distance={80}
              direction="vertical"
              reverse={false}
              duration={0.8}
              delay={0.1}
              threshold={0.3}
              className="h-full"
            >
              <ElectricBorder
                color="#A855F7"
                speed={1}
                chaos={0.5}
                thickness={2}
                style={{ borderRadius: 16, height: '100%' }}
                className="h-full"
              >
                <div className="p-8 h-full flex flex-col">
                  <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6">
                    <svg
                      className="w-7 h-7 text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">코딩 없이 클릭만으로</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    복잡한 프로그래밍 지식이 필요 없습니다. 직관적인 UI로 전략을 설정하고 바로
                    테스트하세요.
                  </p>
                </div>
              </ElectricBorder>
            </AnimatedContent>

            {/* 기능 2: AI */}
            <AnimatedContent
              distance={80}
              direction="vertical"
              reverse={false}
              duration={0.8}
              delay={0.2}
              threshold={0.3}
              className="h-full"
            >
              <ElectricBorder
                color="#06B6D4"
                speed={1.0}
                chaos={0.5}
                thickness={2}
                style={{ borderRadius: 16, height: '100%' }}
                className="h-full"
              >
                <div className="p-8 h-full flex flex-col">
                  <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-6">
                    <svg
                      className="w-7 h-7 text-cyan-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">
                    AI 전략 추천
                    <span className="ml-2 px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-full">
                      Coming Soon
                    </span>
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    AI가 과거 데이터를 분석하여 최적의 전략 파라미터를 추천해드립니다.
                  </p>
                </div>
              </ElectricBorder>
            </AnimatedContent>

            {/* 기능 3: 무료 */}
            <AnimatedContent
              distance={80}
              direction="vertical"
              reverse={false}
              duration={0.8}
              delay={0.3}
              threshold={0.3}
              className="h-full"
            >
              <ElectricBorder
                color="#7C3AED"
                speed={0.8}
                chaos={0.4}
                thickness={2}
                style={{ borderRadius: 16, height: '100%' }}
                className="h-full"
              >
                <div className="p-8 h-full flex flex-col">
                  <div className="w-14 h-14 rounded-xl bg-violet-500/20 flex items-center justify-center mb-6">
                    <svg
                      className="w-7 h-7 text-violet-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white">완전 무료</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    모든 기능을 무료로 제공합니다. 숨겨진 비용이나 제한 없이 마음껏 사용하세요.
                  </p>
                </div>
              </ElectricBorder>
            </AnimatedContent>
          </div>
        </div>
      </section>

      {/* ===== 섹션 3: 통계 ===== */}
      <section className="relative w-full h-screen snap-start snap-always bg-gradient-to-b from-[#0A0A0F] to-[#1a0a2e] text-white flex items-center justify-center">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <AnimatedContent
            distance={60}
            direction="vertical"
            reverse={false}
            duration={0.8}
            threshold={0.3}
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-4">
              <span className="text-white">숫자로 보는 </span>
              <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                OMC
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-16">
              수천 명의 트레이더가 이미 OMC를 신뢰합니다
            </p>
          </AnimatedContent>

          <AnimatedContent
            distance={80}
            direction="vertical"
            reverse={false}
            duration={0.8}
            delay={0.2}
            threshold={0.3}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="p-8">
                <div className="text-5xl md:text-6xl font-black text-white mb-2">10K+</div>
                <div className="text-purple-400 uppercase tracking-wider text-sm">
                  백테스트 완료
                </div>
              </div>
              <div className="p-8">
                <div className="text-5xl md:text-6xl font-black text-white mb-2">99.9%</div>
                <div className="text-purple-400 uppercase tracking-wider text-sm">정확도</div>
              </div>
              <div className="p-8">
                <div className="text-5xl md:text-6xl font-black text-white mb-2">&lt;1s</div>
                <div className="text-purple-400 uppercase tracking-wider text-sm">분석 속도</div>
              </div>
              <div className="p-8">
                <div className="text-5xl md:text-6xl font-black text-white mb-2">24/7</div>
                <div className="text-purple-400 uppercase tracking-wider text-sm">서비스 운영</div>
              </div>
            </div>
          </AnimatedContent>

          {/* CTA */}
          <AnimatedContent
            distance={40}
            direction="vertical"
            reverse={false}
            duration={0.8}
            delay={0.4}
            threshold={0.3}
          >
            <div className="mt-16">
              <StarBorder as={Link} to="/backtest" color="#A855F7" speed="4s" thickness={3}>
                <span className="flex items-center gap-2 font-bold text-xl">
                  지금 시작하기
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
              </StarBorder>
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* ===== 섹션 4: Footer ===== */}
      <section className="relative w-full h-screen snap-start snap-always bg-[#0A0A0F] text-white flex flex-col items-center justify-center">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <AnimatedContent
            distance={60}
            direction="vertical"
            reverse={false}
            duration={0.8}
            threshold={0.3}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              당신의 전략, 지금 바로 검증하세요
            </h2>
            <p className="text-gray-400 text-lg mb-12">
              무료로 시작하고, 성공적인 트레이딩을 경험하세요.
            </p>
          </AnimatedContent>

          <AnimatedContent
            distance={40}
            direction="vertical"
            reverse={false}
            duration={0.8}
            delay={0.2}
            threshold={0.3}
          >
            <StarBorder as={Link} to="/backtest" color="#ffffff" speed="4s" thickness={3}>
              <span className="font-bold text-xl">무료로 시작하기</span>
            </StarBorder>
          </AnimatedContent>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 text-center text-gray-500 text-sm">
          © 2024 One More Coin. All rights reserved.
        </div>
      </section>
    </div>
  )
}
