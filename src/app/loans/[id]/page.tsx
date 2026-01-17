'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ArrowLeft, Loader2, ArrowUpRight, ArrowDownLeft, Clock, Pencil, Calculator, Calendar, X } from 'lucide-react';
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
    borrower: { id: string, name: string };
    principal_amount: number;
    current_principal: number;
    accrued_interest: number;
    interest_rate: number;
    rate_interval: string;
    interest_type: string; // Added
    start_date: string; // Added
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

    // Edit Loan State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        principal_amount: 0,
        interest_rate: 0,
        rate_interval: 'MONTHLY',
        start_date: '',
        interest_type: 'SIMPLE'
    });

    // Forecast State
    const [isForecasting, setIsForecasting] = useState(false);
    const [forecastDate, setForecastDate] = useState('');
    const [forecastResult, setForecastResult] = useState<null | { days: number, interest: number, total: number }>(null);

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
                .select(`*, borrower:borrowers(id, name)`)
                .eq('id', id)
                .single();

            if (loanError) throw loanError;
            setLoan(loanData as any);

            // Initialize Edit Form
            setEditForm({
                name: loanData.title || loanData.borrower.name,
                principal_amount: loanData.principal_amount,
                interest_rate: loanData.interest_rate * 100, // Convert decimal (0.05) to % (5.0) for all types
                rate_interval: loanData.rate_interval,
                start_date: loanData.start_date,
                interest_type: loanData.interest_type
            });

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

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // 1. Update Name (Borrower or Loan Title)
            const isMergedLoan = (loan as any).title; // Check if it was merged

            if (isMergedLoan) {
                // Update Loan Title
                const { error: titleError } = await supabase
                    .from('loans')
                    .update({ title: editForm.name })
                    .eq('id', id);

                if (titleError) throw titleError;
            } else {
                // Update Borrower Group Name
                const { error: borrowerError } = await supabase
                    .from('borrowers')
                    .update({ name: editForm.name })
                    .eq('id', loan.borrower.id);

                if (borrowerError) {
                    if (borrowerError.message.includes("policy")) {
                        alert("Database Error: You need to enable 'Update' permissions in Supabase.\n\nRun this SQL:\ncreate policy \"Users can update own borrowers\" on borrowers for update using (auth.uid() = user_id);");
                    }
                    throw borrowerError;
                }
            }

            // 2. Update Loan Details
            // Convert rate back to decimal
            let rateDecimal = editForm.interest_rate;
            if (editForm.rate_interval === 'ANNUALLY') rateDecimal = editForm.interest_rate / 100;
            else if (editForm.rate_interval === 'DAILY') rateDecimal = editForm.interest_rate / 100;
            else rateDecimal = editForm.interest_rate / 100;

            // Calculate delta for principal to keep math consistent
            const principalDelta = editForm.principal_amount - loan.principal_amount;
            const newCurrentPrincipal = loan.current_principal + principalDelta;

            // Recalculate Accrued Interest from Start Date to NOW with NEW TERMS
            // This fixes history if the user corrects the Rate or Start Date
            const startDate = new Date(editForm.start_date);
            const now = new Date();
            const diffTime = now.getTime() - startDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let newAccruedInterest = 0;
            if (diffDays > 0) {
                let dailyRate = 0;
                if (editForm.rate_interval === 'ANNUALLY') dailyRate = rateDecimal / 365.0;
                else if (editForm.rate_interval === 'MONTHLY') dailyRate = rateDecimal / 30.0;
                else dailyRate = rateDecimal;

                // Use current principal as base for robust simple correction
                const base = newCurrentPrincipal;

                if (editForm.interest_type === 'SIMPLE') {
                    newAccruedInterest = base * dailyRate * diffDays;
                } else {
                    const amount = base * Math.pow((1 + dailyRate), diffDays);
                    newAccruedInterest = amount - base;
                }
            }

            const { error: loanUpdateError } = await supabase
                .from('loans')
                .update({
                    principal_amount: editForm.principal_amount,
                    current_principal: newCurrentPrincipal,
                    interest_rate: rateDecimal,
                    rate_interval: editForm.rate_interval,
                    start_date: editForm.start_date,
                    interest_type: editForm.interest_type,
                    accrued_interest: newAccruedInterest, // Update with re-calc
                    last_accrual_date: new Date().toISOString() // Synced up to now
                })
                .eq('id', id);

            if (loanUpdateError) throw loanUpdateError;

            setIsEditing(false);
            await fetchLoanData();
            alert('Loan details updated successfully!');
        } catch (e: any) {
            console.error(e);
            if (!e.message.includes("policy")) alert('Update Error: ' + e.message);
        }
    };

    const handleForecast = () => {
        if (!forecastDate) {
            alert('Please select a date.');
            return;
        }
        const target = new Date(forecastDate);
        const now = new Date();
        const start = new Date(loan.start_date);

        let interest = 0;
        let diffDays = 0;

        // Helper Calculation
        const calculateInterest = (principal: number, days: number) => {
            let dailyRate = 0;
            // Use DB stored rate (decimal)
            let rateDecimal = loan.interest_rate;

            if (loan.rate_interval === 'ANNUALLY') dailyRate = rateDecimal / 365.0;
            else if (loan.rate_interval === 'MONTHLY') dailyRate = rateDecimal / 30.0;
            else dailyRate = rateDecimal;

            if (loan.interest_type === 'SIMPLE') {
                return principal * dailyRate * days;
            } else {
                const amount = principal * Math.pow((1 + dailyRate), days);
                return amount - principal;
            }
        };

        if (target < now) {
            // Past Calculation: Interest from Start to Target
            const diffTime = target.getTime() - start.getTime();
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) {
                setForecastResult({ days: 0, interest: 0, total: loan.current_principal });
                return;
            }

            interest = calculateInterest(loan.current_principal, diffDays);
        } else {
            // Future Calculation: Current Accrued + Interest from Now to Target
            const diffTime = target.getTime() - now.getTime();
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const futureInterest = calculateInterest(loan.current_principal, diffDays);
            interest = loan.accrued_interest + futureInterest;
            // Note: interest here represents "Total Interest Accrued by Target Date"
        }

        const total = loan.current_principal + interest;

        setForecastResult({
            days: diffDays,
            interest: interest,
            total: total
        });
    };

    return (
        <main className="min-h-screen bg-black p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <Link href="/" className="text-zinc-500 hover:text-white flex items-center gap-2 mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>

                {/* Modals */}
                {isEditing && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative">
                            <button onClick={() => setIsEditing(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                            <h2 className="text-xl font-bold text-white mb-6">Edit Loan Details</h2>
                            <form onSubmit={handleEditSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Borrower Name</label>
                                    <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-1">Principal Amount</label>
                                        <input
                                            type="number"
                                            value={editForm.principal_amount || ''}
                                            onChange={e => setEditForm({ ...editForm, principal_amount: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-1">Start Date</label>
                                        <input type="date" value={editForm.start_date} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-1">Interest Rate (%)</label>
                                        <input
                                            type="number"
                                            value={editForm.interest_rate || ''}
                                            onChange={e => setEditForm({ ...editForm, interest_rate: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-1">Interval</label>
                                        <select value={editForm.rate_interval} onChange={e => setEditForm({ ...editForm, rate_interval: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none">
                                            <option value="MONTHLY">Monthly</option>
                                            <option value="ANNUALLY">Annually</option>
                                            <option value="DAILY">Daily</option>
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl mt-4">Save Changes</button>
                            </form>
                        </div>
                    </div>
                )}

                {isForecasting && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
                            <button onClick={() => { setIsForecasting(false); setForecastResult(null); }} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-emerald-500" /> Interest Forecaster
                            </h2>
                            <p className="text-sm text-zinc-400 mb-6">Calculate accrued interest for your required date.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-400 block mb-1">Select Target Date</label>
                                    <input
                                        type="date"
                                        value={forecastDate}
                                        onChange={e => setForecastDate(e.target.value)}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <button onClick={handleForecast} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-xl border border-zinc-700">
                                    Calculate
                                </button>

                                {forecastResult && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mt-4 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-400">Calculation Days</span>
                                            <span className="text-white font-mono">{forecastResult.days} days</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-400">Total Interest</span>
                                            <span className="text-emerald-400 font-mono font-bold">
                                                {formatCurrency(forecastResult.interest)}
                                            </span>
                                        </div>
                                        <div className="border-t border-emerald-500/20 pt-2 flex justify-between items-center">
                                            <span className="text-emerald-500 font-medium">Total Due</span>
                                            <span className="text-xl font-bold text-white font-mono">
                                                {formatCurrency(forecastResult.total)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Header Actions */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl md:text-3xl font-bold text-white">{(loan as any).title || loan.borrower?.name}</h1>
                            <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors">
                                <Pencil className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-zinc-400">
                            <span className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
                                {loan.rate_interval} Rate: {(loan.interest_rate * (loan.rate_interval === 'ANNUALLY' || loan.rate_interval === 'DAILY' ? 100 : 1)).toFixed(2)}%
                            </span>
                            <span className={`px-3 py-1 rounded-full border ${loan.status === 'ACTIVE' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                                {loan.status}
                            </span>
                            <button onClick={() => setIsForecasting(true)} className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                                <Calendar className="w-3 h-3" /> Forecast Interest
                            </button>
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
                                <div className="text-2xl md:text-3xl font-bold text-white mt-1">{formatCurrency(totalDue)}</div>
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
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
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
