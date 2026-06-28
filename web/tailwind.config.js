/** @type {import('tailwindcss').Config} */
// MyFriend「温暖知己」设计令牌
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        bg: '#FBF8F4',        // 暖纸白底
        paper: '#F5F0E8',     // 略深的纸色（卡内分隔 / 反色文字）
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#2A2438', // 梅墨主文字 / 深色侧栏
          soft: '#6B6480',    // 次级文字
          faint: '#9A93AB',   // 弱化文字
        },
        coral: {
          DEFAULT: '#FF6B5E', // 珊瑚主色（友好温度）
          deep: '#F0473A',
          soft: '#FFE5E1',
        },
        apricot: '#FFB088',   // 渐变伙伴
        sage: {
          DEFAULT: '#2FB59C', // 鼠尾草绿 · 记忆
          soft: '#DDF3EE',
        },
        lilac: {
          DEFAULT: '#8B7FF0', // 紫丁香 · 知识
          soft: '#EBE8FC',
        },
        line: '#ECE6DD',      // 暖色发丝线
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      borderWidth: {
        3: '3px',
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(42,36,56,0.08), 0 6px 24px -8px rgba(42,36,56,0.10)',
        lift: '0 8px 30px -6px rgba(42,36,56,0.16)',
        coral: '0 8px 24px -6px rgba(255,107,94,0.45)',
      },
      keyframes: {
        breathe: {
          '0%,100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.12)', opacity: '0.7' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'thread-dash': {
          to: { strokeDashoffset: '-16' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        breathe: 'breathe 3s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease both',
        'thread-dash': 'thread-dash 1.2s linear infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
