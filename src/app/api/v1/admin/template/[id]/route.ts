import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { handleRouteError } from '@/lib/api/error'
import { optionsResponse, successResponse } from '@/lib/api/response'

const TEMPLATE_FIELDS = 'id, logo, title, subject, content, banner, footer, is_active'

const idParamSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === 'number' ? value : Number(value)))
    .refine((value) => Number.isInteger(value) && value > 0, 'Invalid template id'),
})

const isPromise = <T>(value: unknown): value is Promise<T> => {
  return typeof value === 'object' && value !== null && 'then' in (value as Record<string, unknown>) && typeof (value as { then: unknown }).then === 'function'
}

const resolveParams = async (context: { params: { id: string } } | { params: Promise<{ id: string }> }) => {
  const raw = (context as { params: { id: string } } | { params: Promise<{ id: string }> } | undefined)?.params
  const resolved = raw && isPromise<{ id: string }>(raw)
    ? await raw
    : ((raw as { id: string }) ?? { id: '' })

  return idParamSchema.parse(resolved)
}

const updateSchema = z.object({
  logo: z.string().trim().optional().nullable(),
  title: z.string().trim().optional().nullable(),
  subject: z.string().trim().optional().nullable(),
  content: z.string().trim().optional().nullable(),
  banner: z.string().trim().optional().nullable(),
  footer: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
})

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

export const GET = async (_request: NextRequest, context: { params: { id: string } } | { params: Promise<{ id: string }> }) => {
  try {
    const params = await resolveParams(context)

    const { data, error } = await supabase
      .from('template')
      .select(TEMPLATE_FIELDS)
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return successResponse({ template: null }, { status: 404, message: 'Template not found' })
    }

    return successResponse({ template: data })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const PUT = async (request: NextRequest, context: { params: { id: string } } | { params: Promise<{ id: string }> }) => {
  try {
    const params = await resolveParams(context)
    const body = await request.json()
    const payload = updateSchema.safeParse(body)

    if (!payload.success) {
      return handleRouteError(payload.error)
    }

    const { isActive, ...fields } = payload.data
    const sanitized = sanitizePayload(fields)
    const updateData: Record<string, string | null | boolean> = { ...sanitized }

    if (isActive !== undefined) {
      updateData.is_active = isActive
    }

    if (Object.keys(updateData).length === 0) {
      return successResponse({ template: null }, { status: 200, message: 'No changes provided' })
    }

    const supabaseClient = supabase

    const { data, error } = await supabaseClient
      .from('template')
      .update(updateData)
      .eq('id', params.id)
      .select(TEMPLATE_FIELDS)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return successResponse({ template: null }, { status: 404, message: 'Template not found' })
    }

    if (isActive === true) {
      await supabaseClient.from('template').update({ is_active: false }).neq('id', params.id)
      const { data: refreshed } = await supabaseClient
        .from('template')
        .select(TEMPLATE_FIELDS)
        .eq('id', params.id)
        .maybeSingle()

      return successResponse({ template: refreshed ?? data }, { message: 'Template updated' })
    }

    return successResponse({ template: data }, { message: 'Template updated' })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const DELETE = async (_request: NextRequest, context: { params: { id: string } } | { params: Promise<{ id: string }> }) => {
  try {
    const params = await resolveParams(context)

    const { data, error } = await supabase
      .from('template')
      .delete()
      .eq('id', params.id)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return successResponse({ template: null }, { status: 404, message: 'Template not found' })
    }

    return successResponse({ deleted: true }, { message: 'Template deleted' })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const OPTIONS = () => optionsResponse()
