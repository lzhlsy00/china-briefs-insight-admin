import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StripeEvent = {
  id?: string
  type?: string
  data?: {
    object?: Record<string, unknown>
  }
}

const parseStripeSignature = (signatureHeader: string) => {
  return signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=')
    if (key && value) {
      acc[key.trim()] = value.trim()
    }
    return acc
  }, {})
}

const verifyStripeSignature = (payload: string, signatureHeader: string, secret: string) => {
  const elements = parseStripeSignature(signatureHeader)
  const timestamp = elements.t
  const signature = elements.v1

  if (!timestamp || !signature) {
    return false
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex')

  const signatureBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET environment variable')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe signature header' }, { status: 400 })
  }

  const payload = await request.text()

  const isValid = verifyStripeSignature(payload, signature, secret)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(payload)
  } catch (error) {
    console.error('Failed to parse Stripe event payload', error)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed':
      console.info('Stripe checkout completed', {
        eventId: event.id,
        type: event.type,
        session: event.data?.object,
      })
      break
    case 'invoice.payment_succeeded':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      console.info('Stripe subscription event received', {
        eventId: event.id,
        type: event.type,
        payload: event.data?.object,
      })
      break
    default:
      console.info('Unhandled Stripe event type', event.type)
  }

  return NextResponse.json({ received: true })
}
