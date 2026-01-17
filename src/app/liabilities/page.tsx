'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wallet, Plus, Trash2, AlertCircle, ArrowLeft, Calendar, Edit2, CheckCircle, TrendingDown, X, History as HistoryIcon } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Liability {
    id: string;
    lender_name: string;
    principal_amount: number;
    interest_rate: number;
    rate_interval: 'ANNUALLY' | 'MONTHLY' | 'DAILY';
    start_date: string;
    status: 'ACTIVE' | 'CLOSED';
    created_at: string;
    // Calculated fields
    accrued_interest?: number;
    total_due?: number;
    days_elapsed?: number;
    title?: string;
}

export default function Liabilities() {
    const [liabilities, setLiabilities] = useState<Liability[]>([]);
    const [loading, setLoading] = useState(true);

    // View & Selection State
    const [viewMode, setViewMode] = useState<'list' | 'groups'>('list');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Form States
    const [isAdding, setIsAdding] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeName, setMergeName] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [statusTab, setStatusTab] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');

    // Repayment State
    const [showRepayModal, setShowRepayModal] = useState(false);
    const [repayId, setRepayId] = useState<string | null>(null);
    const [repayAmount, setRepayAmount] = useState('');

    // Celebration State
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebratedItem, setCelebratedItem] = useState<Liability | null>(null);

    // Details Modal State
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
    const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Form State (Single Item for Editing, Multi for Adding)
    const [commonForm, setCommonForm] = useState({
        lender_name: '',
        start_date: new Date().toISOString().split('T')[0]
    });

    const [tranches, setTranches] = useState([
        { title: 'Principal', principal_amount: '', interest_rate: '12', rate_interval: 'ANNUALLY' }
    ]);

    // Legacy edit form state for backward compatibility with Edit Mode
    const [editForm, setEditForm] = useState({
        lender_name: '',
        title: '',
        principal_amount: '',
        interest_rate: '',
        rate_interval: 'ANNUALLY',
        start_date: new Date().toISOString().split('T')[0]
    });

    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        fetchLiabilities();
    }, []);

    const fetchLiabilities = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth');
                return;
            }

            const { data, error } = await supabase
                .from('personal_borrowings')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Calculate Interest Client-Side
            const processed = (data || []).map((l: any) => {
                const start = new Date(l.start_date);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - start.getTime());
                const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Effective Rate per Day
                let dailyRate = 0;
                if (l.rate_interval === 'ANNUALLY') dailyRate = l.interest_rate / 365.0;
                else if (l.rate_interval === 'MONTHLY') dailyRate = l.interest_rate / 30.0;
                else dailyRate = l.interest_rate;

                // Simple Interest
                const interest = l.principal_amount * dailyRate * days;

                return {
                    ...l,
                    accrued_interest: interest,
                    total_due: l.principal_amount + interest,
                    days_elapsed: days
                };
            });

            setLiabilities(processed);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth');
                return;
            }

            if (isEditing && editId) {
                // EDIT MODE (Single Item)
                const payload = {
                    lender_name: editForm.lender_name,
                    title: editForm.title || null,
                    principal_amount: parseFloat(editForm.principal_amount),
                    interest_rate: parseFloat(editForm.interest_rate) / 100,
                    rate_interval: editForm.rate_interval as any,
                    start_date: editForm.start_date,
                    // status is removed from update payload to preserve current status
                };
                const { error } = await supabase.from('personal_borrowings').update(payload).eq('id', editId);
                if (error) throw error;
            } else {
                // ADD MODE (Multi Tranche)
                const payloads = tranches.map(t => ({
                    user_id: user.id,
                    lender_name: commonForm.lender_name,
                    title: t.title || null,
                    principal_amount: parseFloat(t.principal_amount),
                    interest_rate: parseFloat(t.interest_rate) / 100,
                    rate_interval: t.rate_interval as any,
                    start_date: commonForm.start_date,
                    status: 'ACTIVE'
                }));

                const { error } = await supabase.from('personal_borrowings').insert(payloads);
                if (error) throw error;
            }

            // Reset
            setIsAdding(false);
            setIsEditing(false);
            setEditId(null);
            setCommonForm({
                lender_name: '',
                start_date: new Date().toISOString().split('T')[0]
            });
            setTranches([
                { title: 'Principal', principal_amount: '', interest_rate: '12', rate_interval: 'ANNUALLY' }
            ]);
            fetchLiabilities();
        } catch (e: any) {
            console.error(e);
            alert(`Error saving record: ${e.message || JSON.stringify(e)}`);
        }
    };

    const handleEditClick = (l: Liability, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsEditing(true);
        setEditId(l.id);
        setIsAdding(true);
        // Populate Single Edit Form
        setEditForm({
            lender_name: l.lender_name,
            title: l.title || '',
            principal_amount: l.principal_amount.toString(),
            interest_rate: (l.interest_rate * 100).toString(),
            rate_interval: l.rate_interval,
            start_date: l.start_date
        });
    };

    const handleDeleteClick = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setDeleteId(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;

        // Optimistic Update
        const previousLiabilities = [...liabilities];
        setLiabilities(prev => prev.filter(l => l.id !== deleteId));
        setShowDeleteModal(false);

        try {
            const { error } = await supabase.from('personal_borrowings').delete().eq('id', deleteId);
            if (error) throw error;
        } catch (e) {
            console.error(e);
            alert('Error deleting record');
            setLiabilities(previousLiabilities); // Revert
        } finally {
            setDeleteId(null);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: 'ACTIVE' | 'CLOSED', e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newStatus = currentStatus === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';

        // Optimistic
        setLiabilities(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));

        if (newStatus === 'CLOSED') {
            const item = liabilities.find(l => l.id === id);
            if (item) {
                setCelebratedItem(item);
                setShowCelebration(true);
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
        }

        try {
            const { error } = await supabase
                .from('personal_borrowings')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
        } catch (e) {
            console.error(e);
            alert('Error updating status');
            fetchLiabilities(); // Revert
        }
    };

    const handleRepayClick = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setRepayId(id);
        setRepayAmount('');
        setShowRepayModal(true);
    };

    const confirmRepayment = async () => {
        if (!repayId || !repayAmount) return;
        const amount = parseFloat(repayAmount);
        if (isNaN(amount) || amount <= 0) return;

        const item = liabilities.find(l => l.id === repayId);
        if (!item) return;

        const accruedInterest = item.accrued_interest || 0;
        let newPrincipal = item.principal_amount;
        let newStartDate = new Date().toISOString().split('T')[0];

        // Interest First Logic
        if (amount >= accruedInterest) {
            // Payment covers all interest + some principal
            const principalPayment = amount - accruedInterest;
            newPrincipal = Math.max(0, item.principal_amount - principalPayment);
            // newStartDate stays Today (Reset)
        } else {
            // Payment covers only part of interest
            // Principal remains same. We shift start_date backwards to represent remaining interest.
            const remainingInterest = accruedInterest - amount;

            // Calculate Daily Rate to determine "Days Required" for remaining interest
            let dailyRate = 0;
            if (item.rate_interval === 'ANNUALLY') dailyRate = item.interest_rate / 365.0;
            else if (item.rate_interval === 'MONTHLY') dailyRate = item.interest_rate / 30.0;
            else dailyRate = item.interest_rate;

            if (dailyRate > 0 && item.principal_amount > 0) {
                const daysForRemainingInterest = remainingInterest / (item.principal_amount * dailyRate);
                const pastDate = new Date();
                pastDate.setDate(pastDate.getDate() - daysForRemainingInterest);
                newStartDate = pastDate.toISOString().split('T')[0];
            } else {
                // Fallback if rate is 0 (shouldn't happen with accrued interest > 0)
                newStartDate = item.start_date;
            }
        }

        const updates = {
            principal_amount: newPrincipal,
            start_date: newStartDate
        };

        // Optimistic
        setLiabilities(prev => prev.map(l => l.id === repayId ? { ...l, ...updates } : l));
        setShowRepayModal(false);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not found');

            // 1. Update Liability
            const { error: updateError } = await supabase
                .from('personal_borrowings')
                .update(updates)
                .eq('id', repayId);

            if (updateError) throw updateError;

            // 2. Log Transaction
            const { error: logError } = await supabase
                .from('liability_transactions')
                .insert({
                    borrowing_id: repayId,
                    user_id: user.id,
                    amount: amount,
                    transaction_type: 'REPAYMENT',
                    notes: 'Partial Repayment via Dashboard'
                });

            if (logError) console.error('Error logging transaction:', logError); // Non-blocking

        } catch (e) {
            console.error(e);
            alert('Error processing repayment');
            fetchLiabilities();
        }
    };

    const handleCardClick = (id: string) => {
        setSelectedDetailId(id);
        setShowDetailsModal(true);
        fetchHistory(id);
    };

    const fetchHistory = async (id: string) => {
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('liability_transactions')
                .select('*')
                .eq('borrowing_id', id)
                .order('transaction_date', { ascending: false });

            if (error) throw error;
            setTransactionHistory(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleMerge = async () => {
        if (!mergeName.trim() || selectedIds.length === 0) return;
        try {
            // 1. Get current items to preserve names
            const itemsToMerge = liabilities.filter(l => selectedIds.includes(l.id));

            // 2. Perform updates to preserve individual titles
            const updates = itemsToMerge.map(item => {
                const needsTitlePreservation = !(item as any).title;
                const newTitle = needsTitlePreservation ? item.lender_name : (item as any).title;

                return supabase
                    .from('personal_borrowings')
                    .update({
                        lender_name: mergeName,
                        title: newTitle
                    })
                    .eq('id', item.id);
            });

            await Promise.all(updates);

            setShowMergeModal(false);
            setMergeName('');
            setSelectedIds([]);
            fetchLiabilities();
        } catch (e) {
            console.error(e);
            alert('Error merging group');
        }
    };

    const toggleSelection = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(x => x !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

    const filteredLiabilities = liabilities.filter(l => l.status === statusTab);
    const totalPrincipal = filteredLiabilities.reduce((sum, l) => sum + l.principal_amount, 0);
    const totalInterest = filteredLiabilities.reduce((sum, l) => sum + (l.accrued_interest || 0), 0);

    // Grouping Logic
    const groupedLiabilities = Object.values(filteredLiabilities.reduce((acc, l) => {
        if (!acc[l.lender_name]) {
            acc[l.lender_name] = {
                name: l.lender_name,
                count: 0,
                principal: 0,
                interest: 0,
                items: []
            };
        }
        const g = acc[l.lender_name];
        g.count++;
        g.principal += l.principal_amount;
        g.interest += (l.accrued_interest || 0);
        g.items.push(l);
        return acc;
    }, {} as Record<string, any>));

    return (
        <main className="min-h-screen bg-black p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-zinc-900 rounded-full text-zinc-500 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                                <Wallet className="w-8 h-8 text-red-500" />
                                My Borrowings
                            </h1>
                            <div className="flex items-center gap-4 mt-2">
                                <button
                                    onClick={() => setStatusTab('ACTIVE')}
                                    className={`text-sm font-medium transition-colors ${statusTab === 'ACTIVE' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    Active
                                </button>
                                <button
                                    onClick={() => setStatusTab('CLOSED')}
                                    className={`text-sm font-medium transition-colors ${statusTab === 'CLOSED' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    Closed
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Toggles - Removed as we now auto-group */}
                        {/* 
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 flex">
                            ...
                        </div> 
                        */}

                        {selectedIds.length > 0 && (
                            <button
                                onClick={() => setShowMergeModal(true)}
                                className="px-4 py-2 bg-zinc-800 text-emerald-400 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                Merge ({selectedIds.length})
                            </button>
                        )}

                        <button
                            onClick={() => {
                                setIsAdding(!isAdding);
                                setIsEditing(false);
                                // Reset to Add Mode Defaults
                                setCommonForm({
                                    lender_name: '',
                                    start_date: new Date().toISOString().split('T')[0]
                                });
                                setTranches([
                                    { title: 'Principal', principal_amount: '', interest_rate: '12', rate_interval: 'ANNUALLY' }
                                ]);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isAdding && !isEditing ? 'bg-zinc-800 text-white' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'}`}
                        >
                            {isAdding && !isEditing ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Borrowing</>}
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-panel p-6 rounded-xl border-red-500/10">
                        <span className="text-zinc-400 text-sm font-medium block mb-2">Total Principal Owed</span>
                        <div className="text-2xl font-bold text-white">{formatCurrency(totalPrincipal)}</div>
                    </div>
                    <div className="glass-panel p-6 rounded-xl border-red-500/10">
                        <span className="text-zinc-400 text-sm font-medium block mb-2">Accrued Interest</span>
                        <div className="text-2xl font-bold text-red-400">{formatCurrency(totalInterest)}</div>
                    </div>
                    <div className="glass-panel p-6 rounded-xl border-red-500/10">
                        <span className="text-zinc-400 text-sm font-medium block mb-2">Total Liability Due</span>
                        <div className="text-2xl font-bold text-white">{formatCurrency(totalPrincipal + totalInterest)}</div>
                    </div>
                </div>

                {/* Add/Edit Form */}
                {isAdding && (
                    <form onSubmit={handleSave} className="glass-panel p-6 rounded-xl space-y-4 border-red-500/20 animate-in fade-in slide-in-from-top-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-white">{isEditing ? 'Edit Borrowing' : 'Add New Borrowing'}</h3>
                            <button type="button" onClick={() => setIsAdding(false)} className="text-zinc-500 hover:text-white"><AlertCircle className="w-5 h-5" /></button>
                        </div>

                        {/* EDIT MODE FORM */}
                        {isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-1">Group / Lender</label>
                                        <input required type="text" value={editForm.lender_name} onChange={e => setEditForm({ ...editForm, lender_name: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" placeholder="Group Name" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-1">Individual Title (Optional)</label>
                                        <input type="text" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" placeholder="Specific Loan Title" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Principal Amount</label>
                                    <input required type="number" value={editForm.principal_amount} onChange={e => setEditForm({ ...editForm, principal_amount: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Interest Rate (%)</label>
                                    <input required type="number" value={editForm.interest_rate} onChange={e => setEditForm({ ...editForm, interest_rate: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" placeholder="12" />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Interval</label>
                                    <select value={editForm.rate_interval} onChange={e => setEditForm({ ...editForm, rate_interval: e.target.value as any })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none">
                                        <option value="ANNUALLY">Annually</option>
                                        <option value="MONTHLY">Monthly</option>
                                        <option value="DAILY">Daily</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Start Date</label>
                                    <input required type="date" value={editForm.start_date} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" />
                                </div>
                            </div>
                        ) : (
                            /* ADD MODE FORM (Multi-Tranche) */
                            <div className="space-y-6">
                                {/* Common Details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-zinc-900/30 rounded-lg border border-zinc-800/50">
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-1">Lender / Group Name</label>
                                        <input required type="text" value={commonForm.lender_name} onChange={e => setCommonForm({ ...commonForm, lender_name: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" placeholder="e.g. HDFC Bank, Friend" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-1">Start Date (Applied to All)</label>
                                        <input required type="date" value={commonForm.start_date} onChange={e => setCommonForm({ ...commonForm, start_date: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" />
                                    </div>
                                </div>

                                {/* Tranches List */}
                                <div className="space-y-3">
                                    {tranches.map((t, idx) => (
                                        <div key={idx} className="relative group bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
                                            {tranches.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setTranches(prev => prev.filter((_, i) => i !== idx))}
                                                    className="absolute top-2 right-2 p-1 text-zinc-600 hover:text-red-500 opacity-50 hover:opacity-100"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                                <div className="md:col-span-4">
                                                    <label className="text-[10px] text-zinc-500 block mb-1">Purpose / Title</label>
                                                    <input
                                                        type="text"
                                                        value={t.title}
                                                        onChange={e => {
                                                            const newTranches = [...tranches];
                                                            newTranches[idx].title = e.target.value;
                                                            setTranches(newTranches);
                                                        }}
                                                        className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-sm text-white focus:border-zinc-600 outline-none"
                                                        placeholder="e.g. Principal"
                                                    />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="text-[10px] text-zinc-500 block mb-1">Amount</label>
                                                    <input
                                                        required
                                                        type="number"
                                                        value={t.principal_amount}
                                                        onChange={e => {
                                                            const newTranches = [...tranches];
                                                            newTranches[idx].principal_amount = e.target.value;
                                                            setTranches(newTranches);
                                                        }}
                                                        className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-[10px] text-zinc-500 block mb-1">Rate (%)</label>
                                                    <input
                                                        required
                                                        type="number"
                                                        value={t.interest_rate}
                                                        onChange={e => {
                                                            const newTranches = [...tranches];
                                                            newTranches[idx].interest_rate = e.target.value;
                                                            setTranches(newTranches);
                                                        }}
                                                        className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-sm text-white focus:border-emerald-500 outline-none font-mono"
                                                    />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="text-[10px] text-zinc-500 block mb-1">Interval</label>
                                                    <select
                                                        value={t.rate_interval}
                                                        onChange={e => {
                                                            const newTranches = [...tranches];
                                                            newTranches[idx].rate_interval = e.target.value;
                                                            setTranches(newTranches);
                                                        }}
                                                        className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-sm text-zinc-400 focus:border-zinc-600 outline-none"
                                                    >
                                                        <option value="ANNUALLY">Annually</option>
                                                        <option value="MONTHLY">Monthly</option>
                                                        <option value="DAILY">Daily</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setTranches([...tranches, { title: '', principal_amount: '', interest_rate: '0', rate_interval: 'ANNUALLY' }])}
                                        className="w-full py-2 border border-dashed border-zinc-800 rounded-lg text-xs text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" /> Add Another Component (e.g. Fees, Split Rate)
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                                {isEditing ? 'Update Record' : 'Save Borrowing'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-12 text-zinc-500">Loading liabilities...</div>
                    ) : groupedLiabilities.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                            No {statusTab.toLowerCase()} liabilities.
                            {/* Shortuct to add if nothing exists */}
                            {statusTab === 'ACTIVE' && (
                                <button onClick={() => setIsAdding(true)} className="block mx-auto mt-4 text-red-500 hover:underline">Add your first borrowing</button>
                            )}
                        </div>
                    ) : (
                        // UNIFIED GROUPED CARD VIEW
                        groupedLiabilities.map((g: any, idx) => (
                            <div key={idx} className="glass-panel p-0 rounded-xl hover:border-red-500/30 transition-colors overflow-hidden">
                                {/* Group Header */}
                                <div className="p-6 border-b border-zinc-800/50 bg-zinc-900/20">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-zinc-800">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                                {g.name}
                                                <span className="text-xs text-zinc-500 font-normal">({g.items.length} items)</span>
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-zinc-400 mt-1">
                                                <span>Principal: {formatCurrency(g.principal)}</span>
                                                <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                                                <span className="text-red-400">Interest: {formatCurrency(g.interest)}</span>
                                            </div>
                                        </div>
                                        <div className="hidden sm:block text-right">
                                            <div className="text-2xl font-bold text-white">{formatCurrency(g.principal + g.interest)}</div>
                                            <div className="text-xs text-zinc-500">Total Liability</div>
                                        </div>
                                        {/* Mobile Total visible only on small screens */}
                                        <div className="sm:hidden w-full bg-zinc-900/50 p-3 rounded-lg flex justify-between items-center">
                                            <span className="text-sm text-zinc-400">Total Liability</span>
                                            <span className="text-lg font-bold text-white">{formatCurrency(g.principal + g.interest)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="divide-y divide-zinc-800/50">
                                    {g.items.map((l: Liability) => (
                                        <div
                                            key={l.id}
                                            onClick={() => handleCardClick(l.id)}
                                            className={`p-4 hover:bg-zinc-900/30 transition-colors relative group cursor-pointer ${selectedIds.includes(l.id) ? 'bg-emerald-900/10' : ''}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Selection Checkbox (Nested) */}
                                                {(selectedIds.length > 0) && (
                                                    <div className="pt-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(l.id)}
                                                            onChange={() => toggleSelection(l.id)}
                                                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
                                                    {/* Left: Info */}
                                                    <div className="flex-1 w-full sm:w-auto">
                                                        <div className="flex justify-between sm:justify-start items-center gap-3 mb-1">
                                                            <span className="text-base font-medium text-white truncate max-w-[200px]">{l.title || 'Loan'}</span>
                                                            <div className="flex gap-2">
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 whitespace-nowrap">
                                                                    {(l.interest_rate * 100).toFixed(2)}% {l.rate_interval.charAt(0)}
                                                                </span>
                                                                {l.status === 'CLOSED' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Paid</span>}
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-4 gap-y-1 text-sm text-zinc-400 w-full">
                                                            <div className="flex flex-col sm:block">
                                                                <span className="text-[10px] uppercase text-zinc-600 sm:hidden">Principal</span>
                                                                <span>{formatCurrency(l.principal_amount)}</span>
                                                            </div>
                                                            <span className="hidden sm:block w-1 h-1 rounded-full bg-zinc-700"></span>
                                                            <div className="flex flex-col sm:block">
                                                                <span className="text-[10px] uppercase text-zinc-600 sm:hidden">Interest</span>
                                                                <span className="text-red-400">{formatCurrency(l.accrued_interest || 0)}</span>
                                                            </div>
                                                            <span className="hidden sm:block w-1 h-1 rounded-full bg-zinc-700"></span>
                                                            <div className="flex flex-col sm:block col-span-2">
                                                                <span className="text-[10px] uppercase text-zinc-600 sm:hidden">Start Date</span>
                                                                <span>{new Date(l.start_date).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex sm:flex-col lg:flex-row items-stretch sm:items-end lg:items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0" onClick={e => e.stopPropagation()}>
                                                        {l.status === 'ACTIVE' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setRepayId(l.id); setShowRepayModal(true); }}
                                                                className="flex-1 sm:flex-none px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-medium rounded border border-zinc-700 transition-colors flex items-center justify-center gap-1.5"
                                                            >
                                                                <TrendingDown className="w-3 h-3" /> Repay
                                                            </button>
                                                        )}

                                                        <div className="flex gap-2 flex-1 sm:flex-none">
                                                            <button
                                                                onClick={(e) => handleToggleStatus(l.id, l.status as any, e)}
                                                                className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${l.status === 'ACTIVE' ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/30'}`}
                                                            >
                                                                {l.status === 'ACTIVE' ? 'Close' : 'Reopen'}
                                                            </button>

                                                            {l.status === 'ACTIVE' && (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => handleEditClick(l, e)}
                                                                        className="px-2 py-1.5 bg-zinc-900 hover:text-white text-zinc-500 rounded border border-zinc-800 transition-colors"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => handleDeleteClick(l.id, e)}
                                                                        className="px-2 py-1.5 bg-zinc-900 hover:text-red-400 text-zinc-500 rounded border border-zinc-800 transition-colors"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="hidden md:block text-right min-w-[100px]">
                                                    <div className="text-sm font-bold text-zinc-300 font-mono">{formatCurrency(l.total_due || 0)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Merge Modal */}
            {showMergeModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Merge Selected Items</h3>
                        <p className="text-zinc-400 text-sm mb-4">Enter a new name for this group. All selected items will be renamed.</p>
                        <input
                            type="text"
                            value={mergeName}
                            onChange={e => setMergeName(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white mb-4"
                            placeholder="New Group Name"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowMergeModal(false)} className="flex-1 py-2 rounded-lg bg-zinc-800 text-white">Cancel</button>
                            <button onClick={handleMerge} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500">Merge</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-white mb-2">Confirm Deletion</h3>
                        <p className="text-zinc-400 text-sm mb-6">Are you sure you want to delete this record? This action cannot be undone.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 rounded-lg bg-zinc-800 text-white">Cancel</button>
                            <button onClick={confirmDelete} className="flex-1 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Repayment Modal */}
            {showRepayModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRepayModal(false)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-4">Make a Repayment</h3>
                        <p className="text-zinc-400 text-xs mb-4">Interest is deducted first, then principal.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Repayment Amount</label>
                                <input
                                    autoFocus
                                    type="number"
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none text-xl font-mono"
                                    placeholder="0.00"
                                    value={repayAmount}
                                    onChange={e => setRepayAmount(e.target.value)}
                                />
                            </div>

                            {/* Payment Breakdown Preview */}
                            {repayAmount && !isNaN(parseFloat(repayAmount)) && liabilities.find(l => l.id === repayId) && (
                                <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-800 text-sm">
                                    <div className="text-zinc-400 mb-2 text-xs">Payment Breakdown:</div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-zinc-300">To Interest</span>
                                        <span className="text-white font-mono">{formatCurrency(Math.min(parseFloat(repayAmount), liabilities.find(l => l.id === repayId)!.accrued_interest || 0))}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-zinc-700 pt-1">
                                        <span className="text-zinc-300">To Principal</span>
                                        <span className="text-emerald-400 font-bold font-mono">
                                            {formatCurrency(Math.max(0, parseFloat(repayAmount) - (liabilities.find(l => l.id === repayId)!.accrued_interest || 0)))}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowRepayModal(false)} className="flex-1 py-2 rounded-lg bg-zinc-800 text-white">Cancel</button>
                            <button onClick={confirmRepayment} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 font-bold">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Celebration Modal */}
            {showCelebration && celebratedItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 text-center" onClick={() => setShowCelebration(false)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-8 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />

                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-8 h-8" />
                        </div>

                        <h2 className="text-3xl font-bold text-white mb-2">Well Done!</h2>
                        <p className="text-zinc-400 mb-6">You settled up <span className="text-white font-medium">{celebratedItem.lender_name}</span> in <span className="text-emerald-400 font-bold">{celebratedItem.days_elapsed || 0} days</span>!</p>

                        <div className="bg-black/50 rounded-xl p-4 mb-6 border border-zinc-800">
                            <div className="grid grid-cols-2 gap-4 text-left">
                                <div>
                                    <div className="text-xs text-zinc-500">Principal Repaid</div>
                                    <div className="text-lg font-mono text-white">{formatCurrency(celebratedItem.principal_amount)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-zinc-500">Interest Saved</div>
                                    <div className="text-lg font-mono text-emerald-400">Priceless!</div>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => setShowCelebration(false)} className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-colors">
                            Awesome!
                        </button>
                    </div>
                </div>
            )}
            {/* Details Modal */}
            {showDetailsModal && selectedDetailId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDetailsModal(false)}>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {(() => {
                            const item = liabilities.find(l => l.id === selectedDetailId);
                            if (!item) return null;
                            return (
                                <>
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                {item.title || item.lender_name}
                                                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                                    {item.status}
                                                </span>
                                            </h3>
                                            <div className="text-sm text-zinc-500 mt-1">{item.lender_name}</div>
                                        </div>
                                        <button onClick={() => setShowDetailsModal(false)} className="text-zinc-500 hover:text-white">
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                            <div className="text-xs text-zinc-500 mb-1">Principal Remaining</div>
                                            <div className="text-lg md:text-xl font-mono text-white break-all">{formatCurrency(item.principal_amount)}</div>
                                        </div>
                                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                            <div className="text-xs text-zinc-500 mb-1">Total Due</div>
                                            <div className="text-lg md:text-xl font-mono text-emerald-400 break-all">{formatCurrency(item.total_due || 0)}</div>
                                            <div className="text-[10px] text-zinc-600 mt-1 break-all">
                                                Incl. {formatCurrency(item.accrued_interest || 0)} Interest
                                            </div>
                                        </div>
                                    </div>

                                    {/* Transaction History */}
                                    <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                        <HistoryIcon className="w-4 h-4 text-zinc-500" />
                                        Transaction History
                                    </h4>
                                    <div className="space-y-2">
                                        {historyLoading ? (
                                            <div className="text-center py-4 text-zinc-500 text-xs">Loading history...</div>
                                        ) : transactionHistory.length === 0 ? (
                                            <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs">
                                                No transactions recorded yet.
                                            </div>
                                        ) : (
                                            transactionHistory.map((t: any) => (
                                                <div key={t.id} className="flex justify-between items-center p-3 bg-zinc-800/30 rounded-lg border border-zinc-800/50">
                                                    <div>
                                                        <div className="text-white text-sm font-medium">
                                                            {t.transaction_type === 'REPAYMENT' ? 'Repayment' : t.transaction_type}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500">
                                                            {new Date(t.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-emerald-400 font-mono text-sm">-{formatCurrency(t.amount)}</div>
                                                        {t.notes && <div className="text-[10px] text-zinc-600">{t.notes}</div>}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </main>
    );
}
