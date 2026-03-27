export type Position = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type EntityData = {
  name: string;
  info: {
    huntingZoneId: number;
    templateId: number;
  };
  relation: number;
  huntingZoneId: number;
  templateId: number;
  gameId: bigint;
  visible: boolean;
  loc: Position;
  job: number;
  race: number;
  pos: Position;
};

enum ACTION_TYPES {
  STAGE = 1,
  END = 2,
  REACTION = 3,
  MOVING = 4,
  ROTATING = 5,
}

export abstract class Entity {
  abstract isPlayer: boolean;
  abstract isMob: boolean;
  abstract name: string;
  abstract huntingZoneId: number;
  abstract templateId: number;
  abstract gameId: bigint;
  abstract relation: number;
  abstract visible: boolean;
  abstract runSpeed: number;
  abstract walkSpeed: number;
  abstract job: number;
  abstract race: number;
  abstract getLocation(): Position;
  abstract getDirection(): number;
  abstract updateLocation(e: unknown): void;
  abstract updateDirection(e: unknown): void;
  abstract updateAction(e: unknown, actionType: ACTION_TYPES): void;
}

export interface EntityManager {
  entityClass: typeof Entity;
  entities: Entity[];
  getLocationForThisEntity(id: bigint): Position;
  getLocationForPlayer(id: bigint): Position;
  getLocationForMob(id: bigint): Position;
  getLocationForNpc(id: bigint): Position;
  isNearEntity(
    pos: Position,
    playerRadius: number,
    entityRadius: number,
  ): boolean;
  isNearPlayer(
    pos: Position,
    playerRadius: number,
    entityRadius: number,
  ): boolean;
  isNearBoss(
    pos: Position,
    playerRadius: number,
    entityRadius: number,
  ): boolean;
  getEntityData(id: bigint): EntityData;
  getEntitiesData(huntingZoneId: number, templateId: number): EntityData[];
  getSettingsForEntity(id: bigint, object: unknown): unknown;
}

export interface Player {}
export interface Effect {}
export interface Packet {}
export interface Library {}

export interface LibraryIndex {
  packet: Packet;
  library: Library;
  entity: EntityManager;
  player: Player;
  effect: Effect;
}
