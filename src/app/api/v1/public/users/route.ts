import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { errorResponse, successResponse, optionsResponse } from '@/lib/api/response'
import { handleRouteError } from '@/lib/api/error'

export const dynamic = 'force-dynamic'

type UserProfileRecord = {
  id: string
  email: string
  subscription_status: string | null
  created_at: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid request payload', { status: 400 })
    }

    const { email: rawEmail, userId: rawUserId, id: rawBodyId } = body as {
      email?: unknown
      userId?: unknown
      id?: unknown
    }

    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    const userIdSource = typeof rawUserId === 'string' ? rawUserId.trim() : null
    const fallbackUserId = typeof rawBodyId === 'string' ? rawBodyId.trim() : null
    const userId = userIdSource || fallbackUserId || ''

    if (!email) {
      return errorResponse('Email is required', { status: 400 })
    }

    if (!userId) {
      return errorResponse('User ID is required', { status: 400 })
    }

    const { data: existingById, error: fetchByIdError } = await supabase
      .from('user_profiles')
      .select('id, email, subscription_status, created_at')
      .eq('id', userId)
      .maybeSingle<UserProfileRecord>()

    if (fetchByIdError) {
      console.error('Supabase fetch user_profiles by id error:', fetchByIdError)
      return errorResponse('Failed to fetch user profile', { status: 500 })
    }

    if (existingById) {
      if (!existingById.email && email) {
        await supabase
          .from('user_profiles')
          .update({ email, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .single()
      }

      return successResponse({
        user: {
          id: existingById.id,
          email: existingById.email ?? email,
          subscription_status: existingById.subscription_status ?? 'free',
          created_at: existingById.created_at,
        },
        isNewUser: false,
      })
    }

    const { data: existingByEmail, error: fetchByEmailError } = await supabase
      .from('user_profiles')
      .select('id, email, subscription_status, created_at')
      .eq('email', email)
      .maybeSingle<UserProfileRecord>()

    if (fetchByEmailError) {
      console.error('Supabase fetch user_profiles by email error:', fetchByEmailError)
      return errorResponse('Failed to fetch user profile', { status: 500 })
    }

    if (existingByEmail) {
      if (existingByEmail.id !== userId) {
        console.warn('User profile email already in use with different id', {
          existingId: existingByEmail.id,
          incomingId: userId,
        })
      }

      return successResponse({
        user: {
          id: existingByEmail.id,
          email: existingByEmail.email ?? email,
          subscription_status: existingByEmail.subscription_status ?? 'free',
          created_at: existingByEmail.created_at,
        },
        isNewUser: false,
      })
    }

    const now = new Date().toISOString()

    const { data: inserted, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        email,
        subscription_status: 'free',
        created_at: now,
        updated_at: now,
        transactions: 0,
      })
      .select('id, email, subscription_status, created_at')
      .single<UserProfileRecord>()

    if (insertError || !inserted) {
      console.error('Supabase insert user_profiles error:', insertError)
      return errorResponse('Failed to create user profile', { status: 500 })
    }

    return successResponse({
      user: {
        id: inserted.id,
        email: inserted.email,
        subscription_status: inserted.subscription_status ?? 'free',
        created_at: inserted.created_at,
      },
      isNewUser: true,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export function OPTIONS() {
  return optionsResponse();
}
