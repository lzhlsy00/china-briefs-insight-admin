import { supabase } from '@/lib/supabase'
import { handleRouteError } from '@/lib/api/error'
import { successResponse } from '@/lib/api/response'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

type RawSendEmailRow = {
  user_mail?: string | null
  is_delivered?: boolean | null
  mail_content_id?: number | null
  created_at?: string | null
  createdAt?: string | null
  inserted_at?: string | null
  insertedAt?: string | null
}

const pickTimestamp = (row: RawSendEmailRow) => {
  return (
    row.created_at ??
    row.createdAt ??
    row.inserted_at ??
    row.insertedAt ??
    null
  )
}

export const GET = async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Number.parseInt(searchParams.get('limit') ?? '20', 10)
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('send_email')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    const mailContentIds = [
      ...new Set((data ?? [])
        .map((item) => item.mail_content_id)
        .filter((id): id is number => typeof id === 'number')),
    ]

    const contentMap = new Map<number, { title: string | null; date: string | null }>()

    if (mailContentIds.length > 0) {
      const { data: contents, error: contentError } = await supabase
        .from('push_content')
        .select('id, title, date')
        .in('id', mailContentIds)

      if (contentError) {
        throw contentError
      }

      contents?.forEach((item) => {
        const numericId = Number(item.id)
        if (!Number.isNaN(numericId)) {
          contentMap.set(numericId, {
            title: (item.title as string | null) ?? null,
            date: (item.date as string | null) ?? null,
          })
        }
      })
    }

    const rows = (data ?? []).map((row) => {
      const contentInfo = row.mail_content_id ? contentMap.get(row.mail_content_id) : undefined
      const timestamp = pickTimestamp(row)

      return {
        userMail: row.user_mail ?? null,
        isDelivered: row.is_delivered ?? null,
        title: contentInfo?.title ?? 'Unknown',
        date: contentInfo?.date ?? timestamp,
        mailContentId: row.mail_content_id ?? null,
        createdAt: timestamp,
      }
    })

    return successResponse({
      records: rows,
      pagination: {
        current: page,
        limit,
        totalCount: count ?? 0,
        totalPages: limit > 0 && count ? Math.ceil((count ?? 0) / limit) : 0,
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
