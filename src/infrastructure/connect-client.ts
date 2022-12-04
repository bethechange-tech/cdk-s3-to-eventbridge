export default interface ConnectClient<C> {
  readonly connection: C;
  query<T>(url: string): Promise<T>;
}
