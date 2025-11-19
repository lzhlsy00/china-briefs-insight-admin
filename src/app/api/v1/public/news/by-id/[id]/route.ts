import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { applyCorsHeaders, createCorsPreflightResponse } from '@/lib/api/cors'
import { handleRouteError } from '@/lib/api/error'
import { errorResponse, successResponse } from '@/lib/api/response'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const idSchema = z.coerce.number().int().positive('ID 必须为正整数')

const resolveId = async (context: RouteContext) => {
  const { id } = await context.params
  return idSchema.parse(id)
}

export const GET = async (request: NextRequest, context: RouteContext) => {
  try {
    const id = await resolveId(context)

    const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .eq('status', 'PUBLISH')
      .maybeSingle()

    if (error || !data) {
      return applyCorsHeaders(errorResponse('新闻不存在或未发布', { status: 404 }), request)
    }

    const {
      ai_reason: _aiReason,
      iso_date,
      ai_worth,
      ai_reason_en,
      ai_reason_ko,
      'translation-ko': translationKo,
      'translation-en': translationEn,
      'title-ko': titleKo,
      'title-en': titleEn,
      ...rest
    } = data

    void _aiReason

    const response = {
      ...rest,
      isoDate: iso_date,
      aiWorth: ai_worth,
      aiReasonEn: ai_reason_en,
      aiReasonKo: ai_reason_ko,
      translationKo,
      translationEn,
      titleKo,
      titleEn,
    }

    return applyCorsHeaders(successResponse(response), request)
  } catch (error) {
    return applyCorsHeaders(handleRouteError(error), request)
  }
}

export const OPTIONS = async (request: NextRequest) => createCorsPreflightResponse(request)
