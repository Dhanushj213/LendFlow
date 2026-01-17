'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { ArrowLeft, Wallet, Calendar, Tag, CreditCard, Banknote, RefreshCcw, Search } from 'lucide-react';
import Link from 'next/link';

interface PaymentRecord {
    id: string;
    amount: number;
    payment_date: string;
    payment_mode: string;
    category: string;
    title: string;
    created_at: string;
}

export default function HistoryPage() {
    const [history, setHistory] = useState<PaymentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const supabase = createClient();

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('payment_history')
                .select('*')
                .eq('user_id', user.id)
                .order('payment_date', { ascending: false });

            if (error) throw error;
            setHistory(data || []);
        } catch (e) {
            console.error('Error fetching history:', e);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
    };

    const getModeIcon = (mode: string) => {
        switch (mode) {
            case 'UPI': return <Wallet className="w-4 h-4" />;
            case 'CASH': return <Banknote className="w-4 h-4" />;
            case 'BANK_TRANSFER': return <RefreshCcw className="w-4 h-4" />;
            default: return <CreditCard className="w-4 h-4" />;
        }
    };

    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case 'EMI': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            case 'INSURANCE': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
            case 'REMINDER': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'SIP': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            default: return 'text-zinc-500 bg-zinc-800 border-zinc-700';
        }
    };

    const filteredHistory = history.filter(h =>
        h.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <main className="min-h-screen bg-black text-white p-4 md:p-8 pb-32">
            <div className="max-w-xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/" className="p-2 bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-zinc-400" />
                    </Link>
                    <h1 className="text-2xl font-bold">Payment History</h1>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search payments..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-zinc-700 transition-colors"
                    />
                </div>

                {/* List */}
                {loading ? (
                    <div className="text-center py-12 text-zinc-500">Loading history...</div>
                ) : filteredHistory.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 border border-zinc-800 border-dashed rounded-xl">
                        No payments found.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredHistory.map((item) => (
                            <div key={item.id} className="glass-panel p-4 rounded-xl flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${getCategoryColor(item.category)}`}>
                                        <Tag className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm md:text-base">{item.title || 'Unknown Payment'}</h3>
                                        <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(item.payment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                {getModeIcon(item.payment_mode)}
                                                {item.payment_mode}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-mono font-bold">{formatCurrency(item.amount)}</div>
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{item.category}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
