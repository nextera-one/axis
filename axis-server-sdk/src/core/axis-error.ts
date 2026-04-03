export class AxisError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number = 400,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AxisError';
  }
}
