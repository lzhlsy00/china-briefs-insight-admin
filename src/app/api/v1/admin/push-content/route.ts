import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { handleRouteError } from '@/lib/api/error'
import { successResponse } from '@/lib/api/response'

const FIELDS = 'id, title, subject, logo, banner, footer, content, date, published'

const createSchema = z.object({
  title: z.string().trim().min(1),
  subject: z.string().trim().optional().nullable(),
  logo: z.string().trim().optional().nullable(),
  banner: z.string().trim().optional().nullable(),
  footer: z.string().trim().optional().nullable(),
  content: z.string().trim().min(1),
  date: z.string().trim().optional().nullable(),
})

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const GET = async () => {
  try {
    const { data, error } = await supabase
      .from('push_content')
      .select('id, title, date, published')
      .order('date', { ascending: false, nullsFirst: false })

    if (error) {
      throw error
    }

    return successResponse({ pushContents: data ?? [] })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const POST = async (request: NextRequest) => {
  try {
    const payload = createSchema.safeParse(await request.json())

    if (!payload.success) {
      return handleRouteError(payload.error)
    }

    const { title, subject, logo, banner, footer, content, date } = payload.data
    const insertPayload = {
      title,
      subject: subject ?? null,
      logo: logo ?? null,
      banner: banner ?? null,
      footer: footer ?? null,
      content,
      date: date ?? new Date().toISOString(),
      published: false,
    }

    const { data, error } = await supabase
      .from('push_content')
      .insert(insertPayload)
      .select(FIELDS)
      .single()

    if (error) {
      throw error
    }

    return successResponse({ pushContent: data }, { status: 201, message: '推送内容已创建' })
  } catch (error) {
    return handleRouteError(error)
  }
}

export const OPTIONS = () => successResponse({ ok: true })
