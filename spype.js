Skyweb = require('skyweb');
DiscordClient = require('discord.io');

var util = require("util");
var toMarkdown = require('to-markdown');
var skyweb = new Skyweb();
var fs = require('fs');
var config = JSON.parse(fs.readFileSync("config.json"));
var markdown = require("markdown").markdown;

var discord = new DiscordClient({
    autorun: true,
    email: config.discord_email,
    password: config.discord_password
});

var sendSkypeMessage = function(pipe, message, sender)
{
	var skypeMessage = "";

	//if(pipe.lastSkypeSender != null)
		//skypeMessage += "\n";

	if(sender != null && sender != pipe.lastSkypeSender)
		skypeMessage += util.format("[%s]\n", sender);
	
	skypeMessage += message;
	
	skyweb.sendMessage(pipe.skypeId, skypeMessage);
	console.log("\nSKYPE (" + pipe.name + ") " + skypeMessage);
	pipe.lastSkypeSender = sender;
}

// SET UP PIPES AND SAY SO
console.log("Setting up the following pipes:");
config.pipes.forEach(function(pipe)
{
	pipe.lastSkypeSender = null;
	pipe.lastDiscordSender = null;
	console.log("* " + pipe.name);
});

var sendDiscordMessage = function(pipe, message, sender)
{
	// Convert to Markdown
	// message = toMarkdown(message);
	
	var discordMessage = "";
	
	//if(pipe.lastDiscordSender != null)
		//discordMessage += "\n";
	
	if(sender != null && sender != pipe.lastDiscordSender)
		discordMessage += util.format("**[%s]**\n", sender);

	discordMessage += message;
	
	discord.sendMessage({
		to: pipe.discordId,
		message: discordMessage,
		tts: false, //Optional
		typing: false //Optional, client will act as if typing the message. Based on message length.
	});
	console.log("\nDISCORD: (" + pipe.name + ") " + discordMessage);
	pipe.lastDiscordSender = sender;
}

skyweb.login(config.skype_username, config.skype_password).then((skypeAccount) => 
{    
	console.log("Skype connected.")
	config.pipes.forEach(function(pipe)
	{
		sendSkypeMessage(pipe, "Reconnected", "SPYPE");
	});
});

discord.on('ready', function() {
    console.log("Discord connected.")
	config.pipes.forEach(function(pipe)
	{
		sendDiscordMessage(pipe, "Reconnected", "SPYPE");
	});
});

skyweb.messagesCallback = function (messages)
{
    messages.forEach(function (message) 
	{
		if(message.resource.from.indexOf(config.skype_username) === -1 && message.resource.messagetype !== 'Control/Typing' && message.resource.messagetype !== 'Control/ClearTyping')
		{
			var conversationLink = message.resource.conversationLink;
			var conversationId = conversationLink.substring(conversationLink.lastIndexOf('/') + 1);
			config.pipes.forEach(function(pipe)
			{
				if(conversationId == pipe.skypeId)
				{
					// Skype message received, clear lastSkypeSender
					pipe.lastSkypeSender = null;
					// Send to Discord
					sendDiscordMessage(pipe, message.resource.content, message.resource.imdisplayname);
				}
			});
        }
    });
};
 
discord.on('message', function(user, userID, channelID, message, rawEvent) {
	if(user != config.discord_username)
	{
		config.pipes.forEach(function(pipe)
		{
			if(channelID == pipe.discordId)
			{
				// Discord message received, clear lastDiscordSender
				pipe.lastDiscordSender = null;
				// Send to Skype
				sendSkypeMessage(pipe, message, user);
			}
		});
	}
});


var sendDisconnectedMessages = function()
{
	config.pipes.forEach(function(pipe)
	{
		sendSkypeMessage(pipe, "Disconnected", "SPYPE");
		sendDiscordMessage(pipe, "Disconnected", "SPYPE");
	});
}

function exitHandler(options, err)
{
    try
	{
		if(options.sendDisconnect)
		{
			sendDisconnectedMessages();
		}
	}
	finally
	{
		if (err) console.log(err.stack);
		process.exit();
	}
}

if(process.platform === "win32")
{
	var rl = require("readline").createInterface({
		input: process.stdin,
		output: process.stdout
	});

	rl.on("SIGINT", function () {
		process.emit("SIGINT");
	});
}

//do something when app is closing
process.on('SIGHUP', function()
{
	console.log("SIGHUP");
	config.pipes.forEach(function(pipe)
	{
		sendSkypeMessage(pipe, "SIGHUP", "SPYPE");
		sendDiscordMessage(pipe, "SIGHUP", "SPYPE");
	});
});

//do something when app is closing
process.on('exit', exitHandler.bind(null,{sendDisconnect:true, exit:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {sendDisconnect:true, exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
