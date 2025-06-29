// app/page.tsx
import Link from 'next/link';

export default function WelcomePage() {
  return (
    <main className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-indigo-100 to-white">
      <h1 className="text-4xl font-bold mb-8">Добро пожаловать!</h1>
      <div className="space-x-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
    </main>
  );
}
