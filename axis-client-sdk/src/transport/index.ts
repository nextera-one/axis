import { decodeFrame, encodeFrame, AxisFrame } from '../core/axis-bin';

export interface AxisTransport {
  send(frame: AxisFrame): Promise<AxisFrame>;
}

export class HttpTransport implements AxisTransport {
  constructor(private readonly endpoint: string, private readonly options: RequestInit = {}) {}

  async send(frame: AxisFrame): Promise<AxisFrame> {
    const reqBytes = encodeFrame(frame);

    const res = await fetch(this.endpoint, {
      method: 'POST',
      ...this.options,
      headers: {
        'Content-Type': 'application/axis-bin',
        ...this.options.headers,
      },
      body: reqBytes as any,
    });

    if (!res.ok) {
      throw new Error(`Axis HTTP Error: ${res.status} ${res.statusText}`);
    }

    const resBuf = await res.arrayBuffer();
    return decodeFrame(new Uint8Array(resBuf));
  }
}
