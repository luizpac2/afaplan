import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMessages } from '../hooks/useMessages';
import { type Message, type MessageGroup } from '../types';
import { Mail, Send, Loader, Plus, Reply } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const groupLabels: Record<MessageGroup, string> = {
    'ADMINS': 'Administradores',
    'INSTRUCTORS': 'Docentes',
    'CADETS_ALL': 'Todos os Cadetes',
    'CADETS_1': '1º Esquadrão',
    'CADETS_2': '2º Esquadrão',
    'CADETS_3': '3º Esquadrão',

    'CADETS_4': '4º Esquadrão',
    'DEVELOPER': 'Desenvolvedor do Sistema'
};

export const Inbox = () => {
    const { user, userProfile } = useAuth();
    const { messages, loading, error, sendMessage, markAsRead } = useMessages();
    const { theme } = useTheme();
    const location = useLocation();

    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [composeOpen, setComposeOpen] = useState(location.state?.compose || false);
    const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
    const [replyRecipient, setReplyRecipient] = useState<{ id: string; name: string } | null>(null);

    // Compose State
    const [recipientGroup, setRecipientGroup] = useState<MessageGroup>(location.state?.defaultGroup || 'ADMINS');
    const [subject, setSubject] = useState(location.state?.defaultSubject || '');
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (location.state?.compose) {
            setComposeOpen(true);
            setSubject(location.state.defaultSubject || '');
            setRecipientGroup(location.state.defaultGroup || 'ADMINS');
            // Remove the state to not re-trigger it on un-related re-renders
            window.history.replaceState({}, '');
        }
    }, [location.state]);

    // Derived Lists
    const inboxMessages = messages.filter(m => m.senderId !== user?.id);
    const sentMessages = messages.filter(m => m.senderId === user?.id);
    const displayMessages = tab === 'inbox' ? inboxMessages : sentMessages;

    const isAdmin = userProfile?.role === 'SUPER_ADMIN' || userProfile?.role === 'ADMIN';
    const isSuperAdmin = userProfile?.role === 'SUPER_ADMIN';

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !content.trim()) return;

        setSending(true);
        try {
            // Allow recipient selection for everyone (Admins select group, others select Admin/Dev)
            if (replyRecipient) {
                await sendMessage(subject, content, [], replyRecipient.id);
            } else {
                const target = recipientGroup;
                await sendMessage(subject, content, [target]);
            }

            setComposeOpen(false);
            setReplyRecipient(null);
            setSubject('');
            setContent('');
            setTab('sent');
        } catch (error) {
            console.error(error);
            alert('Erro ao enviar mensagem.');
        } finally {
            setSending(false);
        }
    };

    const handleSelectMessage = (msg: Message) => {
        setSelectedMessage(msg);
        if (tab === 'inbox' && user && !msg.readBy?.includes(user.id)) {
            markAsRead(msg.id);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-full mb-4 text-red-500 dark:text-red-400">
                    <Mail size={32} />
                </div>
                <h3 className="text-lg  text-slate-800 dark:text-white">Erro ao carregar mensagens</h3>
                <p className="text-sm mt-2">{error}</p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col md:flex-row h-[calc(100vh-8rem)] rounded-2xl shadow-sm border overflow-hidden mx-4 md:mx-0 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            {/* Sidebar List */}
            <div className={`w-full md:w-80 border-r flex flex-col ${theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'} ${selectedMessage && 'hidden md:flex'}`}>
                <div className={`p-4 border-b flex justify-between items-center ${theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                    <h2 className={` text-lg ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Mensagens</h2>
                    <button
                        onClick={() => { setComposeOpen(true); setSelectedMessage(null); setReplyRecipient(null); }}
                        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-sm"
                        title="Nova Mensagem"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className={`flex p-2 gap-2 ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <button
                        onClick={() => { setTab('inbox'); setSelectedMessage(null); }}
                        className={`flex-1 py-1.5 text-sm  rounded-lg transition ${tab === 'inbox'
                            ? (theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm')
                            : (theme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200')}`}
                    >
                        Recebidas
                    </button>
                    <button
                        onClick={() => { setTab('sent'); setSelectedMessage(null); }}
                        className={`flex-1 py-1.5 text-sm  rounded-lg transition ${tab === 'sent'
                            ? (theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm')
                            : (theme === 'dark' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200')}`}
                    >
                        Enviadas
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {displayMessages.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                            Nenhuma mensagem.
                        </div>
                    ) : (
                        displayMessages.map(msg => {
                            const isRead = user && msg.readBy?.includes(user.id);
                            const recipientList = msg.recipientGroups?.map(g => groupLabels[g] || g).join(', ') || 'Sem destinatários';

                            // Show "Administração" if sender is admin
                            let displayName = msg.senderName;
                            if (msg.senderRole === 'SUPER_ADMIN' || msg.senderRole === 'ADMIN') {
                                displayName = 'Administração';
                            } else if (msg.senderDetail) {
                                displayName += ` (${msg.senderDetail})`;
                            }

                            return (
                                <div
                                    key={msg.id}
                                    onClick={() => handleSelectMessage(msg)}
                                    className={`p-4 border-b cursor-pointer transition-colors ${theme === 'dark' ? 'border-slate-700 hover:bg-blue-900/10' : 'border-slate-200 hover:bg-blue-50'} ${selectedMessage?.id === msg.id
                                        ? (theme === 'dark' ? 'bg-blue-900/20 border-l-4 border-l-blue-400' : 'bg-blue-50 border-l-4 border-l-blue-600')
                                        : 'border-l-4 border-l-transparent'} ${!isRead && tab === 'inbox'
                                            ? (theme === 'dark' ? 'bg-slate-800 ' : 'bg-white ')
                                            : (theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50/50')}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-sm truncate ${!isRead && tab === 'inbox'
                                            ? (theme === 'dark' ? 'text-slate-100 ' : 'text-slate-900 ')
                                            : (theme === 'dark' ? 'text-slate-300' : 'text-slate-700')}`}>
                                            {tab === 'inbox' ? displayName : `Para: ${recipientList}`}
                                        </span>
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                            {new Date(msg.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <p className={`text-sm truncate mb-1 ${!isRead && tab === 'inbox'
                                        ? (theme === 'dark' ? 'text-slate-100' : 'text-slate-900')
                                        : (theme === 'dark' ? 'text-slate-400' : 'text-slate-600')}`}>
                                        {msg.subject}
                                    </p>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Message Detail / Compose */}
            <div className={`flex-1 flex flex-col ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'} ${!selectedMessage && !composeOpen && 'hidden md:flex'}`}>
                {composeOpen ? (
                    <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-bottom-5">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className={`text-xl  ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>Nova Mensagem</h2>
                            <button onClick={() => setComposeOpen(false)} className={`transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                                Cancelar
                            </button>
                        </div>
                        <form onSubmit={handleSend} className="flex-1 flex flex-col gap-4">
                            <div>
                                <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Para</label>
                                {replyRecipient ? (
                                    <div className={`w-full p-3 border rounded-lg  flex justify-between items-center ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                                        <span>Responde a: {replyRecipient.name}</span>
                                        <button onClick={() => setReplyRecipient(null)} className="text-xs text-red-500 hover:text-red-600">Remover</button>
                                    </div>
                                ) : isAdmin ? (
                                    <select
                                        value={recipientGroup}
                                        onChange={e => setRecipientGroup(e.target.value as MessageGroup)}
                                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                                    >
                                        <option value="ADMINS">Administradores</option>
                                        <option value="INSTRUCTORS">Todos os Docentes</option>
                                        <option value="CADETS_ALL">Todos os Cadetes</option>
                                        <option value="CADETS_1">1º Esquadrão</option>
                                        <option value="CADETS_2">2º Esquadrão</option>
                                        <option value="CADETS_3">3º Esquadrão</option>
                                        <option value="CADETS_4">4º Esquadrão</option>
                                        {!isSuperAdmin && <option value="DEVELOPER">Falar com Desenvolvedor</option>}
                                    </select>
                                ) : (
                                    <select
                                        value={recipientGroup}
                                        onChange={e => setRecipientGroup(e.target.value as MessageGroup)}
                                        className={`w-full p-3 border rounded-lg  outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
                                    >
                                        <option value="ADMINS">Administração da Aplicação</option>
                                        <option value="DEVELOPER">Falar com Desenvolvedor</option>
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Assunto</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                                    placeholder="Resumo do assunto"
                                    required
                                />
                            </div>
                            <div className="flex-1">
                                <label className={`block text-sm  mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Mensagem</label>
                                <textarea
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    className={`w-full h-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-sans ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                                    placeholder="Digite sua mensagem aqui..."
                                    required
                                />
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2  disabled:opacity-50"
                                >
                                    {sending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                                    Enviar Mensagem
                                </button>
                            </div>
                        </form>
                    </div>
                ) : selectedMessage ? (
                    <div className="flex flex-col h-full animate-in fade-in duration-300">
                        {/* Mobile Back Button */}
                        <div className={`md:hidden p-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                            <button onClick={() => setSelectedMessage(null)} className={`text-sm  ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                ← Voltar
                            </button>
                        </div>
                        <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                            <h1 className={`text-2xl  mb-4 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{selectedMessage.subject}</h1>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center  ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                        {(selectedMessage.senderRole === 'SUPER_ADMIN' || selectedMessage.senderRole === 'ADMIN') ? 'A' : selectedMessage.senderName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className={` ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                                            {(selectedMessage.senderRole === 'SUPER_ADMIN' || selectedMessage.senderRole === 'ADMIN')
                                                ? 'Administração'
                                                : `${selectedMessage.senderName}${selectedMessage.senderDetail ? ` (${selectedMessage.senderDetail})` : ''}`}
                                        </p>
                                        <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {new Date(selectedMessage.createdAt).toLocaleString()}
                                        </p>
                                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                            Para: {selectedMessage.recipientGroups?.map(g => groupLabels[g] || g).join(', ')}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setReplyRecipient({ id: selectedMessage.senderId, name: selectedMessage.senderName });
                                        setSubject(selectedMessage.subject.startsWith('Re:') ? selectedMessage.subject : `Re: ${selectedMessage.subject}`);
                                        setComposeOpen(true);
                                    }}
                                    className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition"
                                    title="Responder"
                                >
                                    <Reply size={20} />
                                </button>
                            </div>
                        </div>
                        <div className={`flex-1 p-6 overflow-y-auto whitespace-pre-wrap leading-relaxed font-sans ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                            {selectedMessage.content}
                        </div>
                    </div>
                ) : (
                    <div className={`flex-1 flex flex-col items-center justify-center ${theme === 'dark' ? 'text-slate-500 bg-slate-900/10' : 'text-slate-400 bg-slate-50/30'}`}>
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                            <Mail size={40} className={`text-slate-300 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
                        </div>
                        <p className="text-lg ">Selecione uma mensagem</p>
                        <p className="text-sm">ou inicie uma nova conversa.</p>
                    </div>
                )}
            </div>
        </div >
    );
};
