'use client';

import { useMemo } from 'react';
import { useApiQuery } from '@/hooks/use-api';

interface DictData {
  id: string;
  dictId: string;
  label: string;
  value: string;
  sort: number;
  status: string;
}

interface DictResponse {
  id: string;
  name: string;
  code: string;
  dictData: DictData[];
}

/**
 * 字典数据 Hook
 * 根据字典编码获取字典数据列表
 */
export function useDict(code: string) {
  const { data, isLoading } = useApiQuery<DictResponse>(
    ['dict', code],
    `/api/system/dict/code/${code}`,
  );

  const dictData = useMemo(() => {
    return data?.data?.dictData?.filter((d) => d.status === 'ACTIVE') || [];
  }, [data]);

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
