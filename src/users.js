module.exports = (function() {
    "use strict";

    return function(robot) {

        robot.respond(/foo/i, function(msg) {
            msg.reply("bar");
        });

    };
}).call(this);
