import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { handleRouteError } from '@/lib/api/error'
import { successResponse } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

const TEMPLATE_FIELDS = 'id, title, subject, content, logo, banner, footer, date'

type TemplatePayload = {
  id?: number
  title?: string
  subject?: string
  content?: string
  logo?: string
  banner?: string
  footer?: string
}

const sanitizePayload = (payload: TemplatePayload) => {
  const next: Record<string, string | null> = {}

  ;(['title', 'subject', 'content', 'logo', 'banner', 'footer'] as const).forEach((key) => {
    if (payload[key] !== undefined) {
      const value = payload[key]
      next[key] = value === null || value === undefined ? null : String(value)
    }
  })

  return next
}

export const GET = async () => {
  try {
    const { data, error } = await supabase
      .from('push_content')
      .select(TEMPLATE_FIELDS)
      .order('date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    return successResponse({ template: data ?? null })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const POST = async (request: NextRequest) => {
  try {
    const payload = (await request.json()) as TemplatePayload
    const updateData = sanitizePayload(payload)

    if (Object.keys(updateData).length === 0) {
      return successResponse({ template: null }, { message: 'No changes provided', status: 200 })
    }

    let result

    if (payload.id !== undefined && payload.id !== null) {
      const { data, error } = await supabase
        .from('push_content')
        .update(updateData)
        .eq('id', payload.id)
        .select(TEMPLATE_FIELDS)
        .maybeSingle()

      if (error) {
        throw error
      }

      result = data ?? null
    } else {
      const insertData = {
        ...updateData,
        date: new Date().toISOString(),
        published: false,
      }

      const { data, error } = await supabase
        .from('push_content')
        .insert(insertData)
        .select(TEMPLATE_FIELDS)
        .single()

      if (error) {
        throw error
      }

      result = data
    }

    return successResponse({ template: result }, { message: 'Template saved' })
  } catch (error) {
    return handleRouteError(error)
  }
}
