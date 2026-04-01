import { useState, useMemo } from 'react';
import { useCourseStore } from '../../store/useCourseStore';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatClassId, formatCourse } from '../../utils/formatters';
import { Trash2, Plus, Calendar, AlertTriangle, Info, Edit2, Megaphone, Copy, Search, Filter, X, CalendarCheck } from 'lucide-react';
import type { NoticeType, SystemNotice } from '../../types';
import { formatDateForDisplay } from '../../utils/dateUtils';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { NoticeForm } from '../../components/NoticeForm';
import { EmptyState } from '../../components/EmptyState';
import { Badge } from '../../components/common/Badge';
import type { BadgeVariant } from '../../components/common/Badge';

type NoticeStatus = 'all' | 'active' | 'upcoming' | 'expired';

export const NoticeManager = () => {
    const { notices, addNotice, updateNotice, deleteNotice } = useCourseStore();
    const { userProfile } = useAuth();
    const { theme } = useTheme();

    // Only admins/super_admins
    if (!['SUPER_ADMIN', 'ADMIN'].includes(userProfile?.role || '')) {
        return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Acesso negado.</div>;
    }

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<NoticeType | 'ALL'>('ALL');
    const [filterStatus, setFilterStatus] = useState<NoticeStatus>('all');
    const [filterSquadron, setFilterSquadron] = useState<string>('');
    const [filterClass, setFilterClass] = useState<string>('');

    // Form State
    const [selectedNotice, setSelectedNotice] = useState<Partial<SystemNotice> | undefined>(undefined);

    const today = new Date().toISOString().split('T')[0];

    const getNoticeStatus = (notice: SystemNotice): 'active' | 'upcoming' | 'expired' => {
        if (notice.endDate < today) return 'expired';
        if (notice.startDate > today) return 'upcoming';
        return 'active';
    };

    const filteredNotices = useMemo(() => {
        return notices.filter(notice => {
            // Search filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!notice.title.toLowerCase().includes(q) && !(notice.description || '').toLowerCase().includes(q)) {
                    return false;
                }
            }
            // Type filter
            if (filterType !== 'ALL' && notice.type !== filterType) return false;
            // Status filter
            if (filterStatus !== 'all' && getNoticeStatus(notice) !== filterStatus) return false;
            // Squadron filter
            if (filterSquadron && (notice.targetSquadron && String(notice.targetSquadron) !== filterSquadron)) return false;
            // Class filter
            if (filterClass && (notice.targetClass && notice.targetClass !== filterClass)) return false;

            return true;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [notices, searchQuery, filterType, filterStatus, filterSquadron, filterClass, today]);

    // Helper to get available classes based on selected squadron
    const availableClasses = useMemo(() => {
        const all = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'];
        if (!filterSquadron) return all;
        return all.filter(c => c.startsWith(filterSquadron));
    }, [filterSquadron]);

    // Counts for filter badges
    const statusCounts = useMemo(() => {
        const counts = { all: notices.length, active: 0, upcoming: 0, expired: 0 };
        notices.forEach(n => { counts[getNoticeStatus(n)]++; });
        return counts;
    }, [notices, today]);

    const hasActiveFilters = searchQuery || filterType !== 'ALL' || filterStatus !== 'all' || filterSquadron || filterClass;

    const clearFilters = () => {
        setSearchQuery('');
        setFilterType('ALL');
        setFilterStatus('all');
        setFilterSquadron('');
        setFilterClass('');
    };

    const handleEdit = (notice: SystemNotice) => {
        setSelectedNotice({ ...notice });
        setEditingId(notice.id);
        setIsFormOpen(true);
    };

    const handleCopy = (notice: SystemNotice) => {
        const newNotice: SystemNotice = {
            ...notice,
            id: crypto.randomUUID(),
            title: `${notice.title} (Cópia)`,
            createdAt: new Date().toISOString(),
            createdBy: userProfile?.uid || 'system',
        };
        addNotice(newNotice);
    };

    const handleDelete = () => {
        if (deleteId) {
            deleteNotice(deleteId);
            setDeleteId(null);
        }
    };

    const handleFormSubmit = (data: Partial<SystemNotice>) => {
        const noticeData = {
            ...data,
            targetRoles: data.targetRoles || [],
        } as SystemNotice;

        if (editingId) {
            updateNotice(editingId, noticeData);
        } else {
            addNotice({
                ...noticeData,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                createdBy: userProfile?.uid || 'system'
            });
        }

        setIsFormOpen(false);
        setEditingId(null);
        setSelectedNotice(undefined);
    };

    const getTypeColor = (type: NoticeType) => {
        switch (type) {
            case 'URGENT': return 'text-red-600 bg-red-50 border-red-200';
            case 'WARNING': return 'text-amber-600 bg-amber-50 border-amber-200';
            case 'INFO': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'EVENT': return 'text-purple-600 bg-purple-50 border-purple-200';
            case 'EVALUATION': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
            case 'GENERAL': return 'text-slate-600 bg-slate-50 border-slate-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const getTypeVariant = (type: NoticeType): BadgeVariant => {
        switch (type) {
            case 'URGENT': return 'red';
            case 'WARNING': return 'amber';
            case 'INFO': return 'blue';
            case 'EVENT': return 'purple';
            case 'EVALUATION': return 'indigo';
            case 'GENERAL': return 'slate';
            default: return 'slate';
        }
    };

    const getTypeLabel = (type: NoticeType) => {
        switch (type) {
            case 'URGENT': return 'Urgente';
            case 'WARNING': return 'Atenção';
            case 'INFO': return 'Info';
            case 'EVENT': return 'Evento';
            case 'EVALUATION': return 'Avaliação';
            case 'GENERAL': return 'Geral';
            default: return 'Geral';
        }
    };


    const getStatusBadge = (notice: SystemNotice) => {
        const status = getNoticeStatus(notice);
        switch (status) {
            case 'active': return <Badge variant="green">Ativo</Badge>;
            case 'upcoming': return <Badge variant="blue">Futuro</Badge>;
            case 'expired': return <Badge variant="slate">Expirado</Badge>;
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* ... (Header) */}
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={`text-3xl  tracking-tight flex items-center gap-3 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                        <Megaphone className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                        Gestão de Avisos e Eventos
                    </h1>
                    <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Gerencie comunicados e alertas para o efetivo.</p>
                </div>
                {/* ... (New Notice Button) */}
                <button
                    onClick={() => {
                        setEditingId(null);
                        setSelectedNotice(undefined);
                        setIsFormOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm "
                >
                    <Plus size={20} />
                    Novo Aviso
                </button>
            </header>

            {/* Filter Bar */}
            <div className={`mb-6 rounded-xl border p-4 shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                    <Filter size={14} className="text-slate-400" />
                    <span className={`text-xs  uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Filtros</span>
                    {hasActiveFilters && (
                        <button onClick={clearFilters} className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 ">
                            <X size={12} /> Limpar filtros
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar por título ou descrição..."
                            className={`w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none placeholder-slate-400 ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                        />
                    </div>

                    {/* Type Filter */}
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value as NoticeType | 'ALL')}
                        className={`px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                    >
                        <option value="ALL">Todos os tipos</option>
                        <option value="INFO">📘 Informativo</option>
                        <option value="WARNING">⚠️ Atenção</option>
                        <option value="URGENT">🔴 Urgente</option>
                        <option value="EVENT">🟣 Evento</option>
                        <option value="EVALUATION">🎓 Avaliação</option>
                        <option value="GENERAL">⚪ Geral</option>
                    </select>

                    {/* Squadron Filter */}
                    <select
                        value={filterSquadron}
                        onChange={e => {
                            setFilterSquadron(e.target.value);
                            setFilterClass(''); // Reset class
                        }}
                        className={`px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                    >
                        <option value="">Todos os esquadrões</option>
                        <option value="1">1º Esquadrão</option>
                        <option value="2">2º Esquadrão</option>
                        <option value="3">3º Esquadrão</option>
                        <option value="4">4º Esquadrão</option>
                    </select>

                    {/* Class Filter */}
                    <select
                        value={filterClass}
                        onChange={e => setFilterClass(e.target.value)}
                        className={`px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${theme === 'dark' ? 'border-slate-600 bg-slate-700 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                    >
                        <option value="">Todas as Turmas</option>
                        {availableClasses.map(c => (
                            <option key={c} value={c}>{formatClassId(c)}</option>
                        ))}
                    </select>
                </div>

                {/* Status Pills */}
                <div className="flex gap-2 mt-3">
                    {([
                        { key: 'all', label: 'Todos', count: statusCounts.all },
                        { key: 'active', label: 'Ativos', count: statusCounts.active },
                        { key: 'upcoming', label: 'Futuros', count: statusCounts.upcoming },
                        { key: 'expired', label: 'Expirados', count: statusCounts.expired },
                    ] as const).map(item => (
                        <button
                            key={item.key}
                            onClick={() => setFilterStatus(item.key)}
                            className={`px-3 py-1 text-xs  rounded-full transition-colors ${filterStatus === item.key
                                ? 'bg-blue-600 text-white shadow-sm'
                                : (theme === 'dark' ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                                }`}
                        >
                            {/* item.count logic needs update if we want filtered counts? No, user usually expects total counts unless filtered. Kept as is. */}
                            {item.label} <span className={`ml-1 ${filterStatus === item.key ? 'text-blue-200' : 'text-slate-400'}`}>({item.count})</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Form */}
            {isFormOpen && (
                <NoticeForm
                    initialData={selectedNotice}
                    onSubmit={handleFormSubmit}
                    onCancel={() => {
                        setIsFormOpen(false);
                        setEditingId(null);
                        setSelectedNotice(undefined);
                    }}
                />
            )}

            {/* Results info */}
            {hasActiveFilters && (
                <div className={`mb-3 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Mostrando <span className={` ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{filteredNotices.length}</span> de {notices.length} avisos
                </div>
            )}

            <div className="flex flex-col gap-3 w-full">
                {filteredNotices.length === 0 ? (
                    <EmptyState
                        icon={CalendarCheck}
                        title={hasActiveFilters ? 'Nenhum aviso encontrado' : 'Nenhum aviso cadastrado'}
                        description={hasActiveFilters
                            ? 'Tente ajustar seus filtros para encontrar o que procura.'
                            : 'Comece criando um novo aviso para manter o efetivo informado.'}
                        actionLabel={hasActiveFilters ? "Limpar Filtros" : "Novo Aviso"}
                        onAction={hasActiveFilters ? clearFilters : () => {
                            setEditingId(null);
                            setSelectedNotice(undefined);
                            setIsFormOpen(true);
                        }}
                        className={`rounded-xl border border-dashed ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-300'}`}
                    />
                ) : (
                    filteredNotices.map(notice => (
                        <div key={notice.id} className={`px-5 py-4 rounded-xl shadow-sm border flex items-start gap-4 group transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:border-blue-700/50' : 'bg-white border-slate-100 hover:border-blue-200'} ${getNoticeStatus(notice) === 'expired' ? 'opacity-60' : ''}`}>
                            {/* Type Icon */}
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${getTypeColor(notice.type)}`}>
                                {notice.type === 'URGENT' ? <AlertTriangle size={20} /> :
                                    notice.type === 'WARNING' ? <AlertTriangle size={20} /> :
                                        notice.type === 'EVENT' ? <Megaphone size={20} /> :
                                            <Info size={20} />}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h3 className={` text-sm ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{notice.title}</h3>
                                    <Badge variant={getTypeVariant(notice.type)}>{getTypeLabel(notice.type)}</Badge>
                                    {getStatusBadge(notice)}
                                </div>
                                <p className={`text-sm mt-0.5 whitespace-pre-wrap break-words leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{notice.description || ''}</p>

                                <div className="flex gap-2 mt-2">
                                    <span className={`flex items-center gap-1 px-2 py-1 rounded font-mono text-xs whitespace-nowrap ${theme === 'dark' ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                                        <Calendar size={11} />
                                        {formatDateForDisplay(notice.startDate)} – {formatDateForDisplay(notice.endDate)}
                                    </span>
                                    {notice.targetCourse && notice.targetCourse !== 'ALL' && (
                                        <Badge variant="indigo">
                                            {formatCourse(notice.targetCourse)}
                                        </Badge>
                                    )}
                                    {notice.targetSquadron && (
                                        <Badge variant="blue">
                                            {notice.targetSquadron}º Esq
                                        </Badge>
                                    )}
                                    {notice.targetClass && (
                                        <Badge variant="slate">
                                            {formatClassId(notice.targetClass)}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className={`flex gap-1 flex-shrink-0 border-l pl-3 md:pt-1 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}`}>
                                <button
                                    onClick={() => handleCopy(notice)}
                                    className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-green-400 hover:bg-green-900/20' : 'text-slate-500 hover:text-green-600 hover:bg-green-50'}`}
                                    title="Duplicar"
                                >
                                    <Copy size={16} />
                                </button>
                                <button
                                    onClick={() => handleEdit(notice)}
                                    className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-blue-400 hover:bg-blue-900/20' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
                                    title="Editar"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => setDeleteId(notice.id)}
                                    className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-red-400 hover:bg-red-900/20' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ConfirmDialog
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Excluir Aviso"
                message="Tem certeza que deseja excluir este aviso? Esta ação não pode ser desfeita."
                confirmText="Excluir"
                cancelText="Cancelar"
                type="danger"
            />
        </div>
    );
};
