// app/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [username, setUsername] = useState('');      // новое состояние
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      alert('Пароли не совпадают');
      return;
    }
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username,                                  // передаём имя пользователя
          email, 
          password 
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Ошибка регистрации');
      }
      router.push('/login');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white p-6 rounded-lg shadow"
      >
        <h2 className="text-2xl font-semibold mb-4">Регистрация</h2>

        {/* Новое поле для имени пользователя */}
        <label className="block mb-2">
          <span className="text-sm">Имя пользователя</span>
          <input
            type="text"
            required
            className="mt-1 block w-full border rounded px-3 py-2"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </label>

        <label className="block mb-2">
          <span className="text-sm">Email</span>
          <input
            type="email"
            required
            className="mt-1 block w-full border rounded px-3 py-2"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </label>

        <label className="block mb-2">
          <span className="text-sm">Пароль</span>
          <input
            type="password"
            required
            className="mt-1 block w-full border rounded px-3 py-2"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm">Подтвердите пароль</span>
          <input
            type="password"
            required
            className="mt-1 block w-full border rounded px-3 py-2"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
          />
        </label>

        <button
          type="submit"
          className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Зарегистрироваться
        </button>
      </form>
    </div>
  );
}
