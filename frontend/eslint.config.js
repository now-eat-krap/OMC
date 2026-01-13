import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier'

/**
 * Airbnb 스타일 가이드 기반 ESLint 설정
 * ESLint 9 Flat Config 호환
 * 
 * 참고: eslint-config-airbnb가 ESLint 9를 아직 완전 지원하지 않으므로
 * Airbnb 규칙을 직접 설정으로 적용
 */
export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // ============================================
      // Airbnb 스타일 가이드 핵심 규칙
      // ============================================
      
      // 코드 품질 (Best Practices)
      'eqeqeq': ['error', 'always', { null: 'ignore' }],  // === 강제
      'no-console': 'warn',                               // console 경고
      'no-debugger': 'error',                             // debugger 금지
      'no-alert': 'warn',                                 // alert 경고
      'no-eval': 'error',                                 // eval 금지
      'no-implied-eval': 'error',                         // 암시적 eval 금지
      'no-extend-native': 'error',                        // 네이티브 객체 확장 금지
      'no-new-wrappers': 'error',                         // new String/Number/Boolean 금지
      'no-return-await': 'error',                         // 불필요한 return await 금지
      'no-throw-literal': 'error',                        // Error 객체만 throw
      'prefer-promise-reject-errors': 'error',            // Error 객체로 reject
      'curly': ['error', 'all'],                          // 중괄호 필수
      
      // 변수 (Variables)
      'no-var': 'error',                                  // var 금지
      'prefer-const': 'error',                            // const 우선
      'no-shadow': 'off',                                 // TS 버전 사용
      'no-unused-vars': 'off',                            // TS 버전 사용
      
      // ES6+
      'arrow-body-style': ['error', 'as-needed'],         // 화살표 함수 바디 스타일
      'prefer-arrow-callback': 'error',                   // 콜백에 화살표 함수
      'prefer-template': 'error',                         // 템플릿 리터럴 사용
      'no-useless-concat': 'error',                       // 불필요한 문자열 연결 금지
      'object-shorthand': ['error', 'always'],            // 객체 축약 문법
      'prefer-destructuring': ['warn', {                  // 구조분해 권장
        array: false,
        object: true,
      }],
      'prefer-rest-params': 'error',                      // arguments 대신 rest
      'prefer-spread': 'error',                           // apply 대신 spread
      
      // 스타일 (Stylistic)
      'camelcase': ['warn', { properties: 'never' }],     // 카멜케이스
      'no-underscore-dangle': 'off',                      // _ 접두사 허용
      'no-nested-ternary': 'off',                         // 중첩 삼항 허용 (JSX에서 자주 사용)
      'no-unneeded-ternary': 'error',                     // 불필요한 삼항 금지
      
      // ============================================
      // TypeScript 규칙
      // ============================================
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-shadow': 'error',            // 변수 섀도잉 금지
      '@typescript-eslint/no-explicit-any': 'warn',       // any 경고
      '@typescript-eslint/consistent-type-imports': [     // import type {} 강제
        'warn',
        { prefer: 'type-imports' }
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn', // ! 연산자 경고
      '@typescript-eslint/naming-convention': [           // 네이밍 컨벤션
        'warn',
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
      ],
      
      // ============================================
      // React 규칙
      // ============================================
      'react-hooks/rules-of-hooks': 'error',              // Hooks 규칙
      'react-hooks/exhaustive-deps': 'warn',              // useEffect 의존성
      'react-refresh/only-export-components': [           // 컴포넌트만 export (HMR)
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  // Prettier와 충돌하는 ESLint 규칙 비활성화 (항상 마지막에 위치해야 함)
  eslintConfigPrettier,
])
