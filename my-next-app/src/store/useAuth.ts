import { User } from '@lib/generated';
import { normalizeUUID } from '@lib/uuid';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => {
        localStorage.setItem('auth-token', token ?? '');
        set({ token });
      },
      setUser: (user) => {
        // Нормализуем ID пользователя при сохранении
        const normalizedUser = user ? {
          ...user,
          id: normalizeUUID(user.id)
        } : null;
        set({ user: normalizedUser });
      },
      clearAuth: () => {
        localStorage.removeItem('auth-token');
        set({ token: null, user: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Отдельные методы для работы с токеном
export const setAuthToken = (token: string) => {
  localStorage.setItem('auth-token', token); // Простое хранилище
  useAuth.setState({ token });
};

export const clearAuthToken = () => {
  localStorage.removeItem('auth-token');
  useAuth.setState({ token: null });
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth-token') || useAuth.getState().token;
};