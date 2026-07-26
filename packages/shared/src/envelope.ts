import { z } from 'zod'

export const paginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
})
export type PaginationMeta = z.infer<typeof paginationMetaSchema>

export function apiSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    error: z.null().optional(),
    meta: paginationMetaSchema.optional(),
  })
}

export const apiErrorSchema = z.object({
  success: z.literal(false),
  data: z.null().optional(),
  error: z.string(),
  meta: paginationMetaSchema.optional(),
})

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.union([apiSuccessSchema(dataSchema), apiErrorSchema])
}

export type ApiResponse<T> =
  | { success: true; data: T; error?: null; meta?: PaginationMeta }
  | { success: false; data?: null; error: string; meta?: PaginationMeta }
