import fs from 'node:fs'
import { SignJWT, importPKCS8 } from 'jose'

const [, , action = 'grant', identifier] = process.argv

if (!identifier || !['grant', 'revoke'].includes(action)) {
  console.error('Usage: node scripts/grant-admin.mjs <grant|revoke> <email-or-uid>')
  process.exit(1)
}

const rawServiceAccount =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  (process.env.FIREBASE_SERVICE_ACCOUNT_FILE
    ? fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8')
    : '')

if (!rawServiceAccount) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_FILE')
  process.exit(1)
}

const serviceAccount = JSON.parse(rawServiceAccount)

async function getAccessToken(scopes) {
  const key = await importPKCS8(serviceAccount.private_key, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  const assertion = await new SignJWT({ scope: scopes.join(' ') })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience(serviceAccount.token_uri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${await response.text()}`)
  }

  const payload = await response.json()
  return payload.access_token
}

async function googleJson(url, accessToken, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`${url} failed: ${await response.text()}`)
  }

  return response.json()
}

async function firestorePatch(url, accessToken, body) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`Firestore update failed: ${await response.text()}`)
  }

  return response.json()
}

function encodeFields(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (typeof value === 'boolean') return [key, { booleanValue: value }]
      return [key, { stringValue: String(value) }]
    })
  )
}

const accessToken = await getAccessToken([
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/identitytoolkit'
])

const lookupPayload = identifier.includes('@') ? { email: [identifier] } : { localId: [identifier] }
const lookup = await googleJson(
  `https://identitytoolkit.googleapis.com/v1/projects/${serviceAccount.project_id}/accounts:lookup`,
  accessToken,
  lookupPayload
)

const user = lookup.users?.[0]
if (!user) {
  throw new Error(`No Firebase Auth user found for ${identifier}`)
}

const existingClaims = user.customAttributes ? JSON.parse(user.customAttributes) : {}
const nextClaims = { ...existingClaims, admin: action === 'grant' }

await googleJson(
  `https://identitytoolkit.googleapis.com/v1/projects/${serviceAccount.project_id}/accounts:update`,
  accessToken,
  {
    localId: user.localId,
    customAttributes: JSON.stringify(nextClaims)
  }
)

const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents/admin_users/${user.localId}?updateMask.fieldPaths=active&updateMask.fieldPaths=email&updateMask.fieldPaths=updatedAt`
await firestorePatch(firestoreUrl, accessToken, {
  fields: encodeFields({
    active: action === 'grant',
    email: user.email || '',
    updatedAt: new Date().toISOString()
  })
})

console.log(`${action === 'grant' ? 'Granted' : 'Revoked'} admin access for ${user.email || user.localId}`)
