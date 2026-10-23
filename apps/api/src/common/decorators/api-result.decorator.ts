import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import {
  ApiResponseDto,
  PaginatedDataDto,
  PaginationMetaDto,
  ErrorResponseDto,
} from '../dto/api-response.dto';

interface ResultOptions {
  status?: HttpStatus;
  description?: string;
  isArray?: boolean;
}

/**
 * 包装标准 API 返回：{ code: 200, message: 'success', data: T }
 */
export const ApiResultResponse = <TModel extends Type<unknown>>(
  model?: TModel,
  options?: ResultOptions,
) => {
  const status = options?.status ?? HttpStatus.OK;
  const description = options?.description ?? '请求成功';
  const isArray = options?.isArray ?? false;

  if (!model) {
    return applyDecorators(
      ApiExtraModels(ApiResponseDto),
      ApiResponse({
        status,
        description,
        schema: {
          allOf: [
            { $ref: getSchemaPath(ApiResponseDto) },
            {
              properties: {
                data: {
                  type: 'object',
                  nullable: true,
                  default: null,
                },
              },
            },
          ],
        },
      }),
    );
  }

  const dataSchema = isArray
    ? {
        type: 'array',
        items: { $ref: getSchemaPath(model) },
      }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              data: dataSchema,
            },
          },
        ],
      },
    }),
  );
};

/**
 * 包装分页返回：{ code: 200, message: 'success', data: { data: T[], pagination: PaginationMetaDto } }
 */
export const ApiPaginatedResultResponse = <TModel extends Type<unknown>>(
  model: TModel,
  options?: Omit<ResultOptions, 'isArray'>,
) => {
  const status = options?.status ?? HttpStatus.OK;
  const description = options?.description ?? '获取分页列表成功';

  return applyDecorators(
    ApiExtraModels(ApiResponseDto, PaginatedDataDto, PaginationMetaDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              data: {
                allOf: [
                  { $ref: getSchemaPath(PaginatedDataDto) },
                  {
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: getSchemaPath(model) },
                      },
                      pagination: {
                        $ref: getSchemaPath(PaginationMetaDto),
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    }),
  );
};

/**
 * 统一错误返回文档标注
 */
export const ApiErrorResponse = (status: HttpStatus, description: string) => {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status,
      description,
      type: ErrorResponseDto,
    }),
  );
};
