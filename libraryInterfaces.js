"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = void 0;
var ACTION_TYPES;
(function (ACTION_TYPES) {
    ACTION_TYPES[ACTION_TYPES["STAGE"] = 1] = "STAGE";
    ACTION_TYPES[ACTION_TYPES["END"] = 2] = "END";
    ACTION_TYPES[ACTION_TYPES["REACTION"] = 3] = "REACTION";
    ACTION_TYPES[ACTION_TYPES["MOVING"] = 4] = "MOVING";
    ACTION_TYPES[ACTION_TYPES["ROTATING"] = 5] = "ROTATING";
})(ACTION_TYPES || (ACTION_TYPES = {}));
class Entity {
}
exports.Entity = Entity;
