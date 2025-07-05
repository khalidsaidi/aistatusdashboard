"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
function log(level, message, data) {
    const logData = Object.assign({ timestamp: new Date().toISOString(), level,
        message }, data);
    console.log(JSON.stringify(logData));
}
exports.log = log;
//# sourceMappingURL=logger.js.map