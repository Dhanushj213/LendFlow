import { useState } from 'react';
import { X, TrendingUp, Calendar, DollarSign, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface AddSipModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddSipModal({ isOpen, onClose, onSuccess }: AddSipModalProps) {
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        fund_name: '',
        amount: '',
        sip_date: '',
        folio_number: ''
    });

    const handleSubmit = async () => {
        if (!form.fund_name || !form.amount || !form.sip_date) {
            alert('Please fill required fields');
            return;
        }

        const dateNum = parseInt(form.sip_date);
        if (dateNum < 1 || dateNum > 31) {
            alert('Invalid Date');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');

            // Calculate next due date
            const today = new Date();
            let nextDate = new Date();
            nextDate.setDate(dateNum);

            // If the date for this month has passed, set for next month
            if (today.getDate() > dateNum) {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }

            const { error } = await supabase.from('mutual_fund_sips').insert({
                user_id: user.id,
                fund_name: form.fund_name,
                amount: parseFloat(form.amount),
                sip_date: dateNum,
                folio_number: form.folio_number || null,
                next_due_date: nextDate.toISOString().split('T')[0]
            });

            if (error) throw error;
            onSuccess();
            onClose();
            setForm({ fund_name: '', amount: '', sip_date: '', folio_number: '' });
        } catch (e) {
            console.error(e);
            alert('Failed to add SIP');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
            <div className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 animate-in slide-in-from-bottom-10 fade-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-white">Add Mutual Fund SIP</h3>
                        <p className="text-xs text-zinc-400">Track your systematic investments</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Fund Name</label>
                        <div className="relative">
                            <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="e.g. SBI Bluechip Fund"
                                className="w-full bg-black/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                value={form.fund_name}
                                onChange={e => setForm({ ...form, fund_name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Monthly Amount</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="number"
                                    placeholder="5000"
                                    className="w-full bg-black/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                    value={form.amount}
                                    onChange={e => setForm({ ...form, amount: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">SIP Date (Day)</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="number"
                                    placeholder="e.g. 5"
                                    min="1"
                                    max="31"
                                    className="w-full bg-black/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                    value={form.sip_date}
                                    onChange={e => setForm({ ...form, sip_date: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Folio Number (Optional)</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Folio No."
                                className="w-full bg-black/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                value={form.folio_number}
                                onChange={e => setForm({ ...form, folio_number: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl mt-4 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {loading ? 'Adding...' : 'Add SIP'}
                    </button>
                </div>
            </div>
        </div>
    );
}
