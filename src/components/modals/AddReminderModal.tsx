import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { X } from 'lucide-react';

interface AddReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddReminderModal({ isOpen, onClose, onSuccess }: AddReminderModalProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        title: '',
        amount: '',
        frequency: 'MONTHLY',
        next_due_date: new Date().toISOString().split('T')[0]
    });

    const supabase = createClient();

    const handleSubmit = async () => {
        if (!form.title || !form.amount || !form.next_due_date) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            const { error } = await supabase.from('reminders').insert({
                user_id: user.id,
                title: form.title,
                amount: parseFloat(form.amount),
                frequency: form.frequency,
                next_due_date: form.next_due_date,
                is_paid: false
            });

            if (error) throw error;
            onSuccess();
            onClose();
            setForm({
                title: '',
                amount: '',
                frequency: 'MONTHLY',
                next_due_date: new Date().toISOString().split('T')[0]
            });
        } catch (e) {
            console.error(e);
            alert('Error adding Reminder');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Add Reminder</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Title <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="e.g. Netflix Subscription"
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Amount <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                placeholder="₹"
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                value={form.amount}
                                onChange={e => setForm({ ...form, amount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Frequency</label>
                            <select
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                value={form.frequency}
                                onChange={e => setForm({ ...form, frequency: e.target.value })}
                            >
                                <option value="ONE_TIME">One Time</option>
                                <option value="MONTHLY">Monthly</option>
                                <option value="YEARLY">Yearly</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Due Date <span className="text-red-500">*</span></label>
                        <input
                            type="date"
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                            value={form.next_due_date}
                            onChange={e => setForm({ ...form, next_due_date: e.target.value })}
                        />
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                    {loading ? 'Adding...' : 'Add Reminder'}
                </button>
            </div>
        </div>
    );
}
