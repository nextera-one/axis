export type JSONValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | object
  | object
  | { [key: string]: JSONValue }
  | { [key: string]: JSONValue }[]
  | JSONValue[]
  | Record<
      string,
      | string
      | number
      | boolean
      | null
      | undefined
      | Date
      | object
      | object
      | { [key: string]: JSONValue }
      | { [key: string]: JSONValue }[]
    >
  | Record<
      string,
      | string
      | number
      | boolean
      | null
      | undefined
      | Date
      | object
      | object
      | { [key: string]: JSONValue }
      | { [key: string]: JSONValue }[]
    >[];

export default interface DataObject {
  [key: string]: JSONValue;
}
