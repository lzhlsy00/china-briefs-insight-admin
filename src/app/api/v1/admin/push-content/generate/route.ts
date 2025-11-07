import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { handleRouteError } from '@/lib/api/error'
import { errorResponse, successResponse } from '@/lib/api/response'
import { generatePushContent, PushContentGenerationError } from '@/lib/ai/pushContentGenerator'

const requestSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空'),
  subject: z.string().trim().optional().nullable(),
  logo: z.string().trim().optional().nullable(),
  banner: z.string().trim().optional().nullable(),
  footer: z.string().trim().optional().nullable(),
  prompt: z.string().trim().min(1, '提示词不能为空'),
  date: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: '日期格式不正确，应为 ISO8601 格式',
    }),
})

const sanitizeOptional = (value: string | null | undefined) => {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const POST = async (request: NextRequest) => {
  try {
    const json = await request.json().catch(() => ({}))
    const payload = requestSchema.parse(json)

    const generatedContent = await generatePushContent(payload.prompt)

    const insertPayload = {
      title: payload.title,
      subject: sanitizeOptional(payload.subject),
      logo: sanitizeOptional(payload.logo),
      banner: sanitizeOptional(payload.banner),
      footer: sanitizeOptional(payload.footer),
      content: generatedContent,
      date: payload.date ? new Date(payload.date).toISOString() : new Date().toISOString(),
      published: false,
    }

    const { data, error } = await supabase
      .from('push_content')
      .insert(insertPayload)
      .select('id, title, subject, logo, banner, footer, content, date, published')
      .single()

    if (error) {
      throw error
    }

    return successResponse({ pushContent: data }, { status: 201, message: '推送内容已生成' })
  } catch (err) {
    if (err instanceof PushContentGenerationError) {
      return errorResponse(err.message, { status: 400 })
    }

    if (err instanceof z.ZodError) {
      return errorResponse('参数错误', {
        status: 400,
        errors: err.errors.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      })
    }

    return handleRouteError(err)
  }
}

export const OPTIONS = () => successResponse({ ok: true })
