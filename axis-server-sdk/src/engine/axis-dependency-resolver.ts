export interface AxisDependencyResolver {
  resolve<T = unknown>(token: string | Function): T | undefined;
}
