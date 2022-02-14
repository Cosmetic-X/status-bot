/*
 * Copyright (c) Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */
const Database = require('better-sqlite3');
const db = new Database('./database.db');

module.exports.checkTables = function () {
	db.exec("" +
		"CREATE TABLE IF NOT EXISTS uptime (" +
		"`link` TEXT," +
		"`status` BOOLEAN," +
		"`timestamp` INTERGER NOT NULL" +
		");");
};
module.exports.get = function (link) {
	let statement = db.prepare("SELECT status FROM uptime WHERE link=?;");
	return statement.all(link);
};
module.exports.add = function (link, status) {
	let statement = db.prepare("INSERT INTO uptime (link, status, timestamp) VALUES (?, ?, ?);");
	statement.run(link, status ? 0 : 1, (new Date().getTime() / 1000));
};