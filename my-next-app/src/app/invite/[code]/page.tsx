'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../store/useAuth';
import api, { guild as guildApi } from '../../../lib/api';
import { normalizeUUID } from '../../../lib/uuid';

export default function InvitePage() {
  const router = useRouter();
  const { code } = useParams() as { code: string }; // Деструктуризация параметров
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guild, setGuild] = useState<any>(null);

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        // Загружаем информацию о приглашении
        const response = await guildApi.getInvitation(code);
        
        // Нормализуем UUID гильдии
        const normalizedGuild = {
          ...response.data.guild,
          id: normalizeUUID(response.data.guild.id)
        };
        
        setGuild(normalizedGuild);
        setLoading(false);
      } catch (err: any) {
        // Улучшенная обработка ошибок
        if (err.response?.status === 404) {
          setError('Invitation not found');
        } else if (err.response?.status === 410) {
          setError('Invitation expired');
        } else {
          setError('Failed to load invitation. Please try again later.');
        }
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [code]);

  const acceptInvitation = async () => {
    if (!user || !token) {
      // Сохраняем код приглашения для использования после входа
      localStorage.setItem('inviteCode', code);
      router.push(`/login?redirect=/invite/${code}`);
      return;
    }

    try {
      // Принимаем приглашение
      await guildApi.acceptInvitation(code);
      
      // Перенаправляем на сервер
      if (guild) {
        router.push(`/dashboard?guild=${guild.id}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      // Улучшенная обработка ошибок
      if (err.response?.status === 401) {
        setError('Please sign in to accept invitation');
      } else if (err.response?.status === 410) {
        setError('Invitation has expired');
      } else if (err.response?.status === 409) {
        setError('Invitation already used');
      } else {
        setError('Failed to accept invitation. Please try again.');
      }
    }
  };

  // Остальной код без изменений...
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-800">
        <div className="text-white">Loading invitation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-800">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800">
      <div className="bg-gray-700 p-8 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-white">Server Invitation</h2>
        <p className="mb-6 text-gray-300">
          You've been invited to join the server: <strong className="text-white">{guild?.name}</strong>
        </p>
        
        <button
          onClick={acceptInvitation}
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {user ? 'Join Server' : 'Sign In to Join'}
        </button>
      </div>
    </div>
  );
}