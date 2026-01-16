'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function CreateLoan() {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        borrowerName: '',
        principalAmount: '',
        interestRate: '',
        rateType: 'ANNUALLY',
        interestType: 'SIMPLE',
        startDate: new Date().toISOString().split('T')[0]
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // 1. Create or Find Borrower (Simplified: Always Create New for now)
            const { data: borrower, error: borrowerError } = await supabase
                .from('borrowers')
                .insert({
                    user_id: user.id,
                    name: formData.borrowerName
                })
                .select()
                .single();

            if (borrowerError) throw borrowerError;

            // 2. Create Loan
            const { error: loanError } = await supabase
                .from('loans')
                .insert({
                    user_id: user.id,
                    borrower_id: borrower.id,
                    principal_amount: parseFloat(formData.principalAmount),
                    current_principal: parseFloat(formData.principalAmount),
                    interest_rate: parseFloat(formData.interestRate),
                    rate_interval: formData.rateType,
                    interest_type: formData.interestType,
                    status: 'ACTIVE',
                    start_date: formData.startDate,
                    last_accrual_date: formData.startDate
                });

            if (loanError) throw loanError;

            router.push('/');
            router.refresh();

        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-black p-4 md:p-8 flex items-center justify-center">
            <div className="w-full max-w-2xl">
                <Link href="/" className="text-zinc-500 hover:text-white flex items-center gap-2 mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-white mb-2">Originate New Loan</h1>
                        <p className="text-zinc-400">Set up principal and interest terms.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Borrower Name</label>
                            <input
                                name="borrowerName"
                                required
                                className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                                placeholder="e.g. John Doe"
                                value={formData.borrowerName}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Principal (₹)</label>
                                <input
                                    name="principalAmount"
                                    type="number"
                                    step="0.01"
                                    required
                                    className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="0.00"
                                    value={formData.principalAmount}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Start Date</label>
                                <input
                                    name="startDate"
                                    type="date"
                                    required
                                    className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                                    value={formData.startDate}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Interest Rate (Decimal)</label>
                                <input
                                    name="interestRate"
                                    type="number"
                                    step="0.0001"
                                    required
                                    className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                                    placeholder="0.12"
                                    value={formData.interestRate}
                                    onChange={handleChange}
                                />
                                <p className="text-xs text-zinc-500">Ex: 0.12 = 12%</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Rate Period</label>
                                <select
                                    name="rateType"
                                    className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                                    value={formData.rateType}
                                    onChange={handleChange}
                                >
                                    <option value="ANNUALLY">Annually (APR)</option>
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="DAILY">Daily</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300">Interest Type</label>
                            <select
                                name="interestType"
                                className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                                value={formData.interestType}
                                onChange={handleChange}
                            >
                                <option value="SIMPLE">Simple Interest (Daily)</option>
                                <option value="COMPOUND">Compound Interest (Daily)</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? 'Creating...' : 'Create Loan'}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
