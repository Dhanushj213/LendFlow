'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Wallet, TrendingUp, Plus, ArrowRight, History, Calendar, Calculator, Users } from 'lucide-react';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  created_at: string;
}

interface Loan {
  id: string;
  borrower: { name: string };
  current_principal: number;
  accrued_interest: number;
  status: string;
  interest_rate: number;
  rate_interval: string;
  last_accrual_date: string;
  transactions: Transaction[];
  principal_amount: number; // Added for closed loans display
  borrower_id: string;
}

export default function Dashboard() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const [viewMode, setViewMode] = useState<'loans' | 'borrowers'>('loans');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }
      fetchLoans(user.id);
    };
    checkUser();
  }, [router, supabase]);

  const fetchLoans = async (userId: string) => {
    try {
      // 1. Fetch Loans with Transactions
      const { data: loansData, error } = await supabase
        .from('loans')
        .select(`
          *,
          borrower:borrowers(name),
          transactions(*)
        `)
        .order('created_at', { ascending: false });

      // 1.5 Fetch Personal Liabilities
      const { data: liabilitiesData } = await supabase
        .from('personal_borrowings')
        .select('*');

      setLiabilities(liabilitiesData || []);

      if (error) throw error;

      // 2. Trigger Interest Engine for ACTIVE loans
      const activeLoans = loansData?.filter(l => l.status === 'ACTIVE') || [];

      await Promise.all(activeLoans.map(async (loan) => {
        const { error: rpcError } = await supabase.rpc('sync_loan_interest', {
          p_loan_id: loan.id
        });
        if (rpcError) console.error('Interest Sync Error:', rpcError);
      }));

      // 3. Re-fetch to get updated values after Sync
      if (activeLoans.length > 0) {
        const { data: updatedData } = await supabase
          .from('loans')
          .select(`
            *, 
            borrower:borrowers(name),
            transactions(*)
          `)
          .order('created_at', { ascending: false });
        // Sort transactions by date for each loan
        const processedLoans = (updatedData as any || []).map((loan: any) => ({
          ...loan,
          transactions: (loan.transactions || []).sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        }));
        setLoans(processedLoans);
      } else {
        // Sort transactions by date for each loan
        const processedLoans = (loansData as any || []).map((loan: any) => ({
          ...loan,
          transactions: (loan.transactions || []).sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        }));
        setLoans(processedLoans);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalPrincipal = loans
    .filter(l => l.status === 'ACTIVE')
    .reduce((sum, l) => sum + l.current_principal, 0);

  const totalInterest = loans
    .filter(l => l.status === 'ACTIVE')
    .reduce((sum, l) => sum + l.accrued_interest, 0);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  const totalLiabilities = liabilities.reduce((sum, l) => {
    // Calculate simple interest client side for summary
    const start = new Date(l.start_date);
    const now = new Date();
    const splitDate = new Date().toISOString().split('T')[0]; // simple comparison if needed
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let dailyRate = 0;
    if (l.rate_interval === 'ANNUALLY') dailyRate = (l.interest_rate / 100) / 365.0;
    else if (l.rate_interval === 'MONTHLY') dailyRate = (l.interest_rate / 100) / 30.0;
    else dailyRate = l.interest_rate / 100;

    const interest = l.principal_amount * dailyRate * days;
    return sum + l.principal_amount + interest;
  }, 0);

  const groupedBorrowers = Object.values(loans.reduce((acc, loan) => {
    if (!acc[loan.borrower_id]) {
      acc[loan.borrower_id] = {
        id: loan.borrower_id,
        name: loan.borrower?.name || 'Unknown',
        totalPrincipal: 0,
        totalInterest: 0,
        activeCount: 0,
        totalCount: 0,
        loans: []
      };
    }
    const borrower = acc[loan.borrower_id];
    borrower.totalCount++;
    borrower.loans.push(loan);

    if (loan.status === 'ACTIVE') {
      borrower.totalPrincipal += loan.current_principal;
      borrower.totalInterest += loan.accrued_interest;
      borrower.activeCount++;
    }
    return acc;
  }, {} as Record<string, any>)).filter(b => activeTab === 'active' ? b.activeCount > 0 : b.totalCount - b.activeCount > 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-zinc-500">
      Syncing Ledger...
    </div>
  );

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex justify-between items-center">
          <div>
            <div className="relative h-10 w-40 mb-1">
              <Image
                src="/Logo.png"
                alt="LendFlow"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
            <p className="text-zinc-400 text-sm">Portfolio Overview</p>
          </div>

          {/* View Toggle */}
          <div className="hidden md:flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 mr-auto ml-8">
            <button
              onClick={() => setViewMode('loans')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${viewMode === 'loans' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <Users className="w-3 h-3" /> All Loans
            </button>
            <button
              onClick={() => setViewMode('borrowers')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${viewMode === 'borrowers' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <Users className="w-3 h-3" /> Group by Borrower
            </button>
          </div>

          <div className="flex gap-4">
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/auth'); }}
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              Sign Out
            </button>
            <Link
              href="/calculator"
              className="p-2 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800 rounded-full"
              title="Interest Calculator"
            >
              <Calculator className="w-5 h-5" />
            </Link>
            <Link
              href="/liabilities"
              className="p-2 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800 rounded-full"
              title="My Borrowings"
            >
              <Wallet className="w-5 h-5 text-red-400" />
            </Link>
            <Link
              href="/create"
              className="group flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg hover:shadow-emerald-900/20"
            >
              <Plus className="w-4 h-4" />
              <span>New Loan</span>
            </Link>
          </div>
        </header>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Wallet className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-zinc-400 text-sm font-medium">Principal Out</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(totalPrincipal)}
            </div>
          </div>

          <div className="glass-panel p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-zinc-400 text-sm font-medium">Accrued Interest</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {formatCurrency(totalInterest)}
            </div>
          </div>

          <div className="glass-panel p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-zinc-400 text-sm font-medium">Active Loans</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {loans.filter(l => l.status === 'ACTIVE').length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {loans.filter(l => l.status === 'CLOSED').length} Settled
            </div>
          </div>

          <Link href="/liabilities" className="glass-panel p-6 rounded-xl hover:border-red-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
                <Wallet className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-zinc-400 text-sm font-medium">My Liabilities</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(totalLiabilities)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Total Owed
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-4 text-sm font-medium transition-all relative ${activeTab === 'active' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            Active Portfolio
            {activeTab === 'active' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`pb-4 text-sm font-medium transition-all relative ${activeTab === 'closed' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            Closed History
            {activeTab === 'closed' && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full" />
            )}
          </button>
        </div>

        {/* List Content */}
        <section>
          <div className="grid gap-4">
            {viewMode === 'borrowers' ? (
              // BORROWER VIEW
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupedBorrowers.length === 0 ? (
                  <div className="col-span-full text-zinc-500 text-center py-12 border border-zinc-800 border-dashed rounded-xl">
                    No borrowers found.
                  </div>
                ) : (
                  groupedBorrowers.map((b: any) => (
                    <Link
                      key={b.id}
                      href={`/borrowers/${b.id}`}
                      className="glass-panel p-5 rounded-xl block hover:border-emerald-500/50 transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-white group-hover:text-emerald-400 transition-colors">{b.name}</h3>
                          <div className="text-xs text-zinc-500 mt-1">{b.activeCount} Active Loans</div>
                        </div>
                        <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-colors">
                          <Users className="w-4 h-4" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                        <div>
                          <span className="text-xs text-zinc-500 block mb-1">Total Principal</span>
                          <span className="text-white font-mono">{formatCurrency(b.totalPrincipal)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-zinc-500 block mb-1">Total Interest</span>
                          <span className="text-blue-400 font-mono">{formatCurrency(b.totalInterest)}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            ) : activeTab === 'active' ? (
              // ACTIVE LOANS
              loans.filter(l => l.status === 'ACTIVE').length === 0 ? (
                <div className="text-zinc-500 text-center py-12 border border-zinc-800 border-dashed rounded-xl">
                  No active loans found.
                </div>
              ) : (
                loans.filter(l => l.status === 'ACTIVE').map(loan => (
                  <Link
                    href={`/loans/${loan.id}`}
                    key={loan.id}
                    className="block group relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                    <div className="glass-panel p-5 rounded-xl hover:border-emerald-500/50 transition-colors">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-medium text-white group-hover:text-emerald-400 transition-colors z-20 relative">
                            <Link href={`/borrowers/${loan.borrower_id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                              {loan.borrower?.name || 'Unknown Borrower'}
                            </Link>
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs">
                              {(loan.interest_rate * (loan.rate_interval === 'ANNUALLY' || loan.rate_interval === 'DAILY' ? 100 : 1)).toFixed(2)}% {loan.rate_interval}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-mono font-medium text-white">
                            {formatCurrency(loan.current_principal + loan.accrued_interest)}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            Total Due
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )
            ) : (
              // CLOSED LOANS
              loans.filter(l => l.status === 'CLOSED').length === 0 ? (
                <div className="text-zinc-500 text-center py-12 border border-zinc-800 border-dashed rounded-xl">
                  No closed loans found in history.
                </div>
              ) : (
                loans.filter(l => l.status === 'CLOSED').map(loan => (
                  <div key={loan.id} className="glass-panel p-6 rounded-xl">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-lg font-medium text-white">
                          {loan.borrower?.name || 'Unknown Borrower'}
                        </h3>
                        <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                          <History className="w-3 h-3" /> Settled
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {formatCurrency(loan.principal_amount)}
                        </div>
                        <span className="text-xs text-zinc-500">Original Principal</span>
                      </div>
                    </div>

                    {/* Payment History for Closed Loan */}
                    <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800/50">
                      <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Repayment History
                      </h4>
                      <div className="space-y-3">
                        {loan.transactions?.filter(t => t.type === 'PAYMENT').length === 0 ? (
                          <p className="text-xs text-zinc-600 italic">No payments recorded.</p>
                        ) : (
                          loan.transactions.filter(t => t.type === 'PAYMENT').map(tx => (
                            <div key={tx.id} className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                              <span className="text-zinc-500">
                                {new Date(tx.created_at).toLocaleDateString(undefined, {
                                  year: 'numeric', month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                              <span className="font-mono text-emerald-400">
                                {formatCurrency(tx.amount)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )
            )}

            {/* Mobile View Toggle (Floating or bottom) can go here if needed, but header toggle works for now */}
          </div>
        </section>

      </div>
    </main>
  );
}
