const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

// --------- CONFIG ----------
// mets tes ids ici sinon ça marchera pas hein
const TOKEN = process.env.TOKEN;
const SALON_REGLEMENT = "1553802257865121953";
const CATEGORIE = "1553801114405703871";
const ROLE_MEMBRE = "1553820480694263830";
// ---------------------------

client.on("ready", () => {
    console.log("bot allumé: " + client.user.tag);
});

client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    // !setup pour poster le reglement (admin only)
    if (msg.content === "!setup" && msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {

        const embed = new EmbedBuilder()
            .setTitle("Reglement du serveur")
            .setDescription("Lis bien et accepte pour avoir acces au serveur.\n\n1. Respect\n2. Pas de pub\n3. Pas de spam\n4. Bonne humeur obligatoire")
            .setColor("Green");

        const bouton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("accept")
                .setLabel("J'accepte")
                .setStyle(ButtonStyle.Success)
        );

        msg.channel.send({ embeds: [embed], components: [bouton] });
        msg.delete().catch(() => {});
    }

    // !reset pour remettre la categorie en caché (pour tester)
    if (msg.content === "!reset" && msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        try {
            const cat = await msg.guild.channels.fetch(CATEGORIE);
            const everyone = msg.guild.roles.everyone;

            await cat.permissionOverwrites.edit(everyone, { ViewChannel: false });

            cat.children.cache.forEach(async (salon) => {
                await salon.permissionOverwrites.edit(everyone, { ViewChannel: false });
            });

            msg.reply("c'est reset chef");
        } catch (e) {
            console.log(e);
            msg.reply("aie erreur");
        }
    }
});

client.on("interactionCreate", async (inter) => {
    if (!inter.isButton()) return;

    if (inter.customId === "accept") {
        await inter.deferReply({ ephemeral: true });

        try {
            const membre = inter.member;
            const serveur = inter.guild;

            // on file le role
            await membre.roles.add(ROLE_MEMBRE).catch(e => console.log("role fail: " + e));

            // on choppe la categorie
            const cat = await serveur.channels.fetch(CATEGORIE);

            // on ouvre la categorie pour lui
            await cat.permissionOverwrites.edit(membre.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            // et on ouvre tous les salons dedans
            for (const [id, salon] of cat.children.cache) {
                await salon.permissionOverwrites.edit(membre.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
            }

            await inter.editReply({ content: "c'est bon t'as acces, bienvenue !" });
            console.log(membre.user.tag + " a accepte");

        } catch (e) {
            console.log(e);
            await inter.editReply({ content: "erreur, demande a un admin" });
        }
    }
});

client.login(TOKEN);
