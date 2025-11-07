import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { handleRouteError } from '@/lib/api/error'
import { successResponse, errorResponse } from '@/lib/api/response'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === 'number' ? value : Number(value)))
    .refine((value) => Number.isInteger(value) && value > 0, 'Invalid push content id'),
})

const isPromise = <T>(value: unknown): value is Promise<T> => {
  return typeof value === 'object' && value !== null && 'then' in (value as Record<string, unknown>) && typeof (value as { then: unknown }).then === 'function'
}

const resolveParams = async (
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) => {
  const raw = (context as { params: { id: string } } | { params: Promise<{ id: string }> } | undefined)?.params
  const resolved = raw && isPromise<{ id: string }>(raw) ? await raw : ((raw as { id: string }) ?? { id: '' })

  return paramsSchema.parse(resolved)
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const sendPushContent = async (contentId: number) => {
  const endpoint = process.env.SEND_DIGEST_ENDPOINT
  if (!endpoint) {
    throw new Error('SEND_DIGEST_ENDPOINT 未配置，无法触发推送')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (process.env.SEND_DIGEST_TOKEN) {
    headers.Authorization = `Bearer ${process.env.SEND_DIGEST_TOKEN}`
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contentId }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `推送服务返回状态码 ${response.status}`)
  }

  return response
}

export const POST = async (
  _request: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await resolveParams(context)

    const { data, error } = await supabase
      .from('push_content')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return errorResponse('推送内容不存在', { status: 404 })
    }

    await sendPushContent(id)

    return successResponse({ triggered: true }, { message: '推送任务已触发' })
  } catch (error) {
    return handleRouteError(error)
  }
}
