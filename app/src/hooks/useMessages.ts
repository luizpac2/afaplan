import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCourseStore } from '../store/useCourseStore';
import { type Message, type MessageGroup, type UserProfile } from '../types';

export const getUserGroups = (profile: UserProfile | null): MessageGroup[] => {
    if (!profile) return [];
    const groups: MessageGroup[] = [];

    if (profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN') {
        groups.push('ADMINS');
    }
    if (profile.role === 'SUPER_ADMIN') {
        groups.push('DEVELOPER');
    }
    if (profile.role === 'DOCENTE') {
        groups.push('INSTRUCTORS');
    }
    if (profile.role === 'CADETE') {
        groups.push('CADETS_ALL');
        if (profile.squadron?.includes('1º')) groups.push('CADETS_1');
        if (profile.squadron?.includes('2º')) groups.push('CADETS_2');
        if (profile.squadron?.includes('3º')) groups.push('CADETS_3');
        if (profile.squadron?.includes('4º')) groups.push('CADETS_4');
    }
    return groups;
};

export const useMessages = () => {
    const { user, userProfile } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !userProfile) {
            setLoading(false);
            return;
        }

        const userGroups = getUserGroups(userProfile);

        if (userGroups.length === 0 && userProfile.role !== 'SUPER_ADMIN') {
            setLoading(false);
            return;
        }

        const fetchMessages = async () => {
            try {
                const { data, error: fetchError } = await supabase
                    .from('messages')
                    .select('*')
                    .overlaps('recipient_groups', userGroups)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (fetchError) throw fetchError;

                const allMessages = (data ?? []) as Message[];
                const relevantMessages = allMessages.filter(msg => {
                    const groups = msg.recipientGroups || [];
                    const isRecipient = groups.some(g => userGroups.includes(g)) || (msg.recipientId === user.id);
                    const isSender = msg.senderId === user.id;
                    return isRecipient || isSender;
                });

                setMessages(relevantMessages);
                setError(null);
            } catch (err: any) {
                console.error("Supabase error:", err);
                setError(`Erro de conexão: ${err.message}`);
            }
            setLoading(false);
        };

        void fetchMessages();

        const channel = supabase
            .channel('messages_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
                void fetchMessages();
            })
            .subscribe();

        return () => { void supabase.removeChannel(channel); };
    }, [user, userProfile]);

    const sendMessage = async (subject: string, content: string, recipientGroups: MessageGroup[], recipientId?: string) => {
        if (!user || !userProfile) return;

        let senderDetail = userProfile.squadron;

        if (userProfile.squadron) {
            const match = userProfile.squadron.match(/(\d+)(?:º|ª|\s|esquadrão)/i);
            if (match) {
                const year = parseInt(match[1]);
                const currentYear = new Date().getFullYear();
                const targetEntryYear = currentYear - (year - 1);
                const cohorts = useCourseStore.getState().cohorts;
                const cohort = cohorts.find(c => Number(c.entryYear) === targetEntryYear);
                if (cohort) {
                    senderDetail = `${userProfile.squadron} - ${cohort.name}`;
                }
            }
        }

        await supabase.from('messages').insert({
            sender_id: user.id,
            sender_name: userProfile.displayName || 'Usuário',
            sender_role: userProfile.role,
            recipient_groups: recipientGroups,
            recipient_id: recipientId ?? null,
            subject,
            content,
            created_at: new Date().toISOString(),
            read_by: [],
            sender_detail: senderDetail ?? null,
        });
    };

    const markAsRead = async (messageId: string) => {
        if (!user) return;
        const msg = messages.find(m => m.id === messageId);
        const currentReadBy: string[] = msg?.readBy ?? [];
        if (currentReadBy.includes(user.id)) return;
        await supabase
            .from('messages')
            .update({ read_by: [...currentReadBy, user.id] })
            .eq('id', messageId);
    };

    return { messages, loading, error, sendMessage, markAsRead };
};
