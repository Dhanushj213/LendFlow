'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wallet, TrendingUp, Calendar, Plus, Trash2, AlertCircle } from 'lucide-react';

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

    const [form, setForm] = useState({
        lender_name: '',
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
            if (!user) return;

            const payload = {
                user_id: user.id,
                lender_name: form.lender_name,
                principal_amount: parseFloat(form.principal_amount),
                interest_rate: parseFloat(form.interest_rate) / 100, // % to Decimal
                rate_interval: form.rate_interval as any,
                start_date: form.start_date
            };

            if (isEditing && editId) {
                const { error } = await supabase.from('personal_borrowings').update(payload).eq('id', editId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('personal_borrowings').insert(payload);
                if (error) throw error;
            }

            // Reset
            setIsAdding(false);
            setIsEditing(false);
            setEditId(null);
            setForm({
                lender_name: '',
                principal_amount: '',
                interest_rate: '',
                rate_interval: 'ANNUALLY',
                start_date: new Date().toISOString().split('T')[0]
            });
            fetchLiabilities();
        } catch (e) {
            console.error(e);
            alert('Error saving record');
        }
    };

    const handleEditClick = (l: Liability) => {
        setForm({
            lender_name: l.lender_name,
            principal_amount: l.principal_amount.toString(),
            interest_rate: (l.interest_rate * 100).toString(), // Decimal to %
            rate_interval: l.rate_interval,
            start_date: l.start_date
        });
        setEditId(l.id);
        setIsEditing(true);
        setIsAdding(true); // Reuse the add modal/form visibility
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!confirm('Are you sure you want to delete this record?')) return;
        try {
            const { error } = await supabase.from('personal_borrowings').delete().eq('id', id);
            if (error) throw error;
            fetchLiabilities();
        } catch (e) {
            console.error(e);
        }
    };

    const handleMerge = async () => {
        if (!mergeName.trim() || selectedIds.length === 0) return;
        try {
            // Batch update lender_name
            const { error } = await supabase
                .from('personal_borrowings')
                .update({ lender_name: mergeName })
                .in('id', selectedIds);

            if (error) throw error;

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

    const totalPrincipal = liabilities.reduce((sum, l) => sum + l.principal_amount, 0);
    const totalInterest = liabilities.reduce((sum, l) => sum + (l.accrued_interest || 0), 0);

    // Grouping Logic
    const groupedLiabilities = Object.values(liabilities.reduce((acc, l) => {
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
                            <p className="text-zinc-500 text-sm mt-1">Track funds you have borrowed</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Toggles */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 flex">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
                            >
                                List
                            </button>
                            <button
                                onClick={() => setViewMode('groups')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'groups' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
                            >
                                Grouped
                            </button>
                        </div>

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
                                setForm({
                                    lender_name: '',
                                    principal_amount: '',
                                    interest_rate: '',
                                    rate_interval: 'ANNUALLY',
                                    start_date: new Date().toISOString().split('T')[0]
                                });
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Lender Name</label>
                                <input required type="text" value={form.lender_name} onChange={e => setForm({ ...form, lender_name: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" placeholder="e.g. Bank, Friend" />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Principal Amount</label>
                                <input required type="number" value={form.principal_amount} onChange={e => setForm({ ...form, principal_amount: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Interest Rate (%)</label>
                                <input required type="number" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" placeholder="12" />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Interval</label>
                                <select value={form.rate_interval} onChange={e => setForm({ ...form, rate_interval: e.target.value as any })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none">
                                    <option value="ANNUALLY">Annually</option>
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="DAILY">Daily</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Start Date</label>
                                <input required type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none" />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                                {isEditing ? 'Update Record' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                )}

                {/* List Content */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-12 text-zinc-500">Loading liabilities...</div>
                    ) : liabilities.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">No liabilities recorded.</div>
                    ) : (
                        viewMode === 'list' ? (
                            // LIST VIEW
                            liabilities.map(l => (
                                <div key={l.id} className={`glass-panel p-6 rounded-xl hover:border-red-500/30 transition-colors group relative ${selectedIds.includes(l.id) ? 'border-emerald-500/50 bg-emerald-900/10' : ''}`}>
                                    {/* Selection Checkbox */}
                                    {selectedIds.length > 0 || viewMode === 'list' ? (
                                        <div className="absolute top-4 left-4 z-10">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(l.id)}
                                                onChange={() => toggleSelection(l.id)}
                                                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500 mb-4"
                                            />
                                        </div>
                                    ) : null}

                                    <div className="flex justify-end absolute top-4 right-4 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditClick(l)} className="p-2 text-zinc-600 hover:text-white bg-zinc-800 rounded-lg font-medium text-xs">Edit</button>
                                        <button onClick={(e) => handleDelete(l.id, e)} className="p-2 text-zinc-600 hover:text-red-500 bg-zinc-800 rounded-lg font-medium text-xs"><Trash2 className="w-3 h-3" /></button>
                                    </div>

                                    <div className="pl-8"> {/* Indent for checkbox */}
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-medium text-white">{l.lender_name}</h3>
                                                <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                                                    <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-white">
                                                        {(l.interest_rate * 100).toFixed(2)}% {l.rate_interval}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-xs">
                                                        <Calendar className="w-3 h-3" /> Since {new Date(l.start_date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right pr-12">
                                                <div className="text-2xl font-bold text-white">{formatCurrency(l.total_due || 0)}</div>
                                                <div className="text-xs text-zinc-500">Total Due</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                                            <div><span className="text-xs text-zinc-500 block mb-1">Principal</span><span className="text-white font-mono">{formatCurrency(l.principal_amount)}</span></div>
                                            <div className="text-right"><span className="text-xs text-zinc-500 block mb-1">Accrued Interest ({l.days_elapsed} days)</span><span className="text-red-400 font-mono">{formatCurrency(l.accrued_interest || 0)}</span></div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            // GROUPED VIEW
                            groupedLiabilities.map((g: any, idx) => (
                                <div key={idx} className="glass-panel p-6 rounded-xl border-zinc-800">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-red-900/20 text-red-500 rounded-xl">
                                                <Wallet className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-white">{g.name}</h3>
                                                <p className="text-zinc-500 text-sm">{g.count} Loans</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-white">{formatCurrency(g.principal + g.interest)}</div>
                                            <div className="text-xs text-zinc-500">Total Family Liability</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {g.items.map((l: any) => (
                                            <div key={l.id} className="bg-black/50 border border-zinc-800 p-4 rounded-lg flex justify-between items-center">
                                                <div>
                                                    <div className="text-sm text-white font-medium">
                                                        {formatCurrency(l.principal_amount)} @ {(l.interest_rate * 100).toFixed(2)}%
                                                    </div>
                                                    <div className="text-xs text-zinc-500">{new Date(l.start_date).toLocaleDateString()}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-red-400">{formatCurrency(l.accrued_interest)}</div>
                                                    <div className="text-[10px] text-zinc-600">Interest</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )
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
        </main>
    );
}
