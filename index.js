const botSetting = require("./botsettings.json");
const Discord = require("discord.js");
const fs = require("fs");
const ejs = require('ejs');

const cdseconds = 5;
const prefix = botSetting.prefix

const bot = new Discord.Client({disableEveryone: true});
bot.commands = new Discord.Collection();

// lecture des commandes

fs.readdir("./cmds/", (err, files) => {
  if(err) console.log(err);

  let jsfiles = files.filter(f => f.split(".").pop() === "js");
  if(jsfiles.length <= 0){
    console.log("no commands to load !");
    return;
  }

  console.log(`loading ${jsfiles.length} commands`);

  jsfiles.forEach((f, i) => {
    let props = require(`./cmds/${f}`);
    console.log(`${i + i}: ${f} loaded !`);
    bot.commands.set(props.help.name, props);
  });
});

// ------------------------------------------------

// load du bot.
bot.on("ready", async () => {
  console.log(`Statut du bot: ${bot.user.username} est demarré`);
  console.log(bot.commands);
  bot.user.setStatus("online");
  bot.user.setActivity(botSetting.play);
});
// ------------------------------------------------

// Récuperation tableau.

bot.on("message", async message => {
  if(message.author.bot) return;
  if(message.channel.type === "dm") return;

  let messageArray = message.content.trim().split(/ +/g);
  let command = messageArray[0];
  let args = messageArray.slice(1);
  if (!command.startsWith(prefix)) return;
  let cmd = bot.commands.get(command.slice(prefix.length));
  if (cmd) cmd.run(bot, message, args);
  console.log(messageArray);
});

const retrieveAllMessages = (channel) => {
    return new Promise((resolve, reject) => {
        if (channel.type !== "text") reject('this channel is not a text channel');
        let messagesSaved = new Discord.Collection();
        let lastCountMessage = null;
        let lastMessageId = null;

        channel.messages.fetch({limit: 100}).then(async messages => {
            const fetchedCount = messages.array().length;
            const lastMessage = messages.last();
            messagesSaved = messages;
            lastCountMessage = fetchedCount;
            if (lastMessage === undefined || lastCountMessage !== 100) return resolve(messagesSaved);
            lastMessageId = lastMessage.id;

            while (lastCountMessage === 100) {
                if (lastMessageId === undefined) {
                    resolve(messages);
                    break;
                }

                const msgs = await channel.messages.fetch({limit: 100, before: lastMessageId});
                const fetchedCount = msgs.array().length;
                const lastMessage = msgs.last();
                msgs.forEach(msg => messagesSaved.set(msg.id, msg));
                lastCountMessage = fetchedCount;
                if (lastMessage === undefined || lastCountMessage !== 100) return resolve(messagesSaved);
                lastMessageId = lastMessage.id;
            }
        }).catch(reject);
    });
};

const createTicketHistory = (guild, channel, messages) => {
    function formattedDatetime(d = new Date, format) {
        let month = String(d.getMonth() + 1);
        let day = String(d.getDate());
        const year = String(d.getFullYear());

        let hours = String(d.getHours());
        let minutes = String(d.getMinutes());
        let seconds = String(d.getSeconds());

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        if (hours.length < 2) hours = '0' + hours;
        if (minutes.length < 2) minutes = '0' + minutes;
        if (seconds.length < 2) seconds = '0' + seconds;

        return format === undefined ? `${day}/${month}/${year} ${hours}:${minutes}:${seconds}` : format(day, month, year, hours, minutes, seconds);
    }

    return new Promise((resolve, reject) => {

        ejs.renderFile('ticket_template.ejs', {guild, channel, messages, formattedDatetime}, (err, str) => {
            const filename = `tickets/${channel.name}-${formattedDatetime(new Date(), (day, month, year, hours, minutes, seconds) => `${day}-${month}-${year}_${hours}-${minutes}-${seconds}`)}.html`;
            fs.writeFile(
                filename,
                str,
                (err) => {
                    if (err) return reject(err);
                    resolve(filename);
                });
        });
    });
};

const reactionAdd = async (reaction, user) => {
    if (user.bot) return;
    const message = reaction.message;

    if (
        ["📩", "🔒"].includes(reaction.emoji.name)
    ) {
        switch (reaction.emoji.name) {

            case "📩":

                reaction.users.remove(user.id);

                let categoryID = "696004149858533407";

                let bool = false;

                if (bool === true) return;

                message.guild.channels.create(`Ticket ${user.username}`, {type: 'text'}).then(
                    (createdChannel) => {
                        createdChannel.setParent(categoryID).then(
                            (settedParent) => {

                                settedParent.updateOverwrite(message.guild.roles.cache.find(r => r.name === '@everyone'), {
                                    SEND_MESSAGES: false,
                                    VIEW_CHANNEL: false,
                                    ADD_REACTIONS: false
                                });

                                settedParent.updateOverwrite(user.id, {
                                    SEND_MESSAGES: true,
                                    ADD_REACTIONS: false,
                                    ATTACH_FILES: true,
                                    READ_MESSAGES: true,
                                    READ_MESSAGE_HISTORY: true,
                                    VIEW_CHANNEL: true

                                });

                                let embedTicketOpen = new Discord.MessageEmbed()
                                    .setColor("#78f1f2")
                                    .setDescription("***:warning: Attention: NE donnez PAS les informations de votre compte à une personne qui à un nom similaire au mien ou qui est un membre du staff (sous aucun prétexte). NE faites confiance à AUCUN Lien ni site ni e-mail reçu en jeu. Faites attention et méfiez-vous des escrocs ! :warning: ***")

                                settedParent.send(embedTicketOpen).then(async msg => {
                                    await msg.react("🔒");
                                });

                            }
                        )
                    }
                );
                break;

            case "🔒":

                reaction.users.remove(user.id).catch(console.error);

                message.channel.send("**Le ticket se fermera dans 10 secondes...**").catch(console.error);

                retrieveAllMessages(message.channel)
                    .then(messages => {
                        createTicketHistory(message.guild, message.channel, messages.sort((userA, userB) => userA.createdTimestamp - userB.createdTimestamp)).then(filename => {
                            setTimeout(() => {
                                message.channel.delete().catch(console.error);
                            }, cdseconds * 1500);

                            let embedTicketClose = new Discord.MessageEmbed()
                                .setTitle(`Le ticket ${message.channel.name} a été fermé`)
                                .setColor("#78f1f2")
                                .setFooter("Avertissement: Ticket fermé!");

                            let logChannel = message.guild.channels.cache.find(c => c.id === '735170363578908692');

                            logChannel.send({
                                content: '▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂',
                                embed: embedTicketClose,
                                files: [filename]
                            }).catch(console.error);
                        }).catch(console.error)
                    })
                    .catch(console.error);

                break;
        }
    }
};

bot.on('raw', async event => {
    try {
        const {t: type, d: data} = event;
        if (type !== 'MESSAGE_REACTION_ADD') return null;
        const guild = bot.guilds.resolve(data.guild_id);
        const channel = guild.channels.resolve(data.channel_id);
        const message = await channel.messages.fetch(data.message_id);
        const user = guild.members.resolve(data.user_id).user;
        const reaction = new Discord.MessageReaction(bot, {
            emoji: data.emoji,
            count: message.partial ? null : 0,
            me: user.id === bot.user.id
        }, message);
        return reactionAdd(reaction, user);
    } catch (error) {
        console.log('MESSAGE_REACTION_ADD ERROR', error);
    }
});




bot.login(botSetting.token);
