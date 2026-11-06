import { useEffect, useMemo, useState } from 'react';
import { api, getApiErrorMessage } from '../services/api.js';
import { AuthContext } from './authContext.js';

let initialSessionRequest;

function requestCurrentUser() {
  if (!initialSessionRequest) {
      initialSessionRequest = (async () => {
        try {
          const { data } = await api.get('/auth/me');
          return { user: data.data.user, error: '' };
        } catch (error) {
          if (error.response?.status !== 401) {
            return {
              user: null,
              error: getApiErrorMessage(
                error,
                'We could not check your session. Check that the backend is running and try again.'
              ),
            };
          }

          try {
            await api.post('/auth/refresh');
            const { data } = await api.get('/auth/me');
            return { user: data.data.user, error: '' };
          } catch (refreshError) {
            if (refreshError.response?.status === 401) return { user: null, error: '' };
            return {
              user: null,
              error: getApiErrorMessage(
                refreshError,
                'We could not check your session. Check that the backend is running and try again.'
              ),
            };
          }
        }
      })().finally(() => {
        initialSessionRequest = undefined;
      });
  }

  return initialSessionRequest;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [authNotice, setAuthNotice] = useState('');

  useEffect(() => {
      let active = true;

      requestCurrentUser().then(({ user: currentUser, error }) => {
        if (active) {
          setUser(currentUser);
          setSessionError(error);
          setIsLoading(false);
        }
      });

      return () => {
        active = false;
      };
  }, [sessionAttempt]);

  const value = useMemo(
      () => ({
        user,
        isLoading,
        sessionError,
        authNotice,
        setUser(nextUser, notice = '') {
          setUser(nextUser);
          setSessionError('');
          setAuthNotice(notice);
        },
        retrySession() {
          setIsLoading(true);
        setSessionError('');
        setSessionAttempt((attempt) => attempt + 1);
      },
      async logout() {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          if (error.response?.status !== 401) throw error;

          try {
            await api.post('/auth/refresh');
            await api.post('/auth/logout');
          } catch (refreshError) {
            if (refreshError.response?.status !== 401) throw refreshError;
          }
        }

        setUser(null);
        setSessionError('');
        setAuthNotice('');
      },
    }),
    [user, isLoading, sessionError, authNotice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
