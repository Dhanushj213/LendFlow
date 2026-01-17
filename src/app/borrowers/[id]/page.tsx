'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wallet, TrendingUp, Calendar, ChevronRight } from 'lucide-react';

interface Borrower {
    id: string;
    name: string;
    email?: string;
    phone?: string;
}

interface Loan {
    id: string;
    borrower: { name: string };
    current_principal: number;
    accrued_interest: number;
    status: string;
    interest_rate: number;
    rate_interval: string;
    start_date: string;
    principal_amount: number;
}

export default function BorrowerProfile({ params }: { params: { id: string } }) {
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Borrower Details
                const { data: borrowerData, error: borrowerError } = await supabase
                    .from('borrowers')
                    .select('*')
                    .eq('id', params.id)
                    .single();

                if (borrowerError) throw borrowerError;
                setBorrower(borrowerData);

                // 2. Fetch Loans for this Borrower
                const { data: loansData, error: loansError } = await supabase
                    .from('loans')
                    .select('*, borrower:borrowers(name)')
                    .eq('borrower_id', params.id)
                    .order('created_at', { ascending: false });

                if (loansError) throw loansError;
                setLoans(loansData || []);

            } catch (e: any) {
                console.error(e);
                setErrorMsg(e.message || JSON.stringify(e));
                // router.push('/'); // Redirect on error for now? Or show error state
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [params.id, router, supabase]);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

    const totalPrincipal = loans
        .filter(l => l.status === 'ACTIVE')
        .reduce((sum, l) => sum + l.current_principal, 0);

    const totalInterest = loans
        .filter(l => l.status === 'ACTIVE')
        .reduce((sum, l) => sum + l.accrued_interest, 0);

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');

    const handleRename = async () => {
        if (!borrower || !editName.trim()) return;

        try {
            const { error } = await supabase
                .from('borrowers')
                .update({ name: editName })
                .eq('id', borrower.id);

            if (error) throw error;
            setBorrower({ ...borrower, name: editName });
            setIsEditing(false);
        } catch (e) {
            console.error(e);
            alert('Error renaming borrower');
        }
    };

    const [isAddingLoan, setIsAddingLoan] = useState(false);
    const [availableLoans, setAvailableLoans] = useState<Loan[]>([]);

    const fetchAvailableLoans = async () => {
        try {
            const { data: loansData, error: loansError } = await supabase
                .from('loans')
                .select('*, borrower:borrowers(name)')
                .neq('borrower_id', params.id) // Not current borrower
                .eq('status', 'ACTIVE') // Only active
                .order('created_at', { ascending: false });

            if (loansError) throw loansError;
            setAvailableLoans(loansData || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddLoan = async (loan: Loan) => {
        try {
            const { error: updateError } = await supabase
                .from('loans')
                .update({
                    borrower_id: params.id,
                    title: (loan as any).title || loan.borrower.name // Use existing title or borrower name
                })
                .eq('id', loan.id);

            if (updateError) throw updateError;

            // Clean up old borrower if empty? (Optional, maybe risky if user wants to keep empty profile)
            // For now, just move the loan.

            setIsAddingLoan(false);
            setLoans([...loans, { ...loan, borrower: { ...loan.borrower }, title: (loan as any).title || loan.borrower.name } as any]);

            // Recalculate totals locally or refresh would be better but this is faster UI
            window.location.reload(); // Simplest to sync everything perfectly

        } catch (e) {
            console.error(e);
            alert('Error adding loan to group');
        }
    };

    const handleUnmerge = async (loanId: string, loanTitle: string) => {
        if (!confirm('Are you sure you want to detach this loan?')) return;
        try {
            // 1. Create or Find Borrower for just this loan
            // Ideally we find existing, but simple way is create new one with title name
            const newName = loanTitle || 'Unbundled Loan';

            const { data: newBorrower, error: createError } = await supabase
                .from('borrowers')
                .insert({ name: newName, user_id: (await supabase.auth.getUser()).data.user?.id })
                .select()
                .single();

            if (createError) throw createError;

            // 2. Move Loan
            const { error: moveError } = await supabase
                .from('loans')
                .update({
                    borrower_id: newBorrower.id,
                    title: null // Clear title as it is now the borrower name
                })
                .eq('id', loanId);

            if (moveError) throw moveError;

            // 3. Update Local State
            setLoans(loans.filter(l => l.id !== loanId));

        } catch (e) {
            console.error(e);
            alert('Error detaching loan');
        }
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Loading Profile...</div>;
    if (!borrower) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Borrower not found</div>;

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
                            <h1 className="text-2xl md:text-3xl font-bold text-white">{borrower.name}</h1>
                            <div className="flex gap-4 text-sm text-zinc-500 mt-1">
                                {borrower.phone && <span>{borrower.phone}</span>}
                                {borrower.email && <span>{borrower.email}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                fetchAvailableLoans();
                                setIsAddingLoan(true);
                            }}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-emerald-500 hover:text-emerald-400 rounded-lg transition-colors text-sm font-medium border border-zinc-800"
                        >
                            + Add Loan
                        </button>
                        <button
                            onClick={() => {
                                setEditName(borrower.name);
                                setIsEditing(true);
                            }}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors text-sm font-medium border border-zinc-800"
                        >
                            Edit Group
                        </button>
                    </div>
                </div>

                {/* Combined Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <Wallet className="w-5 h-5 text-emerald-500" />
                            </div>
                            <span className="text-zinc-400 text-sm font-medium">Total Principal</span>
                        </div>
                        <div className="text-2xl font-bold text-white">
                            {formatCurrency(totalPrincipal)}
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                            </div>
                            <span className="text-zinc-400 text-sm font-medium">Total Interest</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-400">
                            {formatCurrency(totalInterest)}
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl flex items-center justify-between">
                        <div>
                            <span className="text-zinc-400 text-sm block">Active Loans</span>
                            <span className="text-2xl font-bold text-white">{loans.filter(l => l.status === 'ACTIVE').length}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-zinc-400 text-sm block">Closed</span>
                            <span className="text-xl font-bold text-zinc-600">{loans.filter(l => l.status === 'CLOSED').length}</span>
                        </div>
                    </div>
                </div>

                {/* Loan List */}
                <section>
                    <h2 className="text-xl font-bold text-white mb-4">Loan History</h2>
                    <div className="space-y-4">
                        {loans.map(loan => (
                            <Link href={`/loans/${loan.id}`} key={loan.id} className="block group">
                                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl hover:border-emerald-500/50 transition-all cursor-pointer relative overflow-hidden">
                                    {loan.status === 'CLOSED' && (
                                        <div className="absolute top-0 right-0 bg-zinc-800 text-zinc-500 text-xs px-3 py-1 rounded-bl-xl font-medium">
                                            CLOSED
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-colors">
                                                <Calendar className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="text-white font-medium">
                                                    {(loan as any).title ? <div className="text-xs text-zinc-500 font-normal mb-0.5">{(loan as any).title}</div> : null}
                                                    {formatCurrency(loan.principal_amount)} Loan
                                                </div>
                                                <div className="text-sm text-zinc-500">
                                                    Started {new Date(loan.start_date).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleUnmerge(loan.id, (loan as any).title);
                                                }}
                                                className="p-2 hover:bg-zinc-800 text-zinc-500 hover:text-red-500 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                title="Un-merge / Detach"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                            </button>
                                            <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
                                        <div>
                                            <span className="text-xs text-zinc-500 block mb-1">Current Balance</span>
                                            <span className="text-white font-mono">{formatCurrency(loan.current_principal)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-zinc-500 block mb-1">Accrued Interest</span>
                                            <span className="text-blue-400 font-mono">{formatCurrency(loan.accrued_interest)}</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                        {loans.length === 0 && (
                            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                                No loans found for this borrower.
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Edit Modal */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 max-h-[90vh] flex flex-col">
                        <h3 className="text-xl font-bold text-white mb-6">Edit Group</h3>

                        <div className="space-y-6 flex-1 overflow-y-auto min-h-0">
                            {/* Rename Section */}
                            <div>
                                <label className="text-xs text-zinc-500 block mb-2">Group Name</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                        placeholder="Borrower Name"
                                    />
                                    <button
                                        onClick={handleRename}
                                        disabled={!editName.trim() || editName === borrower.name}
                                        className="px-4 bg-zinc-800 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>

                            {/* Un-merge Section */}
                            <div>
                                <h4 className="text-sm font-medium text-zinc-400 mb-3">Manage Portfolios</h4>
                                <div className="space-y-3">
                                    {loans.map(loan => (
                                        <div key={loan.id} className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-white font-medium">
                                                    {(loan as any).title || 'Untitled Portfolio'}
                                                </div>
                                                <div className="text-xs text-zinc-500">
                                                    {formatCurrency(loan.principal_amount)} • {new Date(loan.start_date).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleUnmerge(loan.id, (loan as any).title)}
                                                className="text-xs text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded transition-colors"
                                            >
                                                Un-merge
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-zinc-800">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="w-full py-3 rounded-xl font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Loan Modal */}
            {isAddingLoan && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
                        <h3 className="text-xl font-bold text-white mb-6">Add Loan to Group</h3>

                        <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
                            {availableLoans.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500">No other active loans found.</div>
                            ) : (
                                availableLoans.map(loan => (
                                    <button
                                        key={loan.id}
                                        onClick={() => handleAddLoan(loan)}
                                        className="w-full bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between transition-colors group text-left"
                                    >
                                        <div>
                                            <div className="text-white font-medium group-hover:text-emerald-400 transition-colors">
                                                {(loan as any).title || loan.borrower.name}
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-1">
                                                {formatCurrency(loan.principal_amount)} • {new Date(loan.start_date).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="p-2 bg-zinc-800 rounded text-emerald-500 opacity-0 group-hover:opacity-100 transition-all">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </div>
                                    </button>
                                )))}
                        </div>

                        <div className="mt-6 pt-4 border-t border-zinc-800">
                            <button
                                onClick={() => setIsAddingLoan(false)}
                                className="w-full py-3 rounded-xl font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
