import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getUserGroups } from './useMessages';
import type { Message } from '../types';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Hook leve para contar mensagens não lidas.
 * Usa one-shot fetch em vez de subscription permanente, com polling a cada 5 min.
 */
export const useUnreadCount = () => {
    const { user, userProfile } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchUnreadCount = useCallback(async () => {
        if (!user || !userProfile) {
            setUnreadCount(0);
            return;
        }

        try {
            const userGroups = getUserGroups(userProfile);
            if (userGroups.length === 0 && userProfile.role !== 'SUPER_ADMIN') {
                return;
            }

            const { data } = await supabase
                .from('messages')
                .select('*')
                .order('createdAt', { ascending: false })
                .limit(100);

            const count = (data ?? []).reduce((acc, row) => {
                const msg = row as Message;
                const isFromMe = msg.senderId === user.id;
                const alreadyRead = msg.readBy?.includes(user.id) ?? false;
                const groups = msg.recipientGroups || [];
                const isRecipient = groups.some(g => userGroups.includes(g)) || msg.recipientId === user.id;
                return (!isFromMe && !alreadyRead && isRecipient) ? acc + 1 : acc;
            }, 0);

            setUnreadCount(count);
        } catch (err) {
            console.warn('useUnreadCount: erro ao buscar contagem', err);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, userProfile?.uid, userProfile?.role]);

    useEffect(() => {
        if (!user) {
            setUnreadCount(0);
            return;
        }

        fetchUnreadCount();

        timerRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchUnreadCount();
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
            } else {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, fetchUnreadCount]);

    const refresh = useCallback(() => {
        fetchUnreadCount();
    }, [fetchUnreadCount]);

    return { unreadCount, refresh };
};
