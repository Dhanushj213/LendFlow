'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ArrowLeft, Loader2, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import Link from 'next/link';

interface Transaction {
    id: string;
    amount: number;
    type: string;
    breakdown: any;
    created_at: string;
}

interface Loan {
    id: string;
    borrower: { name: string };
    principal_amount: number;
    current_principal: number;
    accrued_interest: number;
    interest_rate: number;
    rate_interval: string;
    status: string;
    last_accrual_date: string;
}

export default function LoanDetail() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const supabase = createClient();

    const [loan, setLoan] = useState<Loan | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [isPaying, setIsPaying] = useState(false);

    useEffect(() => {
        if (id) fetchLoanData();
    }, [id]);

    const fetchLoanData = async () => {
        try {
            // 1. Sync Interest first
            await supabase.rpc('sync_loan_interest', { p_loan_id: id });

            // 2. Fetch Loan
            const { data: loanData, error: loanError } = await supabase
                .from('loans')
                .select(`*, borrower:borrowers(name)`)
                .eq('id', id)
                .single();

            if (loanError) throw loanError;
            setLoan(loanData as any);

            // 3. Fetch Transactions
            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .select('*')
                .eq('loan_id', id)
                .order('created_at', { ascending: false });

            if (txError) throw txError;
            setTransactions(txData || []);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsPaying(true);

        try {
            const { error } = await supabase.rpc('submit_payment', {
                p_loan_id: id,
                p_amount: parseFloat(paymentAmount)
            });

            if (error) throw error;

            setPaymentAmount('');
            fetchLoanData(); // Refresh all data
        } catch (error: any) {
            alert('Payment Error: ' + error.message);
        } finally {
            setIsPaying(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading Ledger...
        </div>
    );

    if (!loan) return <div className="text-zinc-500 p-8">Loan not found.</div>;

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

    const totalDue = loan.current_principal + loan.accrued_interest;

    return (
        <main className="min-h-screen bg-black p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="text-zinc-500 hover:text-white flex items-center gap-2 mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>

                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">{loan.borrower?.name}</h1>
                        <div className="flex items-center gap-4 text-sm text-zinc-400">
                            <span className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
                                {loan.rate_interval} Rate: {(loan.interest_rate * (loan.rate_interval === 'ANNUALLY' || loan.rate_interval === 'DAILY' ? 100 : 1)).toFixed(2)}%
                            </span>
                            <span className={`px-3 py-1 rounded-full border ${loan.status === 'ACTIVE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                                {loan.status}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Stats */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                            <span className="text-zinc-500 text-sm">Principal Balance</span>
                            <div className="text-2xl font-bold text-white mt-1">{formatCurrency(loan.current_principal)}</div>
                        </div>
                        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                            <span className="text-zinc-500 text-sm">Accrued Interest</span>
                            <div className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(loan.accrued_interest)}</div>
                        </div>
                        <div className="col-span-2 bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-zinc-800 p-6 rounded-xl flex justify-between items-center">
                            <div>
                                <span className="text-zinc-500 text-sm">Total Payoff Amount</span>
                                <div className="text-3xl font-bold text-white mt-1">{formatCurrency(totalDue)}</div>
                            </div>
                            <div className="text-right">
                                <span className="text-zinc-500 text-sm block">Original Loan</span>
                                <span className="text-zinc-300 font-mono">{formatCurrency(loan.principal_amount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Form */}
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                        <h3 className="font-semibold text-white mb-4">Record Payment</h3>
                        {loan.status === 'ACTIVE' ? (
                            <form onSubmit={handlePayment} className="space-y-4">
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-zinc-500">₹</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 pl-8 px-4 text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none"
                                        placeholder="0.00"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isPaying}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Payment'}
                                </button>
                                <p className="text-xs text-zinc-500 text-center">
                                    Payments apply to Interest first, then Principal.
                                </p>
                            </form>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-lg">
                                <span className="font-medium">Loan Closed</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Transactions */}
                <section>
                    <h3 className="text-xl font-bold text-white mb-4">Transaction History</h3>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 text-sm">
                                <tr>
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">Type</th>
                                    <th className="p-4 font-medium">Amount</th>
                                    <th className="p-4 font-medium">Breakdown</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {transactions.map(tx => (
                                    <tr key={tx.id} className="group hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4 text-zinc-400 text-sm">
                                            {new Date(tx.created_at).toLocaleDateString()}
                                            <span className="text-xs text-zinc-600 block">{new Date(tx.created_at).toLocaleTimeString()}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${tx.type === 'PAYMENT'
                                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                }`}>
                                                {tx.type === 'PAYMENT' ? <ArrowDownLeft className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className={`p-4 font-mono font-medium ${tx.type === 'PAYMENT' ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                            {tx.type === 'PAYMENT' ? '-' : '+'}{formatCurrency(tx.amount)}
                                        </td>
                                        <td className="p-4 text-sm text-zinc-500">
                                            {tx.type === 'PAYMENT' && tx.breakdown && (
                                                <span className="flex gap-3">
                                                    <span>Prin: {formatCurrency(tx.breakdown.principal)}</span>
                                                    <span>Int: {formatCurrency(tx.breakdown.interest)}</span>
                                                </span>
                                            )}
                                            {tx.type === 'ACCRUAL' && (
                                                <span>Daily Interest Accrual</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    );
}
