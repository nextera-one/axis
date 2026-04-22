// HTTP helpers
export { AxisMediaTypes } from "./http/media-types";
export {
  wasRequestAborted,
  wasResponseClosedEarly,
} from "./http/request-lifecycle";
export type {
  RequestLifecycleLike,
  ResponseLifecycleLike,
} from "./http/request-lifecycle";

// DTO primitives
export type { PageResult } from "./dto/page-result";
export { AxisPageDto } from "./dto/axis-page.dto";

// Observation
export { ObservationStore } from "./observation/observation.store";

// Engine adapter
export { AXIS_REQUEST_ENGINE } from "./engine/axis-request.interface";
export type {
  AxisDecodedResult,
  AxisEngineResult,
  AxisProcessExtra,
  IAxisRequestEngine,
} from "./engine/axis-request.interface";
export { IntentRouter } from "./engine/intent.router";
export { AxisDecodeInterceptor } from "./engine/axis-decode.interceptor";
export { AxisIngressMiddleware } from "./engine/axis-ingress.middleware";
export {
  PriorityOrder,
  priorityOrder,
  PRIORITY_ORDER_METADATA_KEY,
  getPriorityOrder,
  getPriorityOrderedTargets,
  comparePriorityOrder,
} from "./decorators/priority-order.decorator";
export type {
  AxisPriorityLevel,
  AxisPriorityLevelInput,
  PriorityOrderDefinition,
  PriorityOrderOptions,
} from "./decorators/priority-order.decorator";
export {
  applyPriorityOrderedMiddlewares,
  resolvePriorityOrderedMiddlewares,
} from "./middleware/priority-order";
export type { AxisNestMiddlewareClass } from "./middleware/priority-order";

// WebSocket gateway base
export { AxisWebSocketGatewayBase } from "./gateway/axis-websocket.gateway";

// Sensor system
export { Sensor, SENSOR_METADATA_KEY } from "./sensor/sensor.decorator";
export type { SensorOptions, SensorPhase } from "./sensor/sensor.decorator";
export { SensorRegistry } from "./sensor/sensor.registry";
export { SensorDiscoveryService } from "./sensor/sensor-discovery.service";
export { AxisSensorChainService } from "./sensor/axis-sensor-chain.service";
export type {
  ChainResult,
  SensorInput,
  SensorDecision,
} from "@nextera.one/axis-server-sdk";

// Handler system
export { Handler, HANDLER_METADATA_KEY } from "./handler/handler.decorator";
export type { HandlerOptions } from "./handler/handler.decorator";
export { HandlerDiscoveryService } from "./handler/handler-discovery.service";
export {
  AxisFilesDownloadHandler,
  AxisFilesFinalizeHandler,
} from "./handler/axis-files.handlers";

// HTTP param decorators
export {
  AxisRaw,
  AxisIp,
  AxisContext,
  AxisDemoPubkey,
  AxisFrame,
} from "./http/axis-request.decorator";
export type { AxisRequestData } from "./http/axis-request.decorator";

// Observer system
export { Observer } from "./observer/observer.decorator";
export { ObserverRegistry } from "./observer/observer.registry";
export { ObserverDispatcherService } from "./observer/observer-dispatcher.service";
export { ObserverDiscoveryService } from "./observer/observer-discovery.service";

// Crypto
export { ProofVerificationService } from "./crypto/proof-verification.service";
export type {
  ProofType,
  ProofVerificationResult,
  MTLSContext,
  DeviceSEContext,
} from "./crypto/proof-verification.service";

// Schemas
export {
  BodyProfileValidator,
  BodyProfile,
} from "./schemas/body-profile.validator";
export type { BodyProfileValidation } from "./schemas/body-profile.validator";
