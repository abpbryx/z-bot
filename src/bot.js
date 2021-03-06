var checkAnagram = require("./anagram.js")
const R = require("ramda");
const Encounters = require('./pk/cmd.js');
const request = require("request-promise");
const cheerio = require("cheerio");
const fs = require("fs");

module.exports = (function () {
	var client = null;
	var token = null;
	var cmdtoken = null;
	var name = "z-bot";

	var wildmagicTable = [];

	var commands = {
		"roll": function(param) {
			var reg = /(\d+)?d(\d+)?(([\+\-\*])(\d+))?/;
			var regresult = reg.exec(param.trim());
			if (regresult) {
				var rec = R.tail(regresult);
				var cnt = rec[0] || 1;
				var dice = rec[1] || 6;
				var genRoll = (dice) => Math.floor(Math.random() * (dice) + 1);
				var rolls = R.map(genRoll, R.repeat(dice, cnt));
				var sum = R.sum(rolls);
				var rollresult = rolls.toString();
				
				var op = rec[3];
				if (op) {
					var val = parseInt(rec[4]);

					switch (op) {
						case "+":
							sum = sum + val; break;
						case "*":
							sum = sum * val; break;
						case "-":
							sum = sum - val; break;
					}

					return Promise.resolve({
						message: `**Roll result**: [${rollresult}] ${param.trim()} = ${sum}`
					});
				}
				
				return Promise.resolve({ 
					message: `**Roll result**: [${rollresult}] sum = ${sum}`
				});
			}

			return Promise.resolve({ error: "Invalid dice (try <number>?d<number>?([+-*]<number>)?)" });
		},
		"pk": Encounters.doCmd,
		// "politics": function(cl) {
		// 	return request({
		// 		uri: "https://api.whatdoestrumpthink.com/api/v1/quotes/random",
		// 		json: true
		// 	})
		// },
		"meow": function(cl) {
			return request("http://random.cat")
				.then((body) => {
					let $ = cheerio.load(body);
					var el = $("#cat");
					// console.info(el);
					var url = el.attr("src");

					// console.info("meow site: " + url);
					return {
						message: "meow",
						url: url
					};
				});
		},
		"uwu": function(msg) {
			return Promise.resolve({
				message: R.map(function(x) {
					if (x == "l") return "w"
					if (x == "L") return "W";
					if (x == "r") return "w";
					if (x == "R") return "W";
					return x;
				}, msg.split("")).join("") + " uwu"
			});
		},
		"mud": (msg) => {
			return Promise.resolve({
				message: "kip"
			})
		},
		"wildmagic": (msg) => {
			return Promise.resolve({
				message: wildmagicTable[Math.floor(Math.random() * wildmagicTable.length)]
			});
		}
	};

	return {
		setDiscordClient: function(cl) {
			client = cl;
		},
		setToken: function(tk) {
			token = tk;
		},
		connect: function() {
			client.on('ready', () => {
				client.user.setUsername(name);
			});

			console.info("Reading wild magic table");
			var txt = fs.readFileSync("data/wildmagic.csv").toString("utf-8");
			wildmagicTable = txt.split("\n");

			client.login(token)
			.then(()=>{ console.info("Connected") })
			.catch(()=>{ console.error("Couldn't login with provided token: " + token) });
		},
		setCommandToken: function(tk) {
			cmdtoken = tk;
		},
		setName: function(nm) {
			name = nm;
		},
		dispatch: function(message) {
			var content = message.content;

			if (content.toLowerCase() == "thanks " + name.toLowerCase()) {
				message.reply("::)");
				return;
			}

			// not an explicit bot command
			if (content.indexOf(cmdtoken) != 0)
			{
				if (content.indexOf("->") != -1)
				{
					if (message.author.username != client.user.username) {
						checkAnagram(message);
						return;
					}
				}

				if (Encounters.isEncounterActive()) {
					var res = Encounters.matchBattleMessage(message.content);
					if (res && res.message) {
						message.reply(res.message);
						return;
					}
				}

				return;
			}

			// remove token, check format against regex
		  content = content.slice(1);
			var reg = /(\w*)\s*(.*)/;
			var res = reg.exec(content);

			//console.log(res);
			if (res) { // *match*
					var cmd = res[1].toLowerCase();
					console.info("running command " + cmd);

					if (commands.hasOwnProperty(cmd)) { // command exists
						var prom = commands[cmd](res[2]);
						
						prom.then((msg) => {
								if (msg.message) // got message
								{
									if (!msg.url)
										message.reply(msg.message);
									else 
									{
										message.reply(msg.message, {
											files: [
												{ attachment: msg.url }
											]});
									}
								}
						}).catch((msg) => {
							message.reply("*Error:* " + msg);	
						});
						
					} else { // command not found
						var revmsg = content.split("").reverse().join("");
						if (content.length % 2 == 1) // is even... counting cmd token
							revmsg = revmsg.substring(1);
						message.reply(content + revmsg); 
					}
			}
		}
	}
})();
