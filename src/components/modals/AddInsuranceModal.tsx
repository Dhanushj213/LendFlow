import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { X } from 'lucide-react';

interface AddInsuranceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
}

export default function AddInsuranceModal({ isOpen, onClose, onSuccess, initialData }: AddInsuranceModalProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        provider: '',
        premium_amount: '',
        frequency: 'YEARLY',
        next_due_date: new Date().toISOString().split('T')[0],
        policy_number: ''
    });

    useEffect(() => {
        if (initialData) {
            setForm({
                name: initialData.name,
                provider: initialData.provider || '',
                premium_amount: initialData.premium_amount.toString(),
                frequency: initialData.frequency,
                next_due_date: initialData.next_due_date,
                policy_number: initialData.policy_number || ''
            });
        } else {
            setForm({
                name: '',
                provider: '',
                premium_amount: '',
                frequency: 'YEARLY',
                next_due_date: new Date().toISOString().split('T')[0],
                policy_number: ''
            });
        }
    }, [initialData, isOpen]);

    const supabase = createClient();

    const handleSubmit = async () => {
        if (!form.name || !form.premium_amount || !form.next_due_date) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            const payload = {
                user_id: user.id,
                name: form.name,
                provider: form.provider,
                premium_amount: parseFloat(form.premium_amount),
                frequency: form.frequency,
                next_due_date: form.next_due_date,
                policy_number: form.policy_number
            };

            let error;
            if (initialData) {
                const { error: updateError } = await supabase
                    .from('insurance_policies')
                    .update(payload)
                    .eq('id', initialData.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('insurance_policies')
                    .insert(payload);
                error = insertError;
            }

            if (error) throw error;
            onSuccess();
            onClose();
            setForm({
                name: '',
                provider: '',
                premium_amount: '',
                frequency: 'YEARLY',
                next_due_date: new Date().toISOString().split('T')[0],
                policy_number: ''
            });
        } catch (e) {
            console.error(e);
            alert('Error adding Policy');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">{initialData ? 'Edit Policy' : 'Add Insurance Policy'}</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Policy Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            placeholder="e.g. Family Health Cover"
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-zinc-400 block mb-1">Insurance Provider</label>
                        <input
                            type="text"
                            placeholder="e.g. LIC / Star Health"
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                            value={form.provider}
                            onChange={e => setForm({ ...form, provider: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Premium Amount <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                placeholder="₹"
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                value={form.premium_amount}
                                onChange={e => setForm({ ...form, premium_amount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Frequency</label>
                            <select
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                value={form.frequency}
                                onChange={e => setForm({ ...form, frequency: e.target.value })}
                            >
                                <option value="MONTHLY">Monthly</option>
                                <option value="QUARTERLY">Quarterly</option>
                                <option value="HALF_YEARLY">Half Yearly</option>
                                <option value="YEARLY">Yearly</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Next Due Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                value={form.next_due_date}
                                onChange={e => setForm({ ...form, next_due_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Policy Number (Optional)</label>
                            <input
                                type="text"
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none"
                                value={form.policy_number}
                                onChange={e => setForm({ ...form, policy_number: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                    {loading ? 'Saving...' : (initialData ? 'Update Policy' : 'Add Policy')}
                </button>
            </div>
        </div>
    );
}
