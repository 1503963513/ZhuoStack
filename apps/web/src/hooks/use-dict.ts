'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dictControllerFindByCode } from '@/api/generated/endpoints/系统-字典管理/系统-字典管理';
import type { DictDataItemDto } from '@/api/generated/models';

/**
 * 字典数据 Hook
 * 根据字典编码获取字典数据列表
 */
export function useDict(code: string) {
  const { data: response, isLoading } = useQuery({
    queryKey: ['dict', code],
    queryFn: () => dictControllerFindByCode(code),
    enabled: !!code,
  });

  const dictData = useMemo(() => {
    const list = (response?.data?.dictData as DictDataItemDto[] | undefined) || [];
    return list.filter((d) => d.status === 'ACTIVE');
  }, [response]);

  /** 根据 value 获取 label */
  const getLabel = (value: string): string => {
    const item = dictData.find((d) => d.value === value);
    return item?.label || value;
  };

  /** 获取 value -> label 的映射 */
  const labelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of dictData) {
      map[item.value] = item.label;
    }
    return map;
  }, [dictData]);

  return { dictData, getLabel, labelMap, isLoading };
}
