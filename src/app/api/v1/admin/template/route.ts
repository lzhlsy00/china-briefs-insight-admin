import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { handleRouteError } from '@/lib/api/error'
import { successResponse, optionsResponse } from '@/lib/api/response'

const insertSchema = z.object({
  logo: z.string().trim().optional().nullable(),
  title: z.string().trim().optional().nullable(),
  subject: z.string().trim().optional().nullable(),
  content: z.string().trim().optional().nullable(),
  banner: z.string().trim().optional().nullable(),
  footer: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
})

const TEMPLATE_FIELDS = 'id, logo, title, subject, content, banner, footer, is_active'

const sanitizePayload = (payload: Record<string, unknown>) => {
  const result: Record<string, string | null> = {}

  ;(['logo', 'title', 'subject', 'content', 'banner', 'footer'] as const).forEach((key) => {
    if (payload[key] !== undefined) {
      const value = payload[key]
      if (value === null) {
        result[key] = null
      } else if (typeof value === 'string') {
        result[key] = value
      } else {
        result[key] = String(value)
      }
    }
  })

  return result
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const GET = async () => {
  try {
    const { data, error } = await supabase
      .from('template')
      .select(TEMPLATE_FIELDS)
      .order('is_active', { ascending: false })
      .order('id', { ascending: false })

    if (error) {
      throw error
    }

    return successResponse({ templates: data ?? [] })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const POST = async (request: NextRequest) => {
  try {
    const raw = await request.json()
    const payload = insertSchema.safeParse(raw)

    if (!payload.success) {
      return handleRouteError(payload.error)
    }

    const { isActive, ...templateFields } = payload.data
    const sanitized = sanitizePayload(templateFields)

    if (Object.keys(sanitized).length === 0) {
      return successResponse({ template: null }, { status: 200, message: 'No data provided' })
    }

    const supabaseClient = supabase

    const insertPayload = {
      ...sanitized,
      ...(isActive !== undefined ? { is_active: isActive } : {}),
    }

    const { data, error } = await supabaseClient
      .from('template')
      .insert(insertPayload)
      .select(TEMPLATE_FIELDS)
      .single()

    if (error) {
      throw error
    }

    if (isActive) {
      await supabaseClient.from('template').update({ is_active: false }).neq('id', data.id)
      const { data: refreshed } = await supabaseClient
        .from('template')
        .select(TEMPLATE_FIELDS)
        .eq('id', data.id)
        .maybeSingle()

      return successResponse({ template: refreshed ?? data }, { status: 201, message: 'Template created' })
    }

    return successResponse({ template: data }, { status: 201, message: 'Template created' })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const OPTIONS = () => optionsResponse()
