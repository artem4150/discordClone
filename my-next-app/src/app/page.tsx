// app/page.tsx
'use client';
import Link from 'next/link'

// Ваш ASCII-арт (каждая строка одного блока)
const asciiArt = `
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⣤⣶⣶⣾⣿⣿⣿⣿⣷⣶⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣶⣾⣿⣿⣿⣿⣷⣶⣶⣤⣄⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢀⣠⡴⠾⠟⠋⠉⠉⠀⠀⠀⠀⠀⠀⠀⠈⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠉⠉⠙⠛⠷⢦⣄⡀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠘⠋⠁⠀⠀⢀⣀⣤⣶⣖⣒⣒⡲⠶⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⠶⢖⣒⣒⣲⣶⣤⣀⡀⠀⠀⠈⠙⠂⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⣠⢖⣫⣷⣿⣿⣿⣿⣿⣿⣶⣤⡙⢦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡴⢋⣤⣾⣿⣿⣿⣿⣿⣿⣾⣝⡲⣄⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⣄⣀⣠⢿⣿⣿⣿⣿⣿⣿⣿⡿⠟⠻⢿⣿⣿⣦⣳⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣟⣴⣿⣿⡿⠟⠻⢿⣿⣿⣿⣿⣿⣿⣿⡻⣄⣀⣤⠀⠀⠀
⠀⠀⠀⠈⠟⣿⣿⣿⡿⢻⣿⣿⣿⠃⠀⠀⠀⠀⠙⣿⣿⣿⠓⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠚⣿⣿⣿⠋⠀⠀⠀⠀⠘⣿⣿⣿⡟⢿⣿⣿⣟⠻⠁⠀⠀⠀
⠤⣤⣶⣶⣿⣿⣿⡟⠀⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⢻⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⡏⠀⠀⠀⠀⠀⠀⣹⣿⣿⣷⠈⢻⣿⣿⣿⣶⣦⣤⠤
⠀⠀⠀⠀⠀⢻⣟⠀⠀⣿⣿⣿⣿⡀⠀⠀⠀⠀⢀⣿⣿⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢻⣿⣿⡀⠀⠀⠀⠀⢀⣿⣿⣿⣿⠀⠀⣿⡟⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠻⣆⠀⢹⣿⠟⢿⣿⣦⣤⣤⣴⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⡿⢷⣤⣤⣤⣴⣿⣿⣿⣿⡇⠀⣰⠟⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠙⠂⠀⠙⢀⣀⣿⣿⣿⣿⣿⣿⣿⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⠁⠀⣻⣿⣿⣿⣿⣿⣿⠏⠀⠘⠃⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡈⠻⠿⣿⣿⣿⡿⠟⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⠻⢿⣿⣿⣿⠿⠛⢁⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠚⠛⣶⣦⣤⣤⣤⡤⠆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠰⢤⣤⣤⣤⣶⣾⠛⠓⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
`.trim()

// Сколько раз повторяем арт по горизонтали и по вертикали
const H_REPEAT = 10
const V_REPEAT = 50

// Генерим одну «полную» строку, где каждая строчка asciiArt соединена через 5 пробелов
const oneRow = asciiArt
  .split('\n')
  .map(line => Array(H_REPEAT).fill(line).join('     '))
  .join('\n')

// Затем дублируем этот блок V_REPEAT раз вниз
const tiledAscii = Array(V_REPEAT).fill(oneRow).join('\n')

export default function WelcomePage() {
  return (
    <>
      <style jsx global>{`
        @keyframes scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>

      <main className="relative flex items-center justify-center h-screen bg-black overflow-hidden">
        <pre
          className="absolute inset-0 m-0 p-0 w-full h-full text-xs font-mono leading-tight text-blue-300 opacity-50 select-none"
          style={{ animation: 'scroll 60s linear infinite' }}
        >
          {tiledAscii}
        </pre>

        <div className="relative z-10 flex flex-col items-center">
          <h1 className="text-5xl font-extrabold text-white mb-8">
            Добро пожаловать!
          </h1>
          <div className="flex space-x-4">
            <Link
              href="/login"
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Регистрация
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
