// Utilidad para respuestas exitosas
export const successResponse = (data: any, message = 'Éxito') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

// Utilidad para respuestas de error
export const errorResponse = (message: string, code = 500) => ({
  success: false,
  message,
  code,
  timestamp: new Date().toISOString(),
});

// Utilidad para listas paginadas (futuro)
export const paginatedResponse = (items: any[], total: number, page: number, limit: number) => ({
  success: true,
  data: items,
  pagination: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  },
  timestamp: new Date().toISOString(),
});