import { ArrowUpRight, AlertTriangle, Calendar, Wallet } from 'lucide-react';

interface MonthlyFinancialSnapshotProps {
    emis: any[];
    insurance: any[];
    reminders: any[];
}

export default function MonthlyFinancialSnapshot({ emis, insurance, reminders }: MonthlyFinancialSnapshotProps) {
    // 1. Calculate Totals
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const isDueInMonth = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    };

    const isOverdue = (dateStr: string) => {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return d < t; // Strictly less than today (not including today)
    };

    let totalDueMonth = 0;
    let totalOverdue = 0;
    let largestPayment = { name: '', amount: 0 };

    // Remaining yearly commitment (rough estimate)
    // EMI * remaining months (for year)
    // Insurance premiums left in year
    // Reminders left in year
    // This is complex, user asked for "Remaining yearly commitment", maybe just total of all pending dues for this year?
    // Let's stick to "Pending for this year" to keep it simple and accurate.
    let remainingYearlyCommitment = 0;

    const processItem = (item: any, amount: number, dateStr: string, name: string) => {
        const d = new Date(dateStr);

        // Overdue check
        if (isOverdue(dateStr)) {
            totalOverdue += amount;
        }

        // Current Month check
        if (isDueInMonth(dateStr)) {
            totalDueMonth += amount;
        }

        // Largest Payment Logic (of upcoming)
        if (amount > largestPayment.amount) {
            largestPayment = { name, amount };
        }

        // Yearly
        if (d.getFullYear() === currentYear && d >= today) {
            remainingYearlyCommitment += amount;
        }
    };

    emis.filter(e => e.status === 'ACTIVE').forEach(e => processItem(e, e.amount, e.next_due_date, e.name));
    insurance.forEach(i => processItem(i, i.premium_amount, i.next_due_date, i.name));
    reminders.filter(r => !r.is_paid).forEach(r => processItem(r, r.amount, r.next_due_date, r.title));

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
                    <Calendar className="w-4 h-4 text-zinc-500" /> Due This Month
                </div>
                <div className="text-2xl font-bold text-white">{formatCurrency(totalDueMonth)}</div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                {totalOverdue > 0 && <div className="absolute inset-0 bg-red-500/5 animate-pulse" />}
                <div className="flex items-center gap-2 text-red-400 text-xs font-medium uppercase tracking-wider mb-2 z-10">
                    <AlertTriangle className="w-4 h-4" /> Overdue
                </div>
                <div className="text-2xl font-bold text-red-500 z-10">{formatCurrency(totalOverdue)}</div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
                    <ArrowUpRight className="w-4 h-4 text-zinc-500" /> Largest Payment
                </div>
                <div>
                    <div className="text-xl font-bold text-white">{formatCurrency(largestPayment.amount)}</div>
                    <div className="text-xs text-zinc-500 truncate mt-1">{largestPayment.name || '-'}</div>
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col justify-between">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium uppercase tracking-wider mb-2">
                    <Wallet className="w-4 h-4 text-zinc-500" /> Year Remaining
                </div>
                <div className="text-2xl font-bold text-emerald-500">{formatCurrency(remainingYearlyCommitment)}</div>
            </div>
        </div>
    );
}
