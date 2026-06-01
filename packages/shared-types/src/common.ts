/** Pagination query parameters */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

/** Paginated result wrapper */
export interface PaginationResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
