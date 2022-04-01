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
	global.GUILD_NOT_FOUND_MESSAGE = "[ERROR] Discord server not found, invite me here https://discord.com/oauth2/authorize?client_id=" + bot.user.id + "&permissions=1073741824&scope=applications.commands%20bot&guild_id=" + config.guild_id;
	console.log("Logged in as " + bot.user.tag);
	bot.user.setActivity({name: "Status of Cosmetic-X sites", url: "https://cosmetic-x.de", type: "WATCHING"});

	await registerSlashCommands();

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

bot.on("interactionCreate", /** @param {Discord.CommandInteraction} interaction */ async (interaction) => {
	if (!interaction.isCommand()) {
		return;
	}
	if (interaction.commandName === "reset-uptime") {
		let hasPermission = false;
		for (let roleId of config[ "clear-uptime-roles-allowed" ]) {
			if (!hasPermission) {
				hasPermission = interaction.member.roles.cache.has(roleId);
			}
		}
		if (!hasPermission) {
			await interaction.reply({content: "You don't have the permission to use that command!", ephemeral: true});
		} else {
			db.clear();
			await checkStatus();
			await interaction.reply({content: "Cache cleared successfully!", ephemeral: true});
		}
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
	let contents = [];

	for (let name in config.sites) {
		let started = (Date.now() % 1000) / 1000;
		let link = config.sites[ name ];
		let emoji;
		try {
			await (require("superagent")).get(link).timeout(10000);
			emoji = channel.guild.emojis.cache.filter(emoji => emoji.name === "status_online").first();
		} catch (e) {
			emoji = channel.guild.emojis.cache.filter(emoji => emoji.name === "status_offline").first();
			console.error("[" + link + "]: " + e.message);
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
				uptime = (100 - (offline / online * 100)).toFixed(1);
			}
			uptime = " - " + ((!isNaN(uptime) ? uptime : 100) + "% uptime");
			ping = (emoji.name !== "status_offline" ? "  -  `" + ping + "ms`" : "");
			contents[ contents.length ] = emoji.toString() + " " + name + ping + uptime + "\n";
			db.add(link, emoji.name !== "status_offline");

			if (emoji.name === "status_offline") {
				color = "RED";
			} else if (emoji.name === "status_unknown") {
				color = "GRAY";
			} else if (emoji.name === "status_slow" && color !== "RED") {
				color = "YELLOW";
			}
		}
	}
	embed.setDescription(contents.join("\n") + "\n");
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

async function registerSlashCommands() {
	const DiscordBuilders = require("@discordjs/builders");
	const {Routes} = require('discord-api-types/v9');
	const {REST} = require("@discordjs/rest");
	const restClient = new REST({version: "9"}).setToken(fs.readFileSync("./TOKEN.txt").toString());

	let resetUptimeSlashCommand = new DiscordBuilders.SlashCommandBuilder();
	resetUptimeSlashCommand.setName("reset-uptime");
	resetUptimeSlashCommand.setDescription("Reset uptime percentage from status sites.");

	restClient.put(Routes.applicationGuildCommands(bot.user.id, config.guild_id), {body: [ resetUptimeSlashCommand.toJSON() ]}).catch(console.error);
}

bot.login(fs.readFileSync("./TOKEN.txt").toString());