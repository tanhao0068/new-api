/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { api } from '@/lib/http-client'

import { useUpdateOption } from '../hooks/use-update-option'

/** 体验中心支持的模型类型（与后端 controller/studio_capability.go 保持一致） */
const MODEL_TYPES = [
  { value: '', labelKey: 'Auto (by name)', fallback: '自动推断' },
  { value: 'text', labelKey: 'Text', fallback: '文本' },
  { value: 'image', labelKey: 'Image', fallback: '生图' },
  { value: 'video', labelKey: 'Video', fallback: '生视频' },
  { value: 'voice', labelKey: 'Voice', fallback: '语音' },
] as const

const AUTO_LABEL: Record<string, string> = {
  text: '文本',
  image: '生图',
  video: '生视频',
  voice: '语音',
}

type ModelCapabilitiesResponse = {
  capabilities: Record<string, string>
  suggested: Record<string, string>
}

export function ModelCapabilityCard(props: { rawValue?: string }) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const { data, isLoading, error } = useQuery({
    queryKey: ['studio-model-capabilities'],
    queryFn: async () => {
      const res = await api.get<{ data: ModelCapabilitiesResponse }>(
        '/api/studio/model_capabilities'
      )
      return res.data.data
    },
    staleTime: 60 * 1000,
  })

  // 已保存的显式指定值（来自 option）
  const saved = useMemo(() => {
    const raw = (props.rawValue ?? '').trim()
    if (!raw) return {} as Record<string, string>
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'object' && parsed
        ? (parsed as Record<string, string>)
        : {}
    } catch {
      return {} as Record<string, string>
    }
  }, [props.rawValue])

  const [draft, setDraft] = useState<Record<string, string>>(saved)
  useEffect(() => setDraft(saved), [saved])

  // 模型清单 = 后端返回的建议值键集合（来自已启用模型的权威列表）
  const modelNames = useMemo(
    () => Object.keys(data?.suggested ?? {}).sort(),
    [data]
  )
  const suggested = data?.suggested ?? {}

  const dirty = useMemo(
    () =>
      JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(saved)),
    [draft, saved]
  )

  const reset = useMutation({
    mutationFn: async () => {
      await updateOption.mutateAsync({
        key: 'studio.model_capabilities',
        value: '{}',
      })
    },
    onSuccess: () => toast.success(t('Model types reset')),
    onError: () => toast.error(t('Reset failed')),
  })

  const save = useMutation({
    mutationFn: async () => {
      await updateOption.mutateAsync({
        key: 'studio.model_capabilities',
        value: JSON.stringify(normalize(draft)),
      })
    },
    onSuccess: () => toast.success(t('Model types saved')),
    onError: () => toast.error(t('Save failed')),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Studio Model Types')}</CardTitle>
        <CardDescription>
          {t(
            'Specify which type each model belongs to in the Studio (text / image / video / voice). Model selection in each mode only lists models of the matching type. Leave "Auto" to infer from the model name.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {isLoading ? (
          <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
        ) : error ? (
          <p className='text-destructive text-sm'>
            {t('Failed to load model list')}
          </p>
        ) : modelNames.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t('No models configured yet. Add a channel model first.')}
          </p>
        ) : (
          <>
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50 text-left'>
                  <tr>
                    <th className='px-3 py-2 font-medium'>{t('Model')}</th>
                    <th className='w-40 px-3 py-2 font-medium'>
                      {t('Model type')}
                    </th>
                    <th className='w-32 px-3 py-2 font-medium'>
                      {t('Auto detected')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modelNames.map((name) => (
                    <tr className='border-t' key={name}>
                      <td className='px-3 py-2 font-mono text-xs break-all'>
                        {name}
                      </td>
                      <td className='px-3 py-2'>
                        <NativeSelect
                          aria-label={`${name} type`}
                          className='w-full'
                          onChange={(event) => {
                            const next = event.target.value
                            setDraft((prev) => {
                              const merged = { ...prev }
                              if (!next) delete merged[name]
                              else merged[name] = next
                              return merged
                            })
                          }}
                          value={draft[name] ?? ''}
                        >
                          {MODEL_TYPES.map((type) => (
                            <NativeSelectOption
                              key={type.value || 'auto'}
                              value={type.value}
                            >
                              {type.value
                                ? `${t(type.labelKey)}（${type.fallback}）`
                                : `${t(type.labelKey)}（${type.fallback}）`}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </td>
                      <td className='text-muted-foreground px-3 py-2 text-xs'>
                        {AUTO_LABEL[suggested[name]] ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className='flex items-center gap-2'>
              <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? t('Saving...') : t('Save')}
              </Button>
              <Button
                disabled={reset.isPending || Object.keys(saved).length === 0}
                onClick={() => reset.mutate()}
                variant='outline'
              >
                {t('Clear all overrides')}
              </Button>
              <span className='text-muted-foreground text-xs'>
                {t(
                  'Only explicitly chosen rows are stored; Auto rows keep following the name-based inference.'
                )}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** 去掉空值，保证比较与提交口径一致 */
function normalize(map: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(map)) {
    if (value) result[key] = value
  }
  return result
}
