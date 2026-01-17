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

            } catch (e) {
                console.error(e);
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

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Loading Profile...</div>;
    if (!borrower) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Borrower not found</div>;

    return (
        <main className="min-h-screen bg-black p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
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
                                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
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
        </main>
    );
}
