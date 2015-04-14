/**
 *
 */

(function() {
    "use strict";

    var assert = require("assert"),
        sinon  = require("sinon");

    suite("Auth", function() {
        var robot = {}

        setup(function() {
            robot = {
                respond: sinon.spy(),
                hear: sinon.spy()
            };

            require("../src/users")(robot);
        });

        teardown(function() {
            robot.respond.restore();
            robot.hear.restore();
        });

        test("registers a response listener", function() {
            assert(robot.respond.called);
        });

    });

})();
