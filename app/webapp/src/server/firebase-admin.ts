import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from 'jose'

export type AdminBindings = {
  FIREBASE_SERVICE_ACCOUNT_JSON?: string
  ADMIN_EMAILS?: string
}

type ServiceAccount = {
  project_id: string
  private_key: string
  client_email: string
  token_uri: string
}

type TokenPayload = {
  uid: string
  email: string | null
  claims: Record<string, unknown>
}

export type AdminIdentity = TokenPayload & {
  accessSource: 'custom-claim' | 'admin-users' | 'env-allowlist'
}

type CachedAccessToken = {
  accessToken: string
  expiresAt: number
}

type FirestoreDocument = {
  name: string
  fields?: Record<string, FirestoreValue>
  createTime?: string
  updateTime?: string
}

type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

const accessTokenCache = new Map<string, CachedAccessToken>()

function badRequest(message: string, status = 400): never {
  throw new HTTPException(status, { message })
}

export function getServiceAccount(env: AdminBindings): ServiceAccount {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    badRequest('Missing FIREBASE_SERVICE_ACCOUNT_JSON environment secret.', 500)
  }

  try {
    const parsed = JSON.parse(raw) as ServiceAccount
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email || !parsed.token_uri) {
      badRequest('FIREBASE_SERVICE_ACCOUNT_JSON is missing required keys.', 500)
    }
    return parsed
  } catch {
    badRequest('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.', 500)
  }
}

function getAllowedAdminEmails(env: AdminBindings): Set<string> {
  return new Set(
    String(env.ADMIN_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  )
}

async function signServiceAccountJwt(serviceAccount: ServiceAccount, scopes: string[]): Promise<string> {
  const key = await importPKCS8(serviceAccount.private_key, 'RS256')
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({
    scope: scopes.join(' ')
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience(serviceAccount.token_uri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)
}

export async function getGoogleAccessToken(
  env: AdminBindings,
  scopes = [
    'https://www.googleapis.com/auth/datastore',
    'https://www.googleapis.com/auth/identitytoolkit'
  ]
): Promise<string> {
  const serviceAccount = getServiceAccount(env)
  const cacheKey = `${serviceAccount.client_email}:${scopes.join(' ')}`
  const cached = accessTokenCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken
  }

  const assertion = await signServiceAccountJwt(serviceAccount, scopes)
  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  })

  if (!response.ok) {
    const detail = await response.text()
    badRequest(`Failed to obtain Google access token: ${detail}`, 500)
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number }
  accessTokenCache.set(cacheKey, {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000
  })

  return payload.access_token
}

function getFirestoreBaseUrl(env: AdminBindings): string {
  const serviceAccount = getServiceAccount(env)
  return `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents`
}

async function firestoreFetch(
  env: AdminBindings,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const accessToken = await getGoogleAccessToken(env)
  return fetch(`${getFirestoreBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  })
}

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value }
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((entry) => encodeValue(entry))
      }
    }
  }
  if (typeof value === 'object') {
    const fields = Object.entries(value as Record<string, unknown>).reduce<Record<string, FirestoreValue>>(
      (accumulator, [key, entry]) => {
        if (entry !== undefined) {
          accumulator[key] = encodeValue(entry)
        }
        return accumulator
      },
      {}
    )
    return { mapValue: { fields } }
  }

  return { stringValue: String(value) }
}

function decodeValue(value?: FirestoreValue): unknown {
  if (!value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('nullValue' in value) return null
  if ('timestampValue' in value) return value.timestampValue
  if ('arrayValue' in value) return (value.arrayValue.values || []).map((entry) => decodeValue(entry))
  if ('mapValue' in value) {
    return Object.entries(value.mapValue.fields || {}).reduce<Record<string, unknown>>((accumulator, [key, entry]) => {
      accumulator[key] = decodeValue(entry)
      return accumulator
    }, {})
  }
  return null
}

function fromFirestoreDocument(document: FirestoreDocument | null): Record<string, unknown> | null {
  if (!document) return null
  const payload = Object.entries(document.fields || {}).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    accumulator[key] = decodeValue(value)
    return accumulator
  }, {})

  const segments = document.name.split('/')
  payload.id = segments[segments.length - 1]
  payload._createTime = document.createTime || null
  payload._updateTime = document.updateTime || null
  return payload
}

export async function getDocument(env: AdminBindings, path: string): Promise<Record<string, unknown> | null> {
  const response = await firestoreFetch(env, `/${path}`)
  if (response.status === 404) return null
  if (!response.ok) {
    badRequest(`Failed to load document ${path}.`, 500)
  }
  const document = (await response.json()) as FirestoreDocument
  return fromFirestoreDocument(document)
}

export async function listCollection(
  env: AdminBindings,
  collectionId: string,
  options: { limit?: number; orderBy?: string; direction?: 'ASCENDING' | 'DESCENDING' } = {}
): Promise<Record<string, unknown>[]> {
  const serviceAccount = getServiceAccount(env)
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await getGoogleAccessToken(env)}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          ...(options.orderBy
            ? {
                orderBy: [
                  {
                    field: { fieldPath: options.orderBy },
                    direction: options.direction || 'DESCENDING'
                  }
                ]
              }
            : {}),
          limit: options.limit || 100
        }
      })
    }
  )

  if (!response.ok) {
    badRequest(`Failed to query ${collectionId}.`, 500)
  }

  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>
  return rows
    .map((row) => fromFirestoreDocument(row.document || null))
    .filter((row): row is Record<string, unknown> => Boolean(row))
}

export async function createDocument(
  env: AdminBindings,
  collectionId: string,
  data: Record<string, unknown>,
  documentId?: string
): Promise<Record<string, unknown>> {
  const search = documentId ? `?documentId=${encodeURIComponent(documentId)}` : ''
  const response = await firestoreFetch(env, `/${collectionId}${search}`, {
    method: 'POST',
    body: JSON.stringify({
      fields: Object.entries(data).reduce<Record<string, FirestoreValue>>((accumulator, [key, value]) => {
        accumulator[key] = encodeValue(value)
        return accumulator
      }, {})
    })
  })

  if (!response.ok) {
    const detail = await response.text()
    badRequest(`Failed to create ${collectionId} document: ${detail}`, 500)
  }

  return fromFirestoreDocument((await response.json()) as FirestoreDocument) || {}
}

export async function updateDocument(
  env: AdminBindings,
  path: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const updateMask = Object.keys(data)
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&')

  const response = await firestoreFetch(env, `/${path}?${updateMask}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: Object.entries(data).reduce<Record<string, FirestoreValue>>((accumulator, [key, value]) => {
        accumulator[key] = encodeValue(value)
        return accumulator
      }, {})
    })
  })

  if (!response.ok) {
    const detail = await response.text()
    badRequest(`Failed to update ${path}: ${detail}`, 500)
  }

  return fromFirestoreDocument((await response.json()) as FirestoreDocument) || {}
}

export async function deleteDocument(env: AdminBindings, path: string): Promise<void> {
  const response = await firestoreFetch(env, `/${path}`, { method: 'DELETE' })
  if (!response.ok && response.status !== 404) {
    const detail = await response.text()
    badRequest(`Failed to delete ${path}: ${detail}`, 500)
  }
}

function getBearerToken(c: Context<{ Bindings: AdminBindings }>): string {
  const header = c.req.header('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    badRequest('Missing Bearer token.', 401)
  }
  return match[1]
}

async function verifyFirebaseToken(env: AdminBindings, token: string): Promise<TokenPayload> {
  const serviceAccount = getServiceAccount(env)
  const verified = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${serviceAccount.project_id}`,
    audience: serviceAccount.project_id
  }).catch(() => null)

  if (!verified) {
    badRequest('Invalid Firebase ID token.', 401)
  }

  const claims = verified.payload as Record<string, unknown>
  const uid = String(claims.user_id || claims.sub || '')
  if (!uid) {
    badRequest('Firebase token did not include a user identifier.', 401)
  }

  return {
    uid,
    email: claims.email ? String(claims.email) : null,
    claims
  }
}

async function hasAdminUsersAccess(env: AdminBindings, uid: string, email: string | null): Promise<boolean> {
  const adminDoc = await getDocument(env, `admin_users/${uid}`)
  if (!adminDoc) return false
  if (adminDoc.active === false) return false
  if (adminDoc.active === true) return true
  if (email && String(adminDoc.email || '').toLowerCase() === email.toLowerCase()) return true
  return false
}

export async function verifyAdminRequest(c: Context<{ Bindings: AdminBindings }>): Promise<AdminIdentity> {
  const token = getBearerToken(c)
  const tokenPayload = await verifyFirebaseToken(c.env, token)
  const normalizedEmail = tokenPayload.email?.toLowerCase() || null

  if (tokenPayload.claims.admin === true) {
    return { ...tokenPayload, accessSource: 'custom-claim' }
  }

  if (normalizedEmail && getAllowedAdminEmails(c.env).has(normalizedEmail)) {
    return { ...tokenPayload, accessSource: 'env-allowlist' }
  }

  if (await hasAdminUsersAccess(c.env, tokenPayload.uid, normalizedEmail)) {
    return { ...tokenPayload, accessSource: 'admin-users' }
  }

  badRequest('You are authenticated, but you do not have admin access.', 403)
}

export function generateTrackingId(): string {
  return `SWG-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}
