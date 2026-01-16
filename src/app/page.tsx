'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Wallet, TrendingUp, Plus, ArrowRight, History, Calendar } from 'lucide-react';

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
}

export default function Dashboard() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
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
                src="/LendFlow.png"
                alt="LendFlow"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
            <p className="text-zinc-400 text-sm">Portfolio Overview</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/auth'); }}
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              Sign Out
            </button>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            {activeTab === 'active' ? (
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
                          <h3 className="text-lg font-medium text-white group-hover:text-emerald-400 transition-colors">
                            {loan.borrower?.name || 'Unknown Borrower'}
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
          </div>
        </section>

      </div>
    </main>
  );
}
