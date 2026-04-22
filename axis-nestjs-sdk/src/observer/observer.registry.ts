import { Injectable } from "@nestjs/common";
import { ObserverRegistry as CoreObserverRegistry } from "@nextera.one/axis-server-sdk";

@Injectable()
export class ObserverRegistry extends CoreObserverRegistry {}
