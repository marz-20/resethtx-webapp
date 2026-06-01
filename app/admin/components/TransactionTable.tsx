'use client'

import { useState } from 'react'

interface Transaction {
    id: string
    type: string
    customer_name: string
    event_name: string
    amount: number
    date: string
    event_date: string | null
    details: string
    status: string
}

export default function TransactionTable({ transactions }: { transactions: Transaction[] }) {
    const [search, setSearch] = useState('')
    const [filterEvent, setFilterEvent] = useState('')

    // Get unique event names for filter
    const eventNames = Array.from(new Set(transactions.map(t => t.event_name)))

    const filtered = transactions.filter(t => {
        const matchesSearch = t.customer_name.toLowerCase().includes(search.toLowerCase())
        const matchesEvent = filterEvent ? t.event_name === filterEvent : true
        return matchesSearch && matchesEvent
    })

    return (
        <div className="bg-[#111] rounded-xl border border-white/10 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-white/10 flex flex-col md:flex-row gap-4 items-center justify-between">
                <input
                    type="text"
                    placeholder="Search Customer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[#D4AF37] w-full md:w-64 text-sm"
                />

                <select
                    value={filterEvent}
                    onChange={(e) => setFilterEvent(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[#D4AF37] w-full md:w-64 text-sm"
                >
                    <option value="">All Events</option>
                    {eventNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-black/50 text-xs uppercase font-bold text-slate-300">
                        <tr>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Event</th>
                            <th className="px-6 py-4">Details</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                            <th className="px-6 py-4 text-right">Event Date</th>
                            <th className="px-6 py-4 text-right">Purchased</th>
                            <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filtered.length > 0 ? (
                            filtered.map((t) => (
                                <tr key={t.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-bold text-white">{t.customer_name}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${t.type.includes('Table')
                                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            }`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-white">{t.event_name}</td>
                                    <td className="px-6 py-4">{t.details}</td>
                                    <td className="px-6 py-4 text-right font-bold text-[#D4AF37]">
                                        ${t.amount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-xs font-medium text-white">
                                        {t.event_date ? new Date(t.event_date).toLocaleDateString('en-US') : <span className="text-slate-500">—</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right text-xs text-slate-500">
                                        {new Date(t.date).toLocaleDateString('en-US')}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${t.status === 'paid' || t.status === 'confirmed' ? 'text-green-500 bg-green-500/10' : 'text-slate-500 bg-slate-500/10'
                                            }`}>
                                            {t.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-slate-500 italic">No transactions found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col divide-y divide-white/5">
                {filtered.length > 0 ? (
                    filtered.map((t) => (
                        <div key={t.id} className="p-4 space-y-3 bg-[#111]">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-white font-bold">{t.customer_name}</div>
                                    <div className="text-xs text-slate-400">{t.event_name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[#D4AF37] font-bold">${t.amount.toLocaleString()}</div>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded inline-block mt-1 ${t.status === 'paid' || t.status === 'confirmed' ? 'text-green-500 bg-green-500/10' : 'text-slate-500 bg-slate-500/10'
                                        }`}>
                                        {t.status}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 text-xs">
                                <span className={`px-2 py-1 rounded border ${t.type.includes('Table')
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                    {t.type}
                                </span>
                                <span className="text-slate-500 py-1">{t.details}</span>
                            </div>

                            <div className="text-xs text-slate-600 pt-2 border-t border-white/5 flex justify-between">
                                <span>Event: {t.event_date ? new Date(t.event_date).toLocaleDateString('en-US') : '—'}</span>
                                <span>Purchased: {new Date(t.date).toLocaleDateString('en-US')}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center text-slate-500 italic">No transactions found.</div>
                )}
            </div>
        </div>
    )
}
