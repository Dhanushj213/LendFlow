import { useState } from 'react';
import { X, Calendar, DollarSign, Wallet, CreditCard, Banknote, RefreshCcw, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface PaymentConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (details: any) => Promise<void>;
    item: any; // The item being paid
    category: 'EMI' | 'INSURANCE' | 'REMINDER';
}

export default function PaymentConfirmationModal({ isOpen, onClose, onConfirm, item, category }: PaymentConfirmationModalProps) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState(item?.amount || item?.premium_amount || 0);
    const [mode, setMode] = useState('UPI');
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        setLoading(true);
        await onConfirm({
            payment_date: date,
            amount: parseFloat(amount.toString()),
            payment_mode: mode
        });
        setLoading(false);
        onClose();
    };

    if (!isOpen || !item) return null;

    const modes = [
        { id: 'UPI', label: 'UPI', icon: Wallet },
        { id: 'CASH', label: 'Cash', icon: Banknote },
        { id: 'BANK_TRANSFER', label: 'Bank', icon: RefreshCcw }, // Using RefreshCcw as placeholder for Transfer
        { id: 'AUTO_DEBIT', label: 'Auto', icon: CreditCard },
    ];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 animate-in slide-in-from-bottom-10 fade-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white">Confirm Payment</h3>
                        <p className="text-xs text-zinc-400">Record this transaction</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Amount & Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
                            <label className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">Amount Paid</label>
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-500 font-bold">₹</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="bg-transparent text-xl font-mono text-white w-full focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
                            <label className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">Paid On</label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="bg-transparent text-sm text-white w-full focus:outline-none h-7"
                            />
                        </div>
                    </div>

                    {/* Payment Mode Selection */}
                    <div>
                        <label className="text-xs text-zinc-400 block mb-3">Payment Mode</label>
                        <div className="grid grid-cols-4 gap-2">
                            {modes.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setMode(m.id)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${mode === m.id
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                            : 'bg-zinc-800/30 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                                        }`}
                                >
                                    <m.icon className="w-5 h-5 mb-1" />
                                    <span className="text-[10px] font-medium">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="text-center p-4 bg-emerald-900/10 rounded-xl border border-emerald-500/10">
                        <div className="text-xs text-emerald-500/70 mb-1">You are marking</div>
                        <div className="font-medium text-emerald-100">{item.name || item.title}</div>
                        <div className="text-xs text-emerald-500/70 mt-1">as paid.</div>
                    </div>

                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                        {loading ? (
                            <span className="opacity-70">Processing...</span>
                        ) : (
                            <>
                                <Check className="w-5 h-5" /> Confirm Payment
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
