'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Wallet, TrendingUp, Plus, ArrowRight, History, Calendar, Calculator, Users, Merge, Check, X, Menu, ArrowDownLeft, Pencil, SkipForward, Trash2 } from 'lucide-react';

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

interface EMI {
  id: string;
  name: string;
  lender: string;
  amount: number;
  remaining_months: number;
  next_due_date: string;
  status: 'ACTIVE' | 'CLOSED';
  tenure_months: number;
  interest_rate: number;
  start_date?: string;
  reminder_days_before?: number;
}

interface Insurance {
  id: string;
  name: string;
  provider: string;
  premium_amount: number;
  frequency: string;
  next_due_date: string;
  reminder_days_before?: number;
}

interface Reminder {
  id: string;
  title: string;
  amount: number;
  frequency: string;
  next_due_date: string;
  is_paid: boolean;
  is_variable_amount?: boolean;
  reminder_days_before?: number;
}

interface Sip {
  id: string;
  fund_name: string;
  amount: number;
  sip_date: number;
  next_due_date: string;
  folio_number?: string;
}

import AddEmiModal from '@/components/modals/AddEmiModal';
import AddInsuranceModal from '@/components/modals/AddInsuranceModal';
import AddReminderModal from '@/components/modals/AddReminderModal';
import AddSipModal from '@/components/modals/AddSipModal';
import PaymentConfirmationModal from '@/components/modals/PaymentConfirmationModal';
import MonthlyFinancialSnapshot from '@/components/MonthlyFinancialSnapshot';

export default function Dashboard() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);

  // New State for EMI Feature
  const [emis, setEmis] = useState<EMI[]>([]);
  const [insurance, setInsurance] = useState<Insurance[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [sips, setSips] = useState<Sip[]>([]);

  // Modal States
  const [showEmiModal, setShowEmiModal] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showSipModal, setShowSipModal] = useState(false);

  // Payment Confirmation State


  // Edit States
  const [editingEmi, setEditingEmi] = useState<EMI | undefined>(undefined);
  const [editingInsurance, setEditingInsurance] = useState<Insurance | undefined>(undefined);
  const [editingReminder, setEditingReminder] = useState<Reminder | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const [viewMode, setViewMode] = useState<'loans' | 'borrowers' | 'emis'>('loans');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('');

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentItem, setPaymentItem] = useState<any | null>(null);
  const [paymentCategory, setPaymentCategory] = useState<'EMI' | 'INSURANCE' | 'REMINDER'>('EMI');

  // UX State
  const [hideAmounts, setHideAmounts] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [lastActionSnapshot, setLastActionSnapshot] = useState<{ table: string, id: string, data: any } | null>(null);
  const [userName, setUserName] = useState('');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }
      // Get username from metadata
      const name = user.user_metadata?.full_name || user.user_metadata?.username || user.email?.split('@')[0] || 'User';
      setUserName(name);

      fetchLoans(user.id);
    };
    checkUser();

    // Request Notification Permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [router, supabase]);

  // Check For Notifications
  useEffect(() => {
    const checkReminders = () => {
      if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

      const allItems = [
        ...emis.map(e => ({ ...e, type: 'EMI' })),
        ...insurance.map(i => ({ ...i, type: 'INSURANCE' })),
        ...reminders.map(r => ({ ...r, type: 'REMINDER' }))
      ];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      allItems.forEach((item: any) => {
        if (item.status === 'CLOSED' || item.is_paid || !item.next_due_date) return;

        const due = new Date(item.next_due_date);
        if (isNaN(due.getTime())) return; // invalid date check

        due.setHours(0, 0, 0, 0);

        const diffTime = due.getTime() - today.getTime();
        const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const remindDays = item.reminder_days_before || 1; // Default 1 day

        if (daysUntilDue <= remindDays && daysUntilDue >= 0) {
          try {
            // Wrap in try-catch for mobile safety
            new Notification(`Payment Due Soon: ${item.name || item.title}`, {
              body: `${daysUntilDue === 0 ? 'Due Today' : `Due in ${daysUntilDue} days`}: ${formatCurrency(item.amount || item.premium_amount)}`,
              icon: '/Logo.png',
              tag: `payment-${item.id || 'unknown'}-${new Date().toISOString().split('T')[0]}`
            });
          } catch (e) {
            console.warn('Notification failed:', e);
          }
        }
      });
    };

    // Check immediately and then set interval? Or just check on load.
    // Checking on load is enough for now. The user will open the app.
    checkReminders();
  }, [emis, insurance, reminders]);

  const fetchLoans = async (userId: string) => {
    try {
      // 1. Fetch Loans with Transactions
      const { data: loansData, error } = await supabase
        .from('loans')
        .select(`
          *,
          borrower_id,
          borrower:borrowers(name),
          transactions(*)
        `)
        .order('created_at', { ascending: false });

      // 1.5 Fetch Personal Liabilities
      const { data: liabilitiesData } = await supabase
        .from('personal_borrowings')
        .select('*');

      setLiabilities(liabilitiesData || []);

      // 1.8 Fetch EMIs & Reminders
      const { data: emisData } = await supabase.from('emis').select('*');
      const { data: insData } = await supabase.from('insurance_policies').select('*');
      const { data: remData } = await supabase.from('reminders').select('*');

      setEmis(emisData || []);
      setInsurance(insData || []);
      setReminders(remData || []);

      const { data: sipsData } = await supabase.from('mutual_fund_sips').select('*');
      setSips(sipsData || []);

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
            borrower_id,
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

  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '₹0';
    if (hideAmounts) return '••••••';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const totalLiabilities = liabilities
    .filter(l => l.status === 'ACTIVE')
    .reduce((sum, l) => {
      // Calculate simple interest client side for summary
      const start = new Date(l.start_date);
      const now = new Date();
      // const splitDate = new Date().toISOString().split('T')[0]; 
      const diffTime = Math.abs(now.getTime() - start.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let dailyRate = 0;
      // Rate is stored as decimal (e.g. 0.12 for 12%), so we use it directly
      if (l.rate_interval === 'ANNUALLY') dailyRate = l.interest_rate / 365.0;
      else if (l.rate_interval === 'MONTHLY') dailyRate = l.interest_rate / 30.0;
      else dailyRate = l.interest_rate;

      const interest = l.principal_amount * dailyRate * days;
      return sum + l.principal_amount + interest;
    }, 0);

  const calculateAmortization = (emi: EMI) => {
    // Basic flat rate assumption or reducing balance? usually EMI is reducing balance.
    // However, without full details, we estimate:
    // Principal Paid So Far = (Tenure - Remaining) / Tenure * Total Principal?
    // Total Principal can be reverse calculated from EMI if we know rate.
    // Formula: P = EMI * ((1+r)^n - 1) / (r * (1+r)^n)

    const r = emi.interest_rate / 12 / 100;
    const n = emi.tenure_months;
    const emiAmount = emi.amount;

    let principal = 0;
    if (r === 0) principal = emiAmount * n;
    else principal = emiAmount * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));

    const monthsPaid = emi.tenure_months - emi.remaining_months;

    // Simulate generic amortization schedule
    let balance = principal;
    let totalInterestPaid = 0;

    for (let i = 0; i < monthsPaid; i++) {
      const interest = balance * r;
      const principalComponent = emiAmount - interest;
      balance -= principalComponent;
      totalInterestPaid += interest;
    }

    return {
      originalPrincipal: principal,
      currentPrincipal: Math.max(0, balance),
      totalInterestPaid: totalInterestPaid,
      progress: (monthsPaid / n) * 100
    };
  };

  const [simulatingEmiId, setSimulatingEmiId] = useState<string | null>(null);
  const [prepayAmount, setPrepayAmount] = useState<number>(10000);

  const handleCloseEmi = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to close this EMI: ${name}?`)) return;

    try {
      const { error } = await supabase.from('emis').update({ status: 'CLOSED' }).eq('id', id);
      if (error) throw error;

      // Optimistic update
      setEmis(prev => prev.map(e => e.id === id ? { ...e, status: 'CLOSED' } : e));

      // Notify
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    } catch (e) {
      console.error('Failed to close EMI:', e);
      alert('Failed to close EMI');
    }
  };

  const handleSimulatePrepayment = (emi: EMI) => {
    const stats = calculateAmortization(emi);
    const r = emi.interest_rate / 12 / 100;
    const currentPrincipal = stats.currentPrincipal;
    const prepayAmountNum = Number(prepayAmount);
    const newPrincipal = Math.max(0, currentPrincipal - prepayAmountNum);

    // Calculate new tenure with same EMI
    let newTenure = 0;
    const oldTenure = emi.remaining_months;

    if (r === 0) {
      newTenure = newPrincipal / emi.amount;
    } else {
      const numerator = -Math.log(1 - (r * newPrincipal) / emi.amount);
      const denominator = Math.log(1 + r);
      newTenure = numerator / denominator;
    }

    const calculatedNewTenure = Math.max(0, Math.ceil(newTenure));
    const monthsSaved = Math.max(0, oldTenure - calculatedNewTenure);
    const isPartialReduction = monthsSaved === 0 && prepayAmountNum > 0;

    return {
      newTenure: calculatedNewTenure,
      monthsSaved: monthsSaved,
      isPartialReduction
    };
  };

  // Payment Logic
  const initiatePayment = (item: any, category: 'EMI' | 'INSURANCE' | 'REMINDER') => {
    setPaymentItem(item);
    setPaymentCategory(category);
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async (details: { payment_date: string, amount: number, payment_mode: string }) => {
    if (!paymentItem) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // 1. Record History
      const { error: historyError } = await supabase.from('payment_history').insert({
        user_id: user.id,
        amount: details.amount,
        payment_date: details.payment_date,
        payment_mode: details.payment_mode,
        category: paymentCategory,
        reference_id: paymentItem.id,
        reference_id: paymentItem.id,
        title: paymentItem.name || paymentItem.title || paymentItem.fund_name || (paymentCategory === 'SIP' ? paymentItem.fund_name : 'Unknown Payment')
      });
      if (historyError) throw historyError;

      // 2. Calculate Next Due Date & Status Updates
      const currentDue = new Date(paymentItem.next_due_date);
      let nextDue = new Date(currentDue);
      let updates: any = {};
      let table = '';

      if (paymentCategory === 'EMI') {
        table = 'emis';
        // Logic: +1 Month
        nextDue.setMonth(nextDue.getMonth() + 1);
        updates.next_due_date = nextDue.toISOString().split('T')[0];

        // Decrement remaining months
        const newRemaining = Math.max(0, paymentItem.remaining_months - 1);
        updates.remaining_months = newRemaining;

        if (newRemaining === 0) {
          updates.status = 'CLOSED';
        }
      }
      else if (paymentCategory === 'INSURANCE') {
        table = 'insurance_policies';
        // Logic: +Frequency
        if (paymentItem.frequency === 'MONTHLY') nextDue.setMonth(nextDue.getMonth() + 1);
        else if (paymentItem.frequency === 'QUARTERLY') nextDue.setMonth(nextDue.getMonth() + 3);
        else if (paymentItem.frequency === 'HALF_YEARLY') nextDue.setMonth(nextDue.getMonth() + 6);
        else if (paymentItem.frequency === 'YEARLY') nextDue.setFullYear(nextDue.getFullYear() + 1);

        updates.next_due_date = nextDue.toISOString().split('T')[0];
      }
      else if (paymentCategory === 'REMINDER') {
        table = 'reminders';
        if (paymentItem.frequency === 'ONE_TIME') {
          updates.is_paid = true;
        } else {
          // Auto regenerate next date
          if (paymentItem.frequency === 'MONTHLY') nextDue.setMonth(nextDue.getMonth() + 1);
          else if (paymentItem.frequency === 'YEARLY') nextDue.setFullYear(nextDue.getFullYear() + 1);

          updates.next_due_date = nextDue.toISOString().split('T')[0];
          updates.is_paid = false; // Reset paid status for next cycle
        }
      }

      // 3. Update Item
      // Save snapshot for undo
      setLastActionSnapshot({ table, id: paymentItem.id, data: { ...paymentItem } });
      setShowUndo(true);
      setTimeout(() => setShowUndo(false), 5000);

      const { error: updateError } = await supabase
        .from(table)
        .update(updates)
        .eq('id', paymentItem.id);

      if (updateError) throw updateError;

      // 4. Refresh Data
      fetchLoans(user.id);

      // 5. Vibration
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(200); // Success haptic
      }

    } catch (e) {
      console.error("Payment Error", e);
      alert("Failed to record payment");
    }
  };

  const handleUndo = async () => {
    if (!lastActionSnapshot) return;
    try {
      const { error } = await supabase
        .from(lastActionSnapshot.table)
        .update(lastActionSnapshot.data) // Revert to old data
        .eq('id', lastActionSnapshot.id);

      if (error) throw error;

      fetchLoans((await supabase.auth.getUser()).data.user!.id);
      setShowUndo(false);
      setLastActionSnapshot(null);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Old Payment Handler (Deprecated / simplified to just call initiate)
  const handlePaymentAction = (item: any, type: string, action: string) => {
    // This was the old direct handler. We are now routing 'paid' to the new modal.
    if (action === 'paid') {
      // Map type string to category enum
      let cat: any = 'EMI';
      if (type === 'INSURANCE') cat = 'INSURANCE';
      if (type === 'REMINDER') cat = 'REMINDER';
      initiatePayment(item, cat);
    }
  };

  const handleMerge = async () => {
    if (selectedForMerge.length < 2 || !mergeName.trim()) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Create New Borrower
      const { data: newBorrower, error: createError } = await supabase
        .from('borrowers')
        .insert({ name: mergeName, user_id: user?.id })
        .select()
        .single();

      if (createError) throw createError;

      // 2. Update Loans
      // For each selected borrower, get their loans
      const loansToUpdate = loans.filter(l => selectedForMerge.includes(l.borrower_id));

      for (const loan of loansToUpdate) {
        const { error: updateError } = await supabase
          .from('loans')
          .update({
            borrower_id: newBorrower.id,
            title: loan.borrower.name // Preserve old name as title
          })
          .eq('id', loan.id);

        if (updateError) throw updateError;
      }

      // 3. Delete Old Borrowers (Optional, but cleaner)
      for (const oldId of selectedForMerge) {
        await supabase.from('borrowers').delete().eq('id', oldId);
      }

      // Reset
      setSelectedForMerge([]);
      setMergeName('');
      setShowMergeModal(false);

      // Refresh
      if (user) fetchLoans(user.id);

    } catch (e) {
      console.error(e);
      alert('Error merging borrowers');
    } finally {
      setLoading(false);
    }
  };

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
            <p className="text-zinc-400 text-sm">
              Hi <span className="text-white font-medium">{userName}</span>, here is your Portfolio Overview
            </p>
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
            <button
              onClick={() => setViewMode('emis')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${viewMode === 'emis' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <Calendar className="w-3 h-3" /> EMIs & Reminders
            </button>
            {viewMode === 'borrowers' && (
              <>
                <button
                  onClick={() => setShowMergeModal(true)}
                  className="ml-2 px-3 py-1.5 rounded-md text-xs font-medium text-emerald-500 hover:text-emerald-400 hover:bg-zinc-800 transition-all flex items-center gap-2"
                >
                  <Merge className="w-3 h-3" /> Merge
                </button>
              </>
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex gap-4">
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/auth'); }}
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              Sign Out
            </button>
            <Link
              href="/history"
              className="p-2 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800 rounded-full"
              title="Payment History"
            >
              <History className="w-5 h-5 text-emerald-500" />
            </Link>
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

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/liabilities"
              className="p-2 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800 rounded-full"
              title="My Borrowings"
            >
              <Wallet className="w-5 h-5 text-red-400" />
            </Link>
            <Link
              href="/create"
              className="flex items-center justify-center w-8 h-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg hover:shadow-emerald-900/20"
              title="New Loan"
            >
              <Plus className="w-5 h-5" />
            </Link>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className={`p-2 rounded-full transition-colors ${showMobileMenu ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="md:hidden bg-zinc-900 border border-zinc-800 rounded-xl p-2 mb-4 animate-in slide-in-from-top-2 fade-in">
            <Link
              href="/calculator"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              onClick={() => setShowMobileMenu(false)}
            >
              <Calculator className="w-5 h-5" />
              Interest Calculator
            </Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/auth'); }}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-left"
            >
              <ArrowDownLeft className="w-5 h-5 rotate-180" /> {/* Using ArrowDownLeft as signout icon proxy or similar */}
              Sign Out
            </button>
          </div>
        )}

        {/* Mobile View Toggle */}
        <div className="flex md:hidden w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('loans')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${viewMode === 'loans' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Users className="w-3 h-3" /> All
          </button>
          <button
            onClick={() => setViewMode('borrowers')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${viewMode === 'borrowers' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Users className="w-3 h-3" /> Grouped
          </button>
          <button
            onClick={() => setViewMode('emis')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${viewMode === 'emis' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Calendar className="w-3 h-3" /> EMIs
          </button>
        </div>

        {/* Metrics */}
        {(viewMode === 'loans' || viewMode === 'borrowers') && (
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
        )}

        {/* Tabs - Only show for Loans view */}
        {!['emis', 'borrowers'].includes(viewMode) && (
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
        )}

        {/* List Content */}
        <section>
          <div className="grid gap-4">
            {viewMode === 'emis' && (
              <>
                {/* Monthly Snapshot */}
                <MonthlyFinancialSnapshot emis={emis} insurance={insurance} reminders={reminders} sips={sips} />

                {/* Due Soon (Upcoming) */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-4">Due Soon</h3>
                  <div className="space-y-3 relative z-10">
                    {(() => {
                      const allItems = [
                        ...emis.filter(e => e.status === 'ACTIVE').map(e => ({ ...e, type: 'EMI', date: e.next_due_date }) as any),
                        ...insurance.map(i => ({ ...i, type: 'INSURANCE', date: i.next_due_date, amount: i.premium_amount }) as any),
                        ...reminders.filter(r => !r.is_paid).map(r => ({ ...r, type: 'REMINDER', name: r.title, date: r.next_due_date }) as any),
                        ...sips.map(s => ({ ...s, type: 'SIP', name: s.fund_name, date: s.next_due_date }) as any)
                      ];

                      const upcoming = allItems
                        .filter(item => {
                          const due = new Date(item.date);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0); // Normalize today
                          const diffTime = due.getTime() - today.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return diffDays >= -60 && diffDays <= 30; // Show overdue (up to 60 days) + next 30 days
                        })
                        .sort((a, b) => {
                          // Sort 1: Date Ascending (Overdue first)
                          const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
                          if (dateDiff !== 0) return dateDiff;
                          // Sort 2: Amount Descending (High Value Priority)
                          return b.amount - a.amount;
                        })
                        .slice(0, 5); // Show top 5

                      if (upcoming.length === 0) return <div className="text-zinc-500 text-sm italic">No upcoming payments due soon.</div>;

                      return upcoming.map((item, idx) => {
                        const due = new Date(item.date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const diffTime = due.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        let statusColor = "bg-zinc-800 text-zinc-400";
                        let statusText = "Upcoming";

                        if (diffDays < 0) {
                          statusColor = "bg-red-500/10 text-red-500 border border-red-500/20";
                          statusText = `Overdue by ${Math.abs(diffDays)}d`;
                        } else if (diffDays === 0) {
                          statusColor = "bg-orange-500/10 text-orange-500 border border-orange-500/20";
                          statusText = "Due Today";
                        } else if (diffDays <= 3) {
                          statusColor = "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20";
                          statusText = `Due in ${diffDays}d`;
                        } else {
                          statusColor = "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
                          statusText = `In ${diffDays}d`;
                        }

                        return (
                          <div key={`${item.type}-${item.id}-${idx}`} className="flex flex-col gap-3 bg-black/40 p-4 rounded-xl border border-zinc-800/50 relative overflow-hidden group">
                            {/* Status Badge */}
                            <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-bl-xl ${statusColor}`}>
                              {statusText}
                            </div>

                            <div className="flex justify-between items-start mt-2">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] shrink-0 ${item.type === 'EMI' ? 'bg-blue-500 shadow-blue-500/50' : item.type === 'INSURANCE' ? 'bg-purple-500 shadow-purple-500/50' : 'bg-orange-500 shadow-orange-500/50'}`} />
                                <div className="min-w-0">
                                  <div className="text-white font-bold text-base truncate pr-2">{item.name}</div>
                                  <div className="text-xs text-zinc-500 font-medium flex gap-2">
                                    <span>{item.type}</span>
                                    <span>•</span>
                                    <span>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right mt-1 ml-auto shrink-0">
                                <div className="text-white font-mono text-base md:text-lg font-bold tracking-tight">{formatCurrency(item.amount)}</div>
                              </div>
                            </div>

                            {/* Quick Actions Row */}
                            <div className="flex items-center gap-2 mt-1 border-t border-white/5 pt-3">
                              <button
                                onClick={() => initiatePayment(item, item.type === 'EMI' ? 'EMI' : item.type === 'INSURANCE' ? 'INSURANCE' : 'REMINDER')}
                                className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors text-xs font-bold border border-emerald-500/20"
                                title="Mark As Paid"
                              >
                                <Check className="w-3.5 h-3.5" /> Mark Paid
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* EMIs List */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Active EMIs</h3>
                    <button
                      onClick={() => setShowEmiModal(true)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-emerald-500 transition-colors"
                    >
                      + Add EMI
                    </button>
                  </div>
                  <div className="grid gap-4">
                    {emis.filter(e => e.status === 'ACTIVE').length === 0 ? (
                      <div className="text-zinc-500 text-sm italic">No active EMIs found.</div>
                    ) : emis.filter(e => e.status === 'ACTIVE').map(emi => {
                      const stats = calculateAmortization(emi);
                      const isSimulating = simulatingEmiId === emi.id;
                      const simResult = isSimulating ? handleSimulatePrepayment(emi) : null;

                      return (
                        <div key={emi.id} className="glass-panel p-5 rounded-xl block group">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-white font-medium flex items-center gap-2 text-lg">
                                {emi.name}
                                <button
                                  onClick={() => { setEditingEmi(emi); setShowEmiModal(true); }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-emerald-500 transition-all"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              </h4>
                              <div className="text-xs text-zinc-500">{emi.lender} • {emi.interest_rate}% p.a.</div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-2 mb-1">
                                <div className="text-white font-mono text-xl">{formatCurrency(emi.amount)}</div>
                                <button
                                  onClick={() => handleCloseEmi(emi.id, emi.name)}
                                  className="p-1.5 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                  title="Close Loan (Remove)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="text-xs text-zinc-500">per month</div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className="flex justify-between text-xs text-zinc-400 mb-1">
                              <span>Progress</span>
                              <span>{emi.tenure_months - emi.remaining_months} / {emi.tenure_months} months</span>
                            </div>
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${stats.progress}%` }} />
                            </div>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Principal Due</div>
                              <div className="text-sm font-mono text-white">{formatCurrency(stats.currentPrincipal)}</div>
                            </div>
                            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Interest Paid</div>
                              <div className="text-sm font-mono text-blue-400">{formatCurrency(stats.totalInterestPaid)}</div>
                            </div>
                          </div>

                          {/* Prepayment Simulator Toggle */}
                          <button
                            onClick={() => setSimulatingEmiId(isSimulating ? null : emi.id)}
                            className="w-full py-2 text-xs font-medium text-emerald-500 hover:text-emerald-400 border border-dashed border-emerald-500/30 rounded-lg hover:bg-emerald-500/5 transition-colors mb-2"
                          >
                            {isSimulating ? 'Hide Simulator' : '⚡ Simulate Prepayment'}
                          </button>

                          {/* Simulator UI */}
                          {isSimulating && (
                            <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-lg animate-in slide-in-from-top-2 fade-in">
                              <div className="flex gap-4 items-center mb-3">
                                <div className="flex-1">
                                  <label className="text-[10px] text-emerald-400 uppercase tracking-wider block mb-1">One-time Payment</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600">₹</span>
                                    <input
                                      type="number"
                                      value={prepayAmount}
                                      onChange={(e) => setPrepayAmount(Number(e.target.value))}
                                      className="w-full bg-black/40 border border-emerald-500/30 rounded-md py-1.5 pl-6 pr-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-white">{simResult?.monthsSaved}</div>
                                  <div className="text-[10px] text-zinc-400">Months Saved</div>
                                </div>
                              </div>
                              <div className="text-xs text-emerald-400 text-center">
                                {simResult?.isPartialReduction ? (
                                  <>
                                    Paying <span className="font-bold">{formatCurrency(prepayAmount)}</span> reduces your final EMI amount by <span className="font-bold">{formatCurrency(prepayAmount)}</span>.
                                    <br /><span className="opacity-70 text-[10px]">(Not enough to skip a full month yet)</span>
                                  </>
                                ) : (
                                  <>
                                    Paying <span className="font-bold">{formatCurrency(prepayAmount)}</span> reduces tenure from {emi.remaining_months} to <span className="font-bold">{simResult?.newTenure} months</span>.
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Insurance List */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Insurance Policies</h3>
                    <button
                      onClick={() => setShowInsuranceModal(true)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-emerald-500 transition-colors"
                    >
                      + Add Policy
                    </button>
                  </div>
                  <div className="grid gap-4">
                    {insurance.length === 0 ? (
                      <div className="text-zinc-500 text-sm italic">No insurance policies found.</div>
                    ) : insurance.map(pol => {
                      const due = new Date(pol.next_due_date);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const diffTime = due.getTime() - today.getTime();
                      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                      let statusText = daysLeft < 0 ? 'Expired' : 'Active';
                      let statusColor = daysLeft < 0 ? 'text-red-500' : 'text-emerald-500';

                      if (daysLeft >= 0 && daysLeft <= 7) {
                        statusText = `Renew in ${daysLeft}d`;
                        statusColor = 'text-yellow-500 font-bold animate-pulse';
                      }

                      return (
                        <div key={pol.id} className="glass-panel p-5 rounded-xl flex justify-between items-center group">
                          <div>
                            <h4 className="text-white font-medium flex items-center gap-2">
                              {pol.name}
                              <button
                                onClick={() => { setEditingInsurance(pol); setShowInsuranceModal(true); }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-emerald-500 transition-all"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </h4>
                            <div className="text-xs text-zinc-500 mb-1">{pol.provider} • {pol.frequency}</div>
                            <div className={`text-xs ${statusColor} flex items-center gap-1`}>
                              {daysLeft < 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
                              {statusText}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-mono">{formatCurrency(pol.premium_amount)}</div>
                            <div className="text-xs text-zinc-500 mb-2">Due: {new Date(pol.next_due_date).toLocaleDateString()}</div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => initiatePayment(pol, 'INSURANCE')}
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                title="Renew Now"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reminders List */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Bills & Subscriptions</h3>
                    <button
                      onClick={() => setShowReminderModal(true)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-emerald-500 transition-colors"
                    >
                      + Add Reminder
                    </button>
                  </div>
                  <div className="grid gap-4">
                    {reminders.length === 0 ? (
                      <div className="text-zinc-500 text-sm italic">No active reminders found.</div>
                    ) : reminders.map(rem => (
                      <div key={rem.id} className="glass-panel p-5 rounded-xl flex justify-between items-center group">
                        <div>
                          <h4 className="text-white font-medium flex items-center gap-2">
                            {rem.title}
                            <button
                              onClick={() => { setEditingReminder(rem); setShowReminderModal(true); }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-emerald-500 transition-all"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </h4>
                          <div className="text-xs text-zinc-500">{rem.frequency}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-mono">{formatCurrency(rem.amount)}</div>
                          <div className="text-xs text-emerald-500">
                            {rem.is_paid ? 'Paid' : `Due: ${new Date(rem.next_due_date).toLocaleDateString()}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mutual Fund SIPs List */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Mutual Fund SIPs</h3>
                    <button
                      onClick={() => setShowSipModal(true)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-emerald-500 transition-colors"
                    >
                      + Add SIP
                    </button>
                  </div>
                  <div className="grid gap-4">
                    {sips.length === 0 ? (
                      <div className="text-zinc-500 text-sm italic">No active SIPs found.</div>
                    ) : sips.map(sip => (
                      <div key={sip.id} className="glass-panel p-5 rounded-xl flex justify-between items-center group">
                        <div>
                          <h4 className="text-white font-medium flex items-center gap-2">
                            {sip.fund_name}
                          </h4>
                          <div className="text-xs text-zinc-500">SIP Date: {sip.sip_date}{['st', 'nd', 'rd'][((sip.sip_date + 90) % 100 - 10) % 10 - 1] || 'th'} of month</div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-mono">{formatCurrency(sip.amount)}</div>
                          <div className="text-xs text-emerald-500">
                            Due: {new Date(sip.next_due_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!['emis', 'borrowers'].includes(viewMode) && (
              <>
                {activeTab === 'active' ? (
                  <>
                    {/* ACTIVE LOANS */}
                    {loans.filter(l => l.status === 'ACTIVE').length === 0 ? (
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
                                  {loan.borrower_id ? (
                                    <Link
                                      href={(loan as any).title ? `/loans/${loan.id}` : `/borrowers/${loan.borrower_id}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="hover:underline"
                                    >
                                      {(loan as any).title || loan.borrower?.name || 'Unknown Borrower'}
                                    </Link>
                                  ) : (
                                    <span className="text-zinc-300">{(loan as any).title || loan.borrower?.name || 'Unknown Borrower'}</span>
                                  )}
                                </h3>
                                <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                                  <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs">
                                    {(loan.interest_rate * 100).toFixed(2)}% {loan.rate_interval}
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
                    )}
                  </>
                ) : (
                  <>
                    {/* CLOSED LOANS */}
                    {loans.filter(l => l.status === 'CLOSED').length === 0 ? (
                      <div className="text-zinc-500 text-center py-12 border border-zinc-800 border-dashed rounded-xl">
                        No closed loans found in history.
                      </div>
                    ) : (
                      loans.filter(l => l.status === 'CLOSED').map(loan => (
                        <div key={loan.id} className="glass-panel p-6 rounded-xl">
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <h3 className="text-lg font-medium text-white group-hover:text-emerald-400 transition-colors">
                                {(loan as any).title || loan.borrower?.name || 'Unknown Borrower'}
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
                    )}
                  </>
                )}
              </>
            )}

            {viewMode === 'borrowers' && (
              groupedBorrowers.map(b => (
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


          </div >
        </section >

        {/* Merge Modal */}
        {
          showMergeModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Merge className="w-5 h-5 text-emerald-500" />
                  Merge Borrowers
                </h3>

                <div className="flex-1 overflow-y-auto min-h-0 mb-4 space-y-2">
                  <p className="text-sm text-zinc-500 mb-2">Select borrowers to merge (Minimum 2):</p>
                  {groupedBorrowers.map((b: any) => (
                    <div
                      key={b.id}
                      onClick={() => {
                        if (selectedForMerge.includes(b.id)) {
                          setSelectedForMerge(prev => prev.filter(id => id !== b.id));
                        } else {
                          setSelectedForMerge(prev => [...prev, b.id]);
                        }
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${selectedForMerge.includes(b.id)
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                    >
                      <span>{b.name}</span>
                      {selectedForMerge.includes(b.id) && <Check className="w-4 h-4 text-emerald-500" />}
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">New Group Name</label>
                    <input
                      type="text"
                      value={mergeName}
                      onChange={e => setMergeName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                      placeholder="e.g. Family Group"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowMergeModal(false);
                        setSelectedForMerge([]);
                        setMergeName('');
                      }}
                      className="flex-1 py-3 rounded-xl font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMerge}
                      disabled={selectedForMerge.length < 2 || !mergeName.trim()}
                      className="flex-1 py-3 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm Merge
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Mobile View Toggle (Floating or bottom) can go here if needed, but header toggle works for now */}
        {/* EMI Modals */}
        <AddEmiModal
          isOpen={showEmiModal}
          onClose={() => { setShowEmiModal(false); setEditingEmi(undefined); }}
          onSuccess={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) fetchLoans(user.id);
          }}
          initialData={editingEmi}
        />
        <AddInsuranceModal
          isOpen={showInsuranceModal}
          onClose={() => { setShowInsuranceModal(false); setEditingInsurance(undefined); }}
          onSuccess={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) fetchLoans(user.id);
          }}
          initialData={editingInsurance}
        />
        <AddReminderModal
          isOpen={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          onSuccess={() => fetchLoans((supabase.auth.getUser() as any).data?.user?.id)}
          initialData={editingReminder}
        />
        <AddSipModal
          isOpen={showSipModal}
          onClose={() => setShowSipModal(false)}
          onSuccess={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) fetchLoans(user.id);
          }}
        />
        <PaymentConfirmationModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handleConfirmPayment}
          item={paymentItem}
          category={paymentCategory}
        />

        <footer className="text-center text-zinc-600 text-[10px] uppercase tracking-widest py-8">
          BY DHANUSH J
        </footer>
      </div >
    </main >
  );
}
