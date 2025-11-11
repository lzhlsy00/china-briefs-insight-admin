import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { handleRouteError } from '@/lib/api/error'
import { errorResponse, successResponse } from '@/lib/api/response'

const FIELDS = 'id, title, subject, logo, banner, footer, content, date, published, local'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const dateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), '推送时间格式不正确')

const updateSchema = z
  .object({
    title: z.string().trim().min(1, '标题不能为空').optional(),
    subject: z.string().trim().optional().nullable(),
    logo: z.string().trim().optional().nullable(),
    banner: z.string().trim().optional().nullable(),
    footer: z.string().trim().optional().nullable(),
    content: z.string().trim().min(1, '正文不能为空').optional(),
    date: dateSchema.optional().nullable(),
    published: z.boolean().optional(),
    local: z.string().trim().min(1).max(32).optional().nullable(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: '至少需要提供一个字段进行更新',
  })

type UpdatePayload = z.infer<typeof updateSchema>

const buildUpdateBody = (input: UpdatePayload): Record<string, unknown> => {
  const payload: Record<string, unknown> = {}

  if (input.title !== undefined) payload.title = input.title
  if (input.subject !== undefined) payload.subject = input.subject?.length ? input.subject : null
  if (input.logo !== undefined) payload.logo = input.logo?.length ? input.logo : null
  if (input.banner !== undefined) payload.banner = input.banner?.length ? input.banner : null
  if (input.footer !== undefined) payload.footer = input.footer?.length ? input.footer : null
  if (input.content !== undefined) payload.content = input.content
  if (input.date !== undefined) payload.date = input.date ?? null
  if (input.published !== undefined) payload.published = input.published
  if (input.local !== undefined) payload.local = input.local?.trim()?.length ? input.local.trim() : 'zh-CN'

  return payload
}

const resolveIdFilters = async (context: RouteContext) => {
  const { id } = await context.params
  const numericId = Number(id)

  if (!Number.isNaN(numericId) && Number.isFinite(numericId)) {
    return [numericId, id] as const
  }

  return [null, id] as const
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const GET = async (_request: NextRequest, context: RouteContext) => {
  try {
    const [numericId, rawId] = await resolveIdFilters(context)

    let data: Record<string, unknown> | null = null
    let error: Error | null = null

    if (numericId !== null) {
      const response = await supabase
        .from('push_content')
        .select(FIELDS)
        .eq('id', numericId)
        .maybeSingle()

      data = response.data as Record<string, unknown> | null
      error = response.error as Error | null
    }

    if ((!data && !error) || error) {
      const response = await supabase
        .from('push_content')
        .select(FIELDS)
        .eq('id', rawId)
        .maybeSingle()

      data = response.data as Record<string, unknown> | null
      error = response.error as Error | null
    }

    if (error) {
      throw error
    }

    if (!data) {
      return errorResponse('推送内容不存在', { status: 404 })
    }

    return successResponse({ pushContent: data })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const PUT = async (request: NextRequest, context: RouteContext) => {
  try {
    const [numericId, rawId] = await resolveIdFilters(context)
    const payload = updateSchema.parse(await request.json())
    const updateBody = buildUpdateBody(payload)

    let data: Record<string, unknown> | null = null
    let error: Error | null = null

    if (numericId !== null) {
      const response = await supabase
        .from('push_content')
        .update(updateBody)
        .eq('id', numericId)
        .select(FIELDS)
        .maybeSingle()

      data = response.data as Record<string, unknown> | null
      error = response.error as Error | null
    }

    if ((!data && !error) || error) {
      const response = await supabase
        .from('push_content')
        .update(updateBody)
        .eq('id', rawId)
        .select(FIELDS)
        .maybeSingle()

      data = response.data as Record<string, unknown> | null
      error = response.error as Error | null
    }

    if (error) {
      throw error
    }

    if (!data) {
      return errorResponse('推送内容不存在', { status: 404 })
    }

    return successResponse({ pushContent: data }, { message: '推送内容已更新' })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const DELETE = async (_request: NextRequest, context: RouteContext) => {
  try {
    const [numericId, rawId] = await resolveIdFilters(context)

    let data: Record<string, unknown> | null = null
    let error: Error | null = null

    if (numericId !== null) {
      const response = await supabase
        .from('push_content')
        .delete()
        .eq('id', numericId)
        .select('id')
        .maybeSingle()

      data = response.data as Record<string, unknown> | null
      error = response.error as Error | null
    }

    if ((!data && !error) || error) {
      const response = await supabase
        .from('push_content')
        .delete()
        .eq('id', rawId)
        .select('id')
        .maybeSingle()

      data = response.data as Record<string, unknown> | null
      error = response.error as Error | null
    }

    if (error) {
      throw error
    }

    if (!data) {
      return errorResponse('推送内容不存在', { status: 404 })
    }

    return successResponse({ deleted: true }, { message: '推送内容已删除' })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const OPTIONS = () => successResponse({ ok: true })
