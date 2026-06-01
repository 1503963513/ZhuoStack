/** Standard API response wrapper */
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

/** Paginated API response */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
