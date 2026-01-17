import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { X, Calendar, DollarSign, Calculator } from 'lucide-react';

interface AddEmiModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
}

export default function AddEmiModal({ isOpen, onClose, onSuccess, initialData }: AddEmiModalProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        lender: '',
        amount: '',
        interest_rate: '',
        tenure_months: '',
        start_date: new Date().toISOString().split('T')[0],
        manual_emi: '',
        reminder_days_before: '1'
    });

    // Populate form on edit
    useEffect(() => {
        if (initialData) {
            setForm({
                name: initialData.name,
                lender: initialData.lender,
                amount: initialData.amount.toString(),
                interest_rate: initialData.interest_rate?.toString() || '',
                tenure_months: initialData.tenure_months?.toString() || '',
                start_date: initialData.start_date,
                manual_emi: '',
                reminder_days_before: initialData.reminder_days_before?.toString() || '1'
            });
        } else {
            // Reset on Open New
            setForm({
                name: '',
                lender: '',
                amount: '',
                interest_rate: '',
                tenure_months: '',
                start_date: new Date().toISOString().split('T')[0],
                manual_emi: '',
                reminder_days_before: '1'
            });
        }
    }, [initialData, isOpen]);

    const [calculatedEmi, setCalculatedEmi] = useState<number | null>(null);

    const supabase = createClient();

    // Auto-calculate EMI whenever relevant fields change
    useEffect(() => {
        const P = parseFloat(form.amount);
        const R = parseFloat(form.interest_rate) / 12 / 100; // Monthly Rate
        const N = parseFloat(form.tenure_months);

        if (P && R && N) {
            // EMI = [P x R x (1+R)^N]/[(1+R)^N-1]
            const emi = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
            setCalculatedEmi(Math.round(emi));
        } else {
            setCalculatedEmi(null);
        }
    }, [form.amount, form.interest_rate, form.tenure_months]);

    const handleSubmit = async () => {
        if (!form.name || !form.lender || !form.amount || !form.start_date) return;

        setLoading(true);
        try {
            const emiAmount = form.manual_emi ? parseFloat(form.manual_emi) : calculatedEmi;
            if (!emiAmount) throw new Error("EMI Amount is required");

            const startDate = new Date(form.start_date);
            const nextDueDate = new Date(startDate);
            // Simple next due date logic: same day of next month
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            const payload = {
                user_id: user.id,
                name: form.name,
                lender: form.lender,
                amount: emiAmount,
                interest_rate: parseFloat(form.interest_rate) || 0,
                tenure_months: parseInt(form.tenure_months) || 0,
                remaining_months: parseInt(form.tenure_months) || 0, // Initial assumption
                start_date: form.start_date,
                next_due_date: nextDueDate.toISOString().split('T')[0],
                status: 'ACTIVE',
                reminder_days_before: parseInt(form.reminder_days_before) || 1
            };

            let error;

            if (initialData) {
                // Update
                const { error: updateError } = await supabase
                    .from('emis')
                    .update({
                        ...payload,
                        // Update specific fields on edit
                        name: form.name,
                        lender: form.lender,
                        amount: emiAmount,
                        interest_rate: parseFloat(form.interest_rate) || 0,
                        tenure_months: parseInt(form.tenure_months) || 0,
                        reminder_days_before: parseInt(form.reminder_days_before) || 1
                    })
                    .eq('id', initialData.id);
                error = updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase.from('emis').insert(payload);
                error = insertError;
            }

            if (error) throw error;
            onSuccess();
            onClose();
            // Reset Layout
            setForm({
                name: '',
                lender: '',
                amount: '',
                interest_rate: '',
                tenure_months: '',
                start_date: new Date().toISOString().split('T')[0],
                manual_emi: '',
                reminder_days_before: '1'
            });
        } catch (e) {
            console.error(e);
            alert('Error adding EMI');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">{initialData ? 'Edit EMI' : 'Add New EMI'}</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Loan Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="e.g. Home Loan"
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Lender <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="e.g. HDFC Bank"
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                            value={form.lender}
                            onChange={e => setForm({ ...form, lender: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Loan Amount <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                placeholder="₹"
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                value={form.amount}
                                onChange={e => setForm({ ...form, amount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Start Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                value={form.start_date}
                                onChange={e => setForm({ ...form, start_date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Interest Rate (%)</label>
                            <input
                                type="number"
                                placeholder="8.5"
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                value={form.interest_rate}
                                onChange={e => setForm({ ...form, interest_rate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Tenure (Months)</label>
                            <input
                                type="number"
                                placeholder="120"
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                value={form.tenure_months}
                                onChange={e => setForm({ ...form, tenure_months: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Remind me before (Days)</label>
                        <input
                            type="number"
                            placeholder="1"
                            min="0"
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                            value={form.reminder_days_before}
                            onChange={e => setForm({ ...form, reminder_days_before: e.target.value })}
                        />
                    </div>

                    {/* Calculated EMI Display */}
                    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-zinc-400">Monthly EMI</span>
                            {calculatedEmi && (
                                <span className="text-xs text-emerald-500 font-medium px-2 py-0.5 bg-emerald-500/10 rounded">
                                    Auto-Calculated
                                </span>
                            )}
                        </div>
                        {calculatedEmi ? (
                            <div className="text-2xl font-bold text-white font-mono">
                                ₹{calculatedEmi.toLocaleString()}
                            </div>
                        ) : (
                            <input
                                type="number"
                                placeholder="Enter Manual EMI Amount"
                                className="w-full bg-transparent border-b border-zinc-700 p-1 text-xl text-white focus:border-emerald-500 outline-none font-mono"
                                value={form.manual_emi}
                                onChange={e => setForm({ ...form, manual_emi: e.target.value })}
                            />
                        )}
                        <p className="text-[10px] text-zinc-500 mt-2">
                            {calculatedEmi ? "This amount is calculated based on Principal, Rate & Tenure." : "Enter manually if you don't know the exact rate."}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                    {loading ? 'Saving...' : (initialData ? 'Update EMI' : 'Add EMI')}
                </button>
            </div>
        </div>
    );
}
