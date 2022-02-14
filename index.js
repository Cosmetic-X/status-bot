const Discord = require("discord.js");
const fs = require("fs");

global.done = true;
global.config = require("./config.json");

global.Cache = {};
global.Cache.get = function () {
	return JSON.parse(fs.readFileSync("./cache.json").toString());
};
global.Cache.set = function (key, value) {
	let cache = JSON.parse(fs.readFileSync("./cache.json").toString());
	cache[ key ] = value;
	fs.writeFileSync("./cache.json", JSON.stringify(cache));
};
global.Cache.remove = function (key, value) {
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
		}, 1000 * 60);
		await checkStatus();
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
	embed.setTitle("Status");
	embed.setColor("PURPLE");
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
			contents += emoji.toString() + " " + name + "  -  `" + ping + "ms`" + "\n";
		}
	}
	embed.setDescription(contents);

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