'use server'

import { createClient } from '@/utils/supabase/server'

interface Customer {
    id: string
    name: string
    email: string
    phone: string
    totalSpend: number
    visitCount: number
    lastSeen: string
    dob?: string
}

export async function getAggregatedCustomers(): Promise<Customer[]> {
    const supabase = await createClient()

    // Single source of truth: ticket_purchases captures ALL payments
    // (both standard tickets and table reservations).
    // No need to also query event_bookings, which would double-count
    // visits and spend for table reservation customers.
    const { data: tickets } = await supabase
        .from('ticket_purchases')
        .select('user_name, user_email, user_phone, guest_dob, total_price, created_at, events(date)')

    const customerMap = new Map<string, Customer>()

    // Process Tickets (includes table reservations)
    tickets?.forEach(t => {
        const email = t.user_email.toLowerCase().trim()
        const existing = customerMap.get(email)

        const spend = t.total_price || 0
        // @ts-ignore
        const date = t.events?.date || t.created_at

        if (existing) {
            existing.totalSpend += spend
            existing.visitCount += 1
            if (new Date(date) > new Date(existing.lastSeen)) {
                existing.lastSeen = date
            }
            // Update missing phone/name/dob if available
            if (!existing.phone && t.user_phone) existing.phone = t.user_phone
            if (!existing.dob && t.guest_dob) existing.dob = t.guest_dob
        } else {
            customerMap.set(email, {
                id: email, // Use email as ID for aggregation
                name: t.user_name,
                email: email,
                phone: t.user_phone || '-',
                totalSpend: spend,
                visitCount: 1,
                lastSeen: date,
                dob: t.guest_dob
            })
        }
    })

    return Array.from(customerMap.values()).sort((a, b) => b.totalSpend - a.totalSpend)
}
