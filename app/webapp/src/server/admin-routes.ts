import { Hono } from 'hono'
import {
  createDocument,
  deleteDocument,
  generateTrackingId,
  listCollection,
  type AdminBindings,
  updateDocument,
  verifyAdminRequest
} from './firebase-admin'

const adminApi = new Hono<{ Bindings: AdminBindings }>()

function nowIso(): string {
  return new Date().toISOString()
}

function parseJsonBody<T>(value: T): T {
  return value
}

function summarizeStats(data: {
  shipments: Record<string, unknown>[]
  quotes: Record<string, unknown>[]
  contacts: Record<string, unknown>[]
  chats: Record<string, unknown>[]
}) {
  return {
    shipments: data.shipments.length,
    quotes: data.quotes.length,
    contacts: data.contacts.length,
    unreadContacts: data.contacts.filter((item) => item.read !== true).length,
    activeChats: data.chats.filter((item) => String(item.status || '').toLowerCase() === 'active').length
  }
}

function sanitizeShipmentPayload(body: Record<string, unknown>) {
  return {
    sender: String(body.sender || '').trim(),
    receiver: String(body.receiver || '').trim(),
    origin: String(body.origin || '').trim(),
    destination: String(body.destination || '').trim(),
    mode: String(body.mode || 'Air Freight').trim(),
    status: String(body.status || 'Processing').trim(),
    weight: String(body.weight || '').trim(),
    eta: String(body.eta || '').trim(),
    timeline: Array.isArray(body.timeline) ? body.timeline : []
  }
}

adminApi.get('/admin/session', async (c) => {
  const admin = await verifyAdminRequest(c)
  return c.json({
    ok: true,
    user: {
      uid: admin.uid,
      email: admin.email
    },
    auth: {
      source: admin.accessSource
    }
  })
})

adminApi.get('/admin/dashboard', async (c) => {
  const admin = await verifyAdminRequest(c)

  const [shipments, quotes, contacts, chats] = await Promise.all([
    listCollection(c.env, 'shipments', { limit: 100, orderBy: 'createdAt', direction: 'DESCENDING' }).catch(() => []),
    listCollection(c.env, 'quotes', { limit: 100, orderBy: 'createdAt', direction: 'DESCENDING' }).catch(() => []),
    listCollection(c.env, 'contacts', { limit: 100, orderBy: 'createdAt', direction: 'DESCENDING' }).catch(() => []),
    listCollection(c.env, 'live_chats', { limit: 50, orderBy: 'lastAt', direction: 'DESCENDING' }).catch(() => [])
  ])

  const data = { shipments, quotes, contacts, chats }

  return c.json({
    ok: true,
    user: {
      uid: admin.uid,
      email: admin.email
    },
    auth: {
      source: admin.accessSource
    },
    stats: summarizeStats(data),
    data
  })
})

adminApi.post('/admin/shipments', async (c) => {
  await verifyAdminRequest(c)
  const body = parseJsonBody(await c.req.json<Record<string, unknown>>())
  const shipment = sanitizeShipmentPayload(body)

  if (!shipment.sender || !shipment.receiver || !shipment.origin || !shipment.destination) {
    return c.json({ ok: false, error: 'Sender, receiver, origin, and destination are required.' }, 400)
  }

  const createdAt = nowIso()
  const created = await createDocument(c.env, 'shipments', {
    ...shipment,
    trackingId: generateTrackingId(),
    createdAt,
    updatedAt: createdAt
  })

  return c.json({ ok: true, item: created }, 201)
})

adminApi.patch('/admin/shipments/:id', async (c) => {
  await verifyAdminRequest(c)
  const body = parseJsonBody(await c.req.json<Record<string, unknown>>())
  const updated = await updateDocument(c.env, `shipments/${c.req.param('id')}`, {
    ...body,
    updatedAt: nowIso()
  })
  return c.json({ ok: true, item: updated })
})

adminApi.delete('/admin/shipments/:id', async (c) => {
  await verifyAdminRequest(c)
  await deleteDocument(c.env, `shipments/${c.req.param('id')}`)
  return c.json({ ok: true })
})

adminApi.patch('/admin/quotes/:id/status', async (c) => {
  await verifyAdminRequest(c)
  const body = parseJsonBody(await c.req.json<{ status?: string }>())
  const status = String(body.status || '').trim()
  if (!status) {
    return c.json({ ok: false, error: 'Status is required.' }, 400)
  }

  const updated = await updateDocument(c.env, `quotes/${c.req.param('id')}`, {
    status,
    updatedAt: nowIso()
  })

  return c.json({ ok: true, item: updated })
})

adminApi.delete('/admin/quotes/:id', async (c) => {
  await verifyAdminRequest(c)
  await deleteDocument(c.env, `quotes/${c.req.param('id')}`)
  return c.json({ ok: true })
})

adminApi.patch('/admin/contacts/:id/status', async (c) => {
  await verifyAdminRequest(c)
  const body = parseJsonBody(await c.req.json<{ read?: boolean }>())
  const updated = await updateDocument(c.env, `contacts/${c.req.param('id')}`, {
    read: Boolean(body.read),
    updatedAt: nowIso()
  })

  return c.json({ ok: true, item: updated })
})

adminApi.delete('/admin/contacts/:id', async (c) => {
  await verifyAdminRequest(c)
  await deleteDocument(c.env, `contacts/${c.req.param('id')}`)
  return c.json({ ok: true })
})

export { adminApi }
