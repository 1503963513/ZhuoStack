'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { get, post, put, del } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';

/**
 * Generic query hook for GET requests
 */
export function useApiQuery<T>(
  key: string[],
  url: string,
  options?: Omit<
    UseQueryOptions<ApiResponse<T>, Error>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<ApiResponse<T>, Error>({
    queryKey: key,
    queryFn: () => get<T>(url),
    ...options,
  });
}

/**
 * Generic mutation hook for POST/PUT/DELETE requests
 */
export function useApiMutation<T>(
  method: 'post' | 'put' | 'delete',
  url: string,
  options?: Omit<
    UseMutationOptions<ApiResponse<T>, Error, unknown>,
    'mutationFn'
  > & { invalidateKeys?: string[][] },
) {
  const queryClient = useQueryClient();

  const mutationFn = (data: unknown) => {
    switch (method) {
      case 'post':
        return post<T>(url, data);
      case 'put':
        return put<T>(url, data);
      case 'delete':
        return del<T>(url);
    }
  };

  return useMutation<ApiResponse<T>, Error, unknown>({
    mutationFn,
    onSuccess: (...args) => {
      // Invalidate specified query keys after mutation
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}
