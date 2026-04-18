export abstract class AxisMediaTypes {
  static readonly BINARY = 'application/axis-bin';
  static readonly JSON = 'application/json';
  static readonly TEXT = 'text/plain';

  static readonly CLIENT_ACCEPT = [
    AxisMediaTypes.BINARY,
    AxisMediaTypes.JSON,
    AxisMediaTypes.TEXT,
  ].join(', ');
}
