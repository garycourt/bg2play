"use strict";
function promisify(f) {
    return function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return new Promise(function (resolve, reject) {
            args.push(function (err, result) { return err !== undefined && err !== null ? reject(err) : resolve(result); });
            f.apply(_this, args);
        });
    };
}
exports.promisify = promisify;
