/*
 * Copyright (c) Jan Sohn.
 * All rights reserved.
 * I don't want anyone to use my source code without permission.
 */

const Discord = require("discord.js");
const fs = require("fs");
const db = require("./db.js");

db.checkTables();

global.done = true;
global.hour = -1;
global.config = require("./config.json");

global.Cache = {};
global.Cache.get = function () {
	if (!fs.existsSync("./cache.json")) {
		fs.writeFileSync("./cache.json", "{\n}");
	}
	return JSON.parse(fs.readFileSync("./cache.json").toString());
};
global.Cache.set = function (key, value) {
	if (!fs.existsSync("./cache.json")) {
		fs.writeFileSync("./cache.json", "{\n}");
	}
	let cache = JSON.parse(fs.readFileSync("./cache.json").toString());
	cache[ key ] = value;
	fs.writeFileSync("./cache.json", JSON.stringify(cache, null, 4));
};
global.Cache.remove = function (key) {
	if (!fs.existsSync("./cache.json")) {
		fs.writeFileSync("./cache.json", "{\n}");
	}
	let cache = JSON.parse(fs.readFileSync("./cache.json").toString());
	if (cache[ key ]) {
		delete cache[ key ];
	}
	fs.writeFileSync("./cache.json", JSON.stringify(cache, null, 4));
};

const bot = new Discord.Client({intents: Discord.Intents.FLAGS.GUILD_MESSAGES | Discord.Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS | Discord.Intents.FLAGS.GUILDS});

bot.on("ready", async () => {
	global.GUILD_NOT_FOUND_MESSAGE = "[ERROR] Discord server not found, invite me here https://discord.com/oauth2/authorize?client_id=" + bot.user.id + "&permissions=1073741824&scope=bot&guild_id=" + config.guild_id;
	console.log("Logged in as " + bot.user.tag);

	let guild = await bot.guilds.fetch(config.guild_id);
	if (!guild) {
		console.error(GUILD_NOT_FOUND_MESSAGE);
	} else {
		await checkEmojis(guild);
		setInterval(async () => {
			await checkStatus();
		}, 1000 * config.refresh_seconds);
		await checkStatus();
	}
});

bot.on("messageCreate", async (message) => {
	if (message.channel.name === "status" && message.author.id !== bot.user.id) {
		await message.delete();
	}
});

bot.on("guildCreate", async (guild) => {
	if (guild.id !== config.guild_id) {
		await guild.leave();
	}
});

async function checkStatus() {
	let guild = bot.guilds.cache.get(config.guild_id);
	if (guild) {
		let channel = guild.channels.cache.filter(channel => channel.name === "status").first();
		if (channel) {
			await sendStatusMessage(channel);
		} else {
			console.error("[ERROR] Channel 'status' not found at " + guild.name);
		}
	} else {
		console.error(GUILD_NOT_FOUND_MESSAGE);
	}
}

async function checkEmojis(guild) {
	if (guild.emojis) {
		for (let file of fs.readdirSync("./emojis/")) {
			if (file.endsWith(".png") && !guild.emojis.cache.find(emoji => emoji.name === file.replace(".png", ""))) {
				await guild.emojis.create("./emojis/" + file, file.replace(".png", ""), {reason: "Status bot need this emoji."});
			}
		}
	}
}

/**
 * @param {Discord.TextChannel} channel
 */
async function sendStatusMessage(channel) {
	if (!done) {
		return;
	}
	await checkEmojis(channel.guild);

	let embed = new Discord.MessageEmbed();
	let color = "GREEN";
	let contents = "";

	for (let name in config.sites) {
		let started = (Date.now() % 1000) / 1000;
		let link = config.sites[ name ];
		let emoji;
		try {
			await (require("superagent")).get(link).timeout(10000);
			emoji = channel.guild.emojis.cache.filter(emoji => emoji.name === "status_online").first();
		} catch (e) {
			emoji = channel.guild.emojis.cache.filter(emoji => emoji.name === "status_offline").first();
			console.error(e.message);
		} finally {
			let ping = Math.abs(((Date.now() % 1000) / 1000) - started).toFixed(4);
			if (ping >= 5.0) {
				emoji = channel.guild.emojis.cache.filter(emoji => emoji.name === "status_slow").first();
			}
			let uptime = db.get(link);
			if (!uptime) {
				uptime = {};
			}
			let online = 0, offline = 0;
			for (let key in uptime) {
				if (uptime[ key ][ "status" ] === 0) {
					online++;
				} else {
					offline++;
				}
			}
			if (offline === 0) {
				uptime = 100;
			} else {
				uptime = (offline / online * 100).toFixed(1);
			}
			uptime = " - " + ((!isNaN(uptime) ? uptime : 100) + "% uptime");
			ping = (emoji.name !== "status_offline" ? "  -  `" + ping + "ms`" : "");
			contents += emoji.toString() + " " + name + ping + uptime + "\n";
			db.add(link, emoji.name !== "status_offline");

			if (emoji.name === "status_offline") {
				color = "RED";
			} else if (emoji.name === "status_slow" && color !== "RED") {
				color = "YELLOW";
			}
		}
	}
	embed.setDescription(contents);
	embed.setTitle("Status");
	embed.setColor(color);
	embed.setTimestamp(new Date());
	embed.setFooter({text: "Last check"});
	embed.setAuthor({
		name: channel.guild.name,
		url: "https://cosmetic-x.de",
		iconURL: channel.guild.iconURL({size: 512}),
	});

	let message_id = Cache.get()[ "message_id" ];
	let message;
	if (!message_id) {
		message = await channel.send({embeds: [ embed ]});
		Cache.set("message_id", message.id);
	} else {
		message = await channel.messages.fetch(message_id).catch((e) => message = undefined);
		if (!message) {
			message = await channel.send({embeds: [ embed ]});
			Cache.set("message_id", message.id);
		} else {
			await message.edit({embeds: [ embed ]});
		}
	}
	done = true;
}

bot.login(fs.readFileSync("./TOKEN.txt").toString());