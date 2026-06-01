'use server'

import { createClient } from '@/utils/supabase/server'

export async function getGlobalTransactions() {
    const supabase = await createClient()

    // Single source of truth: ticket_purchases captures ALL payments
    // (both standard tickets and table reservations)
    const { data: tickets, error: ticketError } = await supabase
        .from('ticket_purchases')
        .select(`
      id,
      created_at,
      user_name,
      total_price,
      quantity,
      status,
      ticket_type,
      events (title, date)
    `)
        .order('created_at', { ascending: false })

    if (ticketError) {
        console.error('Error fetching tickets:', ticketError)
        return []
    }

    const allTransactions = tickets.map(t => {
        const isTable = t.ticket_type === 'table_reservation' || t.ticket_type === 'table'
        return {
            id: t.id,
            type: isTable ? 'Table Reservation' : 'Ticket',
            customer_name: t.user_name,
            // @ts-ignore
            event_name: t.events?.title || 'Unknown Event',
            amount: t.total_price || 0,
            date: t.created_at,
            // @ts-ignore
            event_date: t.events?.date || null,
            details: isTable ? 'Table Reservation' : `${t.quantity}x Ticket(s)`,
            status: t.status
        }
    })

    return allTransactions
}

export async function getEventSalesStats() {
    const supabase = await createClient()

    // Get all events
    const { data: events, error: eventError } = await supabase
        .from('events')
        .select('id, title, date, image_url')
        .order('date', { ascending: false })

    if (eventError) return []

    // Single source of truth: ticket_purchases.total_price captures the actual
    // amount paid. No need to separately sum event_bookings → tables.price,
    // which would double-count revenue for table reservations.
    const eventsWithStats = await Promise.all(events.map(async (event) => {
        const { data: tickets } = await supabase
            .from('ticket_purchases')
            .select('quantity, total_price')
            .eq('event_id', event.id)
            .in('status', ['paid', 'free'])

        const ticketCount = tickets?.reduce((sum, t) => sum + (t.quantity || 1), 0) || 0
        const totalRevenue = tickets?.reduce((sum, t) => sum + (t.total_price || 0), 0) || 0

        return {
            ...event,
            ticketsSold: ticketCount,
            totalRevenue
        }
    }))

    return eventsWithStats
}

export async function getEventGuestList(eventId: string) {
    const supabase = await createClient()

    const { data: tickets } = await supabase
        .from('ticket_purchases')
        .select('user_name, user_email, user_phone, quantity, status')
        .eq('event_id', eventId)
        .neq('status', 'cancelled')

    const { data: bookings } = await supabase
        .from('event_bookings')
        .select('customer_name, customer_email, tables(name, category)')
        .eq('event_id', eventId)
        .eq('status', 'confirmed')

    const guests = [
        ...(tickets || []).map(t => ({
            name: t.user_name,
            email: t.user_email,
            phone: t.user_phone || '-',
            type: `Ticket (${t.quantity})`,
            status: t.status
        })),
        ...(bookings || []).map(b => ({
            name: b.customer_name,
            email: b.customer_email,
            phone: '-',
            // @ts-ignore
            type: `Table: ${b.tables?.name} (${b.tables?.category})`,
            status: 'confirmed'
        }))
    ]

    return guests
}
