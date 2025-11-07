import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { handleRouteError } from '@/lib/api/error'
import { successResponse } from '@/lib/api/response'

const requestSchema = z.object({
  newsIds: z.array(z.number().int().positive()).min(1),
  templateId: z.number().int().positive().optional().nullable(),
})

const formatGeneratedContent = (items: Array<{
  id: number
  titleEn: string
  titleKo: string
  translationEn: string
  translationKo: string
  link: string | null
}>) => {
  return items
    .map((item, index) => {
      const title = item.titleEn || item.titleKo || `新闻 ${index + 1}`
      const summaryEn = item.translationEn.trim()
      const summaryKo = item.translationKo.trim()
      const lines = [
        `### ${index + 1}. ${title.trim()}`,
      ]

      if (summaryEn) {
        lines.push(summaryEn)
      }

      if (summaryKo) {
        lines.push('', summaryKo)
      }

      if (item.link) {
        lines.push('', `👉 阅读原文：${item.link}`)
      }

      return lines.join('\n')
    })
    .join('\n\n')
}

const TEMPLATE_FIELDS = 'id, title, subject, content, logo, banner, footer, date'

export const dynamic = 'force-dynamic'

export const POST = async (request: NextRequest) => {
  try {
    const payload = requestSchema.safeParse(await request.json())

    if (!payload.success) {
      return handleRouteError(payload.error)
    }

    const { newsIds, templateId } = payload.data
    const uniqueIds = Array.from(new Set(newsIds))

    const { data: rows, error } = await supabase
      .from('news')
      .select('id, link, status, title, "title-en", "title-ko", "translation-en", "translation-ko"')
      .in('id', uniqueIds)
      .eq('status', 'PUBLISH')

    if (error) {
      throw error
    }

    const items = (rows ?? []).map((row) => ({
      id: Number(row.id),
      titleEn: (row['title-en'] as string | null) ?? (row.title as string | null) ?? '',
      titleKo: (row['title-ko'] as string | null) ?? '',
      translationEn: (row['translation-en'] as string | null) ?? '',
      translationKo: (row['translation-ko'] as string | null) ?? '',
      link: (row.link as string | null) ?? null,
    }))

    const ordered = uniqueIds
      .map((id) => items.find((item) => item.id === id))
      .filter((value): value is (typeof items)[number] => Boolean(value))

    if (ordered.length === 0) {
      return handleRouteError(new Error('未找到可用的新闻数据'))
    }

    const generatedContent = formatGeneratedContent(ordered)

    let result

    if (templateId) {
      const { data: updated, error: updateError } = await supabase
        .from('push_content')
        .update({ content: generatedContent })
        .eq('id', templateId)
        .select(TEMPLATE_FIELDS)
        .maybeSingle()

      if (updateError) {
        throw updateError
      }

      result = updated ?? null
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('push_content')
        .insert({
          content: generatedContent,
          date: new Date().toISOString(),
          published: false,
        })
        .select(TEMPLATE_FIELDS)
        .single()

      if (insertError) {
        throw insertError
      }

      result = inserted
    }

    return successResponse({ template: result, generated: generatedContent }, { message: '内容已生成' })
  } catch (error) {
    return handleRouteError(error)
  }
}
