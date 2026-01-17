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
    const [isAdding, setIsAdding] = useState(false);
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

                // Simple Interest for now (mimicking the Calculator default)
                // If user wants Compound, we can add a field later. Defaulting to Simple.
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

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase.from('personal_borrowings').insert({
                user_id: user.id,
                lender_name: form.lender_name,
                principal_amount: parseFloat(form.principal_amount),
                interest_rate: parseFloat(form.interest_rate) / 100, // Convert % to decimal
                rate_interval: form.rate_interval,
                start_date: form.start_date
            });

            if (error) throw error;

            setIsAdding(false);
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
            alert('Error adding borrowing');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this record?')) return;
        try {
            const { error } = await supabase.from('personal_borrowings').delete().eq('id', id);
            if (error) throw error;
            fetchLiabilities();
        } catch (e) {
            console.error(e);
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

    const totalPrincipal = liabilities.reduce((sum, l) => sum + l.principal_amount, 0);
    const totalInterest = liabilities.reduce((sum, l) => sum + (l.accrued_interest || 0), 0);

    return (
        <main className="min-h-screen bg-black p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
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
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isAdding ? 'bg-zinc-800 text-white' : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'}`}
                    >
                        {isAdding ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Borrowing</>}
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-panel p-6 rounded-xl border-red-500/10">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-zinc-400 text-sm font-medium">Total Principal Owed</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {formatCurrency(totalPrincipal)}
                        </div>
                    </div>
                    <div className="glass-panel p-6 rounded-xl border-red-500/10">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-zinc-400 text-sm font-medium">Accrued Interest</span>
                        </div>
                        <div className="text-2xl font-bold text-red-400">
                            {formatCurrency(totalInterest)}
                        </div>
                    </div>
                    <div className="glass-panel p-6 rounded-xl border-red-500/10">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-zinc-400 text-sm font-medium">Total Liability Due</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {formatCurrency(totalPrincipal + totalInterest)}
                        </div>
                    </div>
                </div>

                {isAdding && (
                    <form onSubmit={handleAdd} className="glass-panel p-6 rounded-xl space-y-4 border-red-500/20 animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-lg font-medium text-white mb-4">Add New Borrowing</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Lender Name</label>
                                <input
                                    required
                                    type="text"
                                    value={form.lender_name}
                                    onChange={e => setForm({ ...form, lender_name: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none"
                                    placeholder="e.g. Bank, Friend"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Principal Amount</label>
                                <input
                                    required
                                    type="number"
                                    value={form.principal_amount}
                                    onChange={e => setForm({ ...form, principal_amount: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Interest Rate (%)</label>
                                <input
                                    required
                                    type="number"
                                    value={form.interest_rate}
                                    onChange={e => setForm({ ...form, interest_rate: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none"
                                    placeholder="12"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Interval</label>
                                <select
                                    value={form.rate_interval}
                                    onChange={e => setForm({ ...form, rate_interval: e.target.value as any })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none"
                                >
                                    <option value="ANNUALLY">Annually</option>
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="DAILY">Daily</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Start Date</label>
                                <input
                                    required
                                    type="date"
                                    value={form.start_date}
                                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:border-red-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                            >
                                Save Record
                            </button>
                        </div>
                    </form>
                )}

                {/* List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-12 text-zinc-500">Loading liabilities...</div>
                    ) : liabilities.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                            No liabilities recorded.
                        </div>
                    ) : (
                        liabilities.map(l => (
                            <div key={l.id} className="glass-panel p-6 rounded-xl hover:border-red-500/30 transition-colors group relative">
                                <button
                                    onClick={() => handleDelete(l.id)}
                                    className="absolute top-4 right-4 p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium text-white">{l.lender_name}</h3>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                                            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs">
                                                {(l.interest_rate * 100).toFixed(2)}% {l.rate_interval}
                                            </span>
                                            <span className="flex items-center gap-1 text-xs">
                                                <Calendar className="w-3 h-3" /> Since {new Date(l.start_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right pr-8">
                                        <div className="text-2xl font-bold text-white">
                                            {formatCurrency(l.total_due || 0)}
                                        </div>
                                        <div className="text-xs text-zinc-500">Total Due</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                                    <div>
                                        <span className="text-xs text-zinc-500 block mb-1">Principal</span>
                                        <span className="text-white font-mono">{formatCurrency(l.principal_amount)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-zinc-500 block mb-1">Accrued Interest ({l.days_elapsed} days)</span>
                                        <span className="text-red-400 font-mono">{formatCurrency(l.accrued_interest || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </main>
    );
}
