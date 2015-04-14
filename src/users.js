// Description:
//   Reimplementation of the 'hubot-auth' module. Assign and restrict
//   command access in other scripts, including third party scripts.
//
// Configuration:
//   HUBOT_AUTH_OWNER - A comma seperated list of user IDs.
//   HUBOT_AUTH_ADMIN - A comma seperated list of user IDs.
//
// Commands:
//   hubot <user> has <role> role - Assigns the <role> to <user>.
//   hubot <user> doesn't have <role> role - Removes the <role> from <user>.
//   hubot what roles does <user> have? - Returns a list of roles <user> belongs to.
//   hubot what roles do I have? - Returns a list of roles you have.
//   hubot who has <role> role? - Returns all the users that belong to <role> role.
//
// Notes:
//   * Has roughly the same API as 'hubot-auth'.
//   * the 'owner' role can be assumed to be what 'admin' was in 'hubot-auth'
//   * the 'owner' role can only be assigned through the environment variable
//   * the "admin" role is assignable at runtime. It's basically another
//     generic role, but it is treated specially. Only 'owner's and 'admin's
//     are allowed to operate hubot.
//

module.exports = (function() {
    "use strict";

    var Auth = (function() {
        var _robot;

        function Auth(robot) {
            var listener, matcher;
            _robot = robot;
            this.logger = robot.logger;
            this.users = robot.brain.users();

            // This is where we swap out all existing listener matcher
            // functions with matchers that check to see if the user is an
            // owner (kinda like a superuser) or an admin (like a regular
            // user, but can operate hubot). normal users cannot operate
            // hubot.
            for (var i = 0; i < _robot.listeners.length; i++) {
                listener = _robot.listeners[i];

                listener.matcher = (function(that) {
                    return function(message) {
                        if (_robot.auth.isAdmin(message.user) || _robot.auth.isOwner(message.user)) {
                            return that.call(listener, message);
                        }
                        return false;
                    };
                })(listener.matcher);

            }


            if (process.env.HUBOT_AUTH_OWNER != null) {
                this.owners = process.env.HUBOT_AUTH_OWNER.split(',');
            } else {
                this.logger.warning("The HUBOT_AUTH_OWNER environment variable not set.");
                this.owners = [];
            }

            if (process.env.HUBOT_AUTH_ADMIN != null) {
                this.admins = process.env.HUBOT_AUTH_ADMIN.split(',');
            } else {
                this.admins = [];
            }

        };

        Auth.prototype.isOwner = function(user) {
            return (this.owners.indexOf(user.id.toString()) >= 0);
        };

        Auth.prototype.isAdmin = function(user) {
            return (this.admins.indexOf(user.id.toString()) >= 0);
        };

        Auth.prototype.hasRole = function(user, roles) {
            var userRoles = this.userRoles(user),
                roles = [].concat(roles);

            if (userRoles != null) {
                return (roles.filter(function(role) {
                    return userRoles.indexOf(role) >= 0;
                }).length > 0);
            }
            return false;
        };

        Auth.prototype.usersWithRole = function(role) {
            var users = [], prop, user,
                hasOwnProperty = Object.prototype.hasOwnProperty;
            for (prop in this.users) {
                if (this.users.hasOwnProperty(prop)) {
                    user = this.users[prop];
                    if (this.hasRole(user, role)) {
                        users.push(user.name)
                    }
                }
            }

            return users;
        };

        Auth.prototype.userRoles = function(user) {
            var roles = [];
            if (user != null) {
                if (this.isOwner(user)) {
                    roles.push('owner');
                }
                if (user.roles != null) {
                    roles = roles.concat(user.roles);
                }
            }

            return roles;
        };

        return Auth;
    })();

    return function(robot) {
        if (robot.auth !== undefined) {
            robot.logger.warning("The robot.auth variable has already been defined.",
                                 "This is probably because you have already loaded the 'hubot-auth' package.",
                                 "'hubot-users' is supposed to be a replacement of that package.",
                                 "Please fix your dependencies by removing us or them.");
            return;
        }
        robot.brain.on("loaded", function() {
            robot.auth = new Auth(robot);
        });

        robot.respond(/@?((.+)\s?[^do(n't|esn't|es not)]) ha(?:s|ve) (["'\w: -_]+) role/i, function(msg) {
            var name, newRole, user;
            if (!robot.auth.isOwner(msg.message.user) || !robot.auth.isAdmin(msg.message.user)) {
                return msg.reply("Sorry, only owners and admins can assign roles.");
            } else {
                name = msg.match[1].trim();
                if (name.toLowerCase() === 'i') {
                    name = msg.message.user.name;
                }
                newRole = msg.match[3].trim().toLowerCase();
                if (newRole === 'owner') {
                    return msg.reply("Sorry, the 'owner' role can only be defined in the HUBOT_AUTH_OWNER env variable.");
                }
                if (['', 'who', 'what', 'where', 'when', 'why'].filter(function(questionWord, idx) { return name.toLowerCase() === questionWord; }).length == 0) {
                    user = robot.brain.userForName(name);
                    if (user == null) {
                        return msg.reply(name + " does not exist.");
                    }
                    user.roles || (user.roles = []);
                    if (user.roles.indexOf(newRole) >= 0) {
                        return msg.reply(name + " already has the '" + newRole + "' role.");
                    } else {
                        user.roles.push(newRole);
                        return msg.reply("OK, " + name + " now has the '" + newRole + "' role.");
                    }
                }
            }
        });

        robot.respond(/@?(.*) do(?:n't|esn't|es not) ha(?:s|ve) (["'\w: -_]+) role/i, function(msg) {
            var name, oldRole, user;
            if (!robot.auth.isOwner(msg.message.user) || !robot.auth.isAdmin(msg.message.user)) {
                return msg.reply("Sorry, only owners and admins can remove roles.");
            } else {
                name = msg.match[1].trim();
                if (name.toLowerCase() === 'i') {
                    name = msg.message.user.name;
                }
                oldRole = msg.match[2].trim().toLowerCase();
                if (oldRole === 'owner') {
                    return msg.reply("Sorry, the 'owner' role can only be removed from the HUBOT_AUTH_OWNER env variable.");
                }
                if (['', 'who', 'what', 'where', 'when', 'why'].filter(function(questionWord, idx) { return name.toLowerCase() === questionWord; }).length == 0) {
                    user = robot.brain.userForName(name);
                    if (user == null) {
                        return msg.reply(name + " does not exist.");
                    }
                    user.roles = (user.roles || []).filter(function(role,idx) {
                        return role !== oldRole;
                    });
                    msg.reply("OK, " + name + " doesn't have the '" + oldRole + "' role.");
                }
            }
        });

        robot.respond(/what roles? do(es)? @?(.+) have\?*$/i, function(msg) {
            var name, user, roles;
            name = msg.match[2].trim();
            if (name.toLowerCase() === 'i') {
                name = msg.message.user.name;
            }
            user = robot.brain.userForName(name);
            if (user == null) {
                return msg.reply(name + " does not exist");
            }
            roles = robot.auth.userRoles(user);
            if (roles.length === 0) {
                msg.reply(name + " does not have any roles");
            } else {
                msg.reply(name + " has the following roles: " + roles.join(", ") + ".");
            }
        });

        robot.respond(/who has (["'\w: -_]+) role\?*$/i, function(msg) {
            var role = (msg.match[1] || "").trim(),
                users = [];

            if (role.length > 0) {
                users = robot.auth.usersWithRole(role);

                if (users.length > 0) {
                    msg.reply("The following users have the '" + role + "' role: " + users.join(", "));
                } else {
                    msg.reply("There are no users that have the '" + role + "' role.");
                }
            }
        });

    };
}).call(this);
