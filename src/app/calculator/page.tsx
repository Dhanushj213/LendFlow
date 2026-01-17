'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calculator as CalcIcon, RefreshCw, Calendar } from 'lucide-react';

export default function Calculator() {
    const [form, setForm] = useState({
        principal: 10000,
        rate: 12,
        interval: 'ANNUALLY',
        type: 'SIMPLE',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const [result, setResult] = useState({
        days: 0,
        interest: 0,
        total: 0
    });

    useEffect(() => {
        calculate();
    }, [form]);

    const calculate = () => {
        const start = new Date(form.startDate);
        const end = new Date(form.endDate);
        const diffTime = end.getTime() - start.getTime();
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (days < 0) {
            setResult({ days: 0, interest: 0, total: form.principal });
            return;
        }

        let dailyRate = 0;
        if (form.interval === 'ANNUALLY') dailyRate = (form.rate / 100) / 365.0;
        else if (form.interval === 'MONTHLY') dailyRate = (form.rate / 100) / 30.0;
        else dailyRate = form.rate / 100;

        let interest = 0;
        if (form.type === 'SIMPLE') {
            interest = form.principal * dailyRate * days;
        } else {
            const amount = form.principal * Math.pow((1 + dailyRate), days);
            interest = amount - form.principal;
        }

        setResult({
            days,
            interest,
            total: form.principal + interest
        });
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

    return (
        <main className="min-h-screen bg-black p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-zinc-900 rounded-full text-zinc-500 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                        <CalcIcon className="w-8 h-8 text-emerald-500" />
                        Interest Calculator
                    </h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Inputs */}
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Principal Amount</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3 text-zinc-500">₹</span>
                                <input
                                    type="number"
                                    value={form.principal}
                                    onChange={e => setForm({ ...form, principal: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-8 px-4 text-white focus:border-emerald-500 outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Interest Rate (%)</label>
                                <input
                                    type="number"
                                    value={form.rate}
                                    onChange={e => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Interval</label>
                                <select
                                    value={form.interval}
                                    onChange={e => setForm({ ...form, interval: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none transition-colors appearance-none"
                                >
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="ANNUALLY">Annually</option>
                                    <option value="DAILY">Daily</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={form.startDate}
                                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 block mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={form.endDate}
                                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Interest Type</label>
                            <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                                <button
                                    onClick={() => setForm({ ...form, type: 'SIMPLE' })}
                                    className={`py-2 rounded-lg text-sm font-medium transition-all ${form.type === 'SIMPLE' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    Simple
                                </button>
                                <button
                                    onClick={() => setForm({ ...form, type: 'COMPOUND' })}
                                    className={`py-2 rounded-lg text-sm font-medium transition-all ${form.type === 'COMPOUND' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    Compound
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Result */}
                    <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-2xl p-8 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-colors duration-500 pointer-events-none" />

                        <div className="relative z-10 space-y-6">
                            <div>
                                <span className="text-zinc-500 text-sm font-medium mb-1 block">Accrued Interest</span>
                                <div className="text-3xl md:text-4xl font-bold text-emerald-400">
                                    {formatCurrency(result.interest)}
                                </div>
                                <div className="text-zinc-500 text-xs mt-2 flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> {result.days} days duration
                                </div>
                            </div>

                            <div className="pt-6 border-t border-zinc-800">
                                <span className="text-zinc-500 text-sm font-medium mb-1 block">Total Repayment</span>
                                <div className="text-xl md:text-2xl font-bold text-white">
                                    {formatCurrency(result.total)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
