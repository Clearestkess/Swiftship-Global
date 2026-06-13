import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-pages'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { adminApi } from './server/admin-routes'
import type { AdminBindings } from './server/firebase-admin'

const app = new Hono<{ Bindings: AdminBindings }>()

app.use(logger())
app.use('*', secureHeaders())

app.route('/api', adminApi)
app.use('*', serveStatic())

app.notFound((c) => c.text('Not Found', 404))

export default app
