/**
 * AxisMediaTypes — protocol content-type constants and HTTP header helpers.
 *
 * Originally lived in the backend repo; promoted to the NestJS SDK because
 * every AXIS ingress/egress needs the same constants.
 */
export abstract class AxisMediaTypes {
  static readonly HEADER_ACCEPT = "accept";
  static readonly HEADER_CONTENT_TYPE = "content-type";

  static readonly BINARY = "application/axis-bin";
  static readonly OCTET_STREAM = "application/octet-stream";
  static readonly LEGACY_BINARY = "application/x-axis";
  static readonly JSON = "application/json";
  static readonly TEXT = "text/plain";

  static readonly VALID_AXIS_CONTENT_TYPES = [
    AxisMediaTypes.BINARY,
    AxisMediaTypes.OCTET_STREAM,
    AxisMediaTypes.LEGACY_BINARY,
  ] as const;

  static readonly CLIENT_ACCEPT = [
    AxisMediaTypes.BINARY,
    AxisMediaTypes.JSON,
    AxisMediaTypes.TEXT,
  ].join(", ");

  static normalize(value?: string | null): string | undefined {
    if (!value) return undefined;
    return value.split(";", 1)[0].trim().toLowerCase();
  }

  static matches(value: string | undefined | null, expected: string): boolean {
    return AxisMediaTypes.normalize(value) === expected;
  }

  static includes(
    header: string | string[] | undefined | null,
    expected: string,
  ): boolean {
    if (!header) return false;

    const values = Array.isArray(header) ? header : String(header).split(",");
    return values.some((value) => AxisMediaTypes.normalize(value) === expected);
  }

  static isAxisContentType(value?: string | null): boolean {
    const normalized = AxisMediaTypes.normalize(value);
    return (
      !!normalized &&
      AxisMediaTypes.VALID_AXIS_CONTENT_TYPES.some(
        (contentType) => contentType === normalized,
      )
    );
  }

  static isAxisIngressRequest(
    contentType: string | undefined | null,
    accept: string | string[] | undefined | null,
  ): boolean {
    if (typeof accept === "string" && accept.includes(",")) {
      accept = accept.split(",").map((a) => a.toLowerCase().trim());
    }
    return (
      (AxisMediaTypes.matches(contentType, AxisMediaTypes.BINARY) ||
        AxisMediaTypes.matches(contentType, AxisMediaTypes.OCTET_STREAM)) &&
      (AxisMediaTypes.includes(accept, AxisMediaTypes.JSON) ||
        AxisMediaTypes.includes(accept, AxisMediaTypes.TEXT) ||
        AxisMediaTypes.includes(accept, AxisMediaTypes.BINARY))
    );
  }

  static responseTypeFor(body: unknown): string {
    return Buffer.isBuffer(body) || body instanceof Uint8Array
      ? AxisMediaTypes.BINARY
      : AxisMediaTypes.TEXT;
  }
}
