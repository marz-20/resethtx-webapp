'use client'

import { useState } from 'react'
import ReservationsTable from './ReservationsTable'
import { cancelEventBooking, } from '@/app/actions/event-booking'
import { createReservation } from './actions'

interface EventBooking {
    id: string
    customer_name: string
    customer_email: string
    status: string
    created_at: string
    events: {
        title: string
        date: string
    } | null | undefined
    tables: {
        name: string
        category: string
        capacity?: number
    } | null | undefined
    // For Debugging:
    event_id?: string
    table_id?: string
}

export default function ReservationsClient({
    initialReservations,
    initialEventBookings
}: {
    initialReservations: any[]
    initialEventBookings: any[]
}) {
    const [activeTab, setActiveTab] = useState<'general' | 'events'>('general')
    const [eventBookings, setEventBookings] = useState<EventBooking[]>(initialEventBookings)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [creating, setCreating] = useState(false)
    const [createForm, setCreateForm] = useState({
        full_name: '', email: '', phone: '', guests: '2',
        date: '', time: '7:00 PM', special_requests: '', status: 'confirmed', payment_status: 'paid'
    })

    const handleCancelEventBooking = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this event booking?')) return
        setLoadingId(id)
        const result = await cancelEventBooking(id)
        if (result.success) {
            // Optimistic update or wait for revalidate. 
            // Revalidate happens on server, but client state might need manual update if not refreshing router.
            setEventBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))
        } else {
            alert(result.error)
        }
        setLoadingId(null)
    }

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'confirmed': return 'bg-green-500/20 text-green-400 border-green-500/20'
            case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/20'
            default: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
        }
    }

    // Stats Calculation
    const pendingCount = initialReservations.filter((r: any) => r.status === 'pending').length
    const confirmedCount = initialReservations.filter((r: any) => r.status === 'confirmed').length
    const eventConfirmedCount = eventBookings.filter(b => b.status === 'confirmed').length

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2">Reservations</h1>
                    <p className="text-slate-400">Manage table bookings and guest requests.</p>
                </div>

                {/* Stats + New Button */}
                <div className="flex gap-4 items-center">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-[#D4AF37] hover:bg-[#F0DEAA] text-black font-bold px-5 py-2.5 rounded-lg text-sm uppercase tracking-wider transition-all"
                    >
                        + New Reservation
                    </button>
                    {activeTab === 'general' ? (
                        <>
                            <div className="bg-[#111] border border-white/10 px-6 py-3 rounded-lg text-center">
                                <span className="block text-2xl font-bold text-white">{pendingCount}</span>
                                <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider font-bold">Pending</span>
                            </div>
                            <div className="bg-[#111] border border-white/10 px-6 py-3 rounded-lg text-center">
                                <span className="block text-2xl font-bold text-white">{confirmedCount}</span>
                                <span className="text-[10px] text-green-500 uppercase tracking-wider font-bold">Confirmed</span>
                            </div>
                        </>
                    ) : (
                        <div className="bg-[#111] border border-white/10 px-6 py-3 rounded-lg text-center">
                            <span className="block text-2xl font-bold text-white">{eventConfirmedCount}</span>
                            <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider font-bold">Sold Tables</span>
                        </div>
                    )}
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-1 mb-6 border-b border-white/10">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'general'
                        ? 'border-[#D4AF37] text-white'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                >
                    General Table Booking
                </button>
                <button
                    onClick={() => setActiveTab('events')}
                    className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'events'
                        ? 'border-[#D4AF37] text-white'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                >
                    Event Tables
                </button>
            </div>

            {/* Main Content */}
            <div className="bg-[#050505] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                {activeTab === 'general' ? (
                    <ReservationsTable initialReservations={initialReservations} />
                ) : (
                    // EVENT BOOKINGS TABLE VIEW
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-[#111] text-xs uppercase font-bold text-slate-300">
                                <tr>
                                    <th className="px-6 py-4 rounded-tl-lg">Event</th>
                                    <th className="px-6 py-4">Table</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Phone / DOB</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 rounded-tr-lg text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {eventBookings.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            No event table bookings found.
                                        </td>
                                    </tr>
                                ) : (
                                    eventBookings.map((booking: any) => (
                                        <tr key={booking.id} className="bg-[#0a0a0a] hover:bg-[#111] transition-colors group">
                                            {/* EVENT */}
                                            <td className="px-6 py-6">
                                                <div className="font-bold text-white text-base mb-1">
                                                    {booking.events?.title || <span className="text-red-500">Unknown Event</span>}
                                                </div>
                                                <div className="text-xs text-zinc-500">
                                                    {booking.events?.date ? new Date(booking.events.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'No Date'}
                                                </div>
                                            </td>

                                            {/* TABLE */}
                                            <td className="px-6 py-6">
                                                <div className="flex items-center gap-2 text-white font-bold">
                                                    <span className="w-2 h-2 rounded-full bg-[#D4AF37]"></span>
                                                    {booking.tables?.name
                                                        ? booking.tables.name
                                                        : <span className="text-red-500">Unknown Table</span>
                                                    }
                                                </div>
                                                <div className="text-xs text-slate-500 pl-4 mt-1">
                                                    {booking.tables?.category || 'Standard'}
                                                </div>
                                            </td>

                                            {/* CUSTOMER */}
                                            <td className="px-6 py-6">
                                                <div className="font-bold text-slate-200 mb-1">{booking.customer_name}</div>
                                                <a href={`mailto:${booking.customer_email}`} className="text-xs hover:text-[#D4AF37] transition-colors">
                                                    {booking.customer_email}
                                                </a>
                                            </td>

                                            {/* PHONE / DOB */}
                                            <td className="px-6 py-6">
                                                <div className="text-slate-300 font-mono text-xs mb-1">{booking.guest_phone || 'N/A'}</div>
                                                <div className="text-xs text-slate-500">DOB: {booking.guest_dob || 'N/A'}</div>
                                            </td>

                                            {/* STATUS */}
                                            <td className="px-6 py-6">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getStatusColor(booking.status)}`}>
                                                    {booking.status}
                                                </span>
                                            </td>

                                            {/* ACTIONS */}
                                            <td className="px-6 py-6 text-right">
                                                <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {loadingId === booking.id ? (
                                                        <span className="text-xs text-slate-500 animate-pulse">Processing...</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleCancelEventBooking(booking.id)}
                                                            className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black border border-red-500/50 p-2 rounded transition-colors"
                                                            title="Cancel Booking"
                                                        >
                                                            ✕ Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Create Reservation Modal ── */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
                            <h2 className="text-white font-bold text-lg">New Reservation</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white text-xl">✕</button>
                        </div>
                        <form
                            className="p-6 space-y-4"
                            onSubmit={async (e) => {
                                e.preventDefault()
                                setCreating(true)
                                const result = await createReservation({
                                    ...createForm,
                                    special_requests: [createForm.special_requests, `Payment: ${createForm.payment_status}`].filter(Boolean).join(' | ')
                                })
                                setCreating(false)
                                if (result.success) {
                                    setShowCreateModal(false)
                                    setCreateForm({ full_name: '', email: '', phone: '', guests: '2', date: '', time: '7:00 PM', special_requests: '', status: 'confirmed', payment_status: 'paid' })
                                    alert('Reservation created! Refresh the page to see it.')
                                } else {
                                    alert('Error: ' + result.message)
                                }
                            }}
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Full Name *</label>
                                    <input value={createForm.full_name} onChange={e => setCreateForm(p => ({ ...p, full_name: e.target.value }))} required className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#D4AF37]" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Phone</label>
                                    <input value={createForm.phone} onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))} className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#D4AF37]" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Email *</label>
                                <input type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} required className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#D4AF37]" />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Date *</label>
                                    <input type="date" value={createForm.date} onChange={e => setCreateForm(p => ({ ...p, date: e.target.value }))} required className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#D4AF37]" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Time *</label>
                                    <select value={createForm.time} onChange={e => setCreateForm(p => ({ ...p, time: e.target.value }))} className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#D4AF37]">
                                        {['5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'].map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Guests</label>
                                    <input type="number" min="1" max="20" value={createForm.guests} onChange={e => setCreateForm(p => ({ ...p, guests: e.target.value }))} className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#D4AF37]" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Status</label>
                                    <select value={createForm.status} onChange={e => setCreateForm(p => ({ ...p, status: e.target.value }))} className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#D4AF37]">
                                        <option value="confirmed">Confirmed</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Payment Status</label>
                                    <select value={createForm.payment_status} onChange={e => setCreateForm(p => ({ ...p, payment_status: e.target.value }))} className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#D4AF37]">
                                        <option value="paid">Paid</option>
                                        <option value="unpaid">Unpaid</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Notes</label>
                                <textarea value={createForm.special_requests} onChange={e => setCreateForm(p => ({ ...p, special_requests: e.target.value }))} rows={2} className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none focus:border-[#D4AF37]" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2.5 rounded-lg text-sm transition-all">Cancel</button>
                                <button type="submit" disabled={creating} className="flex-1 bg-[#D4AF37] hover:bg-[#F0DEAA] text-black font-bold py-2.5 rounded-lg text-sm transition-all disabled:opacity-50">
                                    {creating ? 'Saving...' : 'Create Reservation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
