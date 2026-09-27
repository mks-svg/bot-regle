const {
    Client,
    GatewayIntentBits,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionsBitField,
    ChannelType,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

const TOKEN = process.env.TOKEN;
const CONFIG_FILE = path.join(__dirname, 'config.json');

// ================= CONFIG PAR DEFAUT =================
const defaultConfig = {
    reglementChannel: null,
    category: null,
    role: null,
    titre: "📜 Règlement du serveur",
    description: "Pour accéder au serveur, tu dois accepter le règlement.\n\n**Règles :**\n1. Sois respectueux envers tout le monde\n2. Pas de spam ni de publicité\n3. Pas de contenu illégal\n4. Amuse-toi bien !\n\n👇 Clique sur le bouton ci-dessous pour accepter.",
    boutonTexte: "✅ J'accepte le règlement",
    couleur: "Green",
    messageConfirmation: "✅ Merci ! Tu as accepté le règlement. Bienvenue ! 🎉",
    allowMessages: true
};

// ================= GESTION FICHIER CONFIG =================
function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
        return { ...defaultConfig };
    }
    try {
        const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        return { ...defaultConfig, ...data };
    } catch (e) {
        console.error('Erreur lecture config:', e);
        return { ...defaultConfig };
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        console.error('Erreur écriture config:', e);
        return false;
    }
}

// ================= READY =================
client.once('ready', () => {
    console.log(`bot allumé: ${client.user.tag}`);
});

// ================= COMMANDES =================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const config = loadConfig();

    // ---------- /config : ouvre le panneau ----------
    if (message.content === '!config') {
        const embed = new EmbedBuilder()
            .setTitle('🎛️ Panneau de configuration')
            .setDescription('Choisis une option dans le menu ci-dessous pour configurer le bot.')
            .addFields(
                { name: '📢 Salon règlement', value: config.reglementChannel ? `<#${config.reglementChannel}>` : '❌ Non défini', inline: true },
                { name: '📁 Catégorie', value: config.category ? `<#${config.category}>` : '❌ Non définie', inline: true },
                { name: '🎭 Rôle', value: config.role ? `<@&${config.role}>` : '❌ Non défini', inline: true },
                { name: '✏️ Titre', value: config.titre, inline: false },
                { name: '🔘 Bouton', value: config.boutonTexte, inline: true },
                { name: '🎨 Couleur', value: config.couleur, inline: true }
            )
            .setColor('Blue');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('config_menu')
                .setPlaceholder('Choisis une option à modifier...')
                .addOptions([
                    { label: 'Définir le salon règlement', value: 'set_channel', emoji: '📢' },
                    { label: 'Définir la catégorie', value: 'set_category', emoji: '📁' },
                    { label: 'Définir le rôle', value: 'set_role', emoji: '🎭' },
                    { label: 'Modifier le titre', value: 'set_titre', emoji: '✏️' },
                    { label: 'Modifier la description', value: 'set_desc', emoji: '📝' },
                    { label: 'Modifier le texte du bouton', value: 'set_btn', emoji: '🔘' },
                    { label: 'Modifier la couleur', value: 'set_color', emoji: '🎨' },
                    { label: 'Modifier le message de confirmation', value: 'set_confirm', emoji: '💬' },
                    { label: 'Autoriser/Interdire envoi messages', value: 'toggle_msgs', emoji: '🔓' },
                    { label: '📤 Poster le règlement maintenant', value: 'post_regle', emoji: '📤' }
                ])
        );

        await message.channel.send({ embeds: [embed], components: [menu] });
        await message.delete().catch(() => {});
    }

    // ---------- !setup : poste le règlement ----------
    if (message.content === '!setup') {
        await postReglement(message.channel, config);
        await message.delete().catch(() => {});
    }

    // ---------- !reset : reset un membre ----------
    if (message.content.startsWith('!reset')) {
        const mention = message.mentions.members.first();
        if (!mention) return message.reply('Mentionne un membre : `!reset @membre`');

        try {
            if (config.role) await mention.roles.remove(config.role).catch(() => {});

            if (config.category) {
                const cat = await message.guild.channels.fetch(config.category);
                await cat.permissionOverwrites.delete(mention.id).catch(() => {});

                for (const [, ch] of cat.children.cache) {
                    await ch.permissionOverwrites.delete(mention.id).catch(() => {});
                }
            }
            message.reply(`✅ ${mention.user.tag} a été reset.`);
        } catch (e) {
            console.error(e);
            message.reply('❌ Erreur lors du reset.');
        }
    }

    // ---------- !aide ----------
    if (message.content === '!aide') {
        const embed = new EmbedBuilder()
            .setTitle('📖 Aide du bot')
            .setDescription(
                '**Commandes admin :**\n' +
                '`!config` → Ouvre le panneau de configuration\n' +
                '`!setup` → Poste le règlement dans le salon configuré\n' +
                '`!reset @membre` → Reset un membre (retire le rôle + cache la catégorie)\n' +
                '`!aide` → Affiche cette aide'
            )
            .setColor('Blue');
        message.channel.send({ embeds: [embed] });
    }
});

// ================= POSTER LE REGLEMENT =================
async function postReglement(channel, config) {
    if (!config.reglementChannel) {
        return channel.send('❌ Le salon règlement n\'est pas configuré. Fais `!config` d\'abord.');
    }

    const embed = new EmbedBuilder()
        .setTitle(config.titre)
        .setDescription(config.description)
        .setColor(config.couleur);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('accept_reglement')
            .setLabel(config.boutonTexte)
            .setStyle(ButtonStyle.Success)
    );

    const targetChannel = channel.guild.channels.cache.get(config.reglementChannel) || channel;
    await targetChannel.send({ embeds: [embed], components: [row] });
}

// ================= INTERACTIONS =================
client.on('interactionCreate', async (interaction) => {

    // ---- MENU DE CONFIG ----
    if (interaction.isStringSelectMenu() && interaction.customId === 'config_menu') {
        const choix = interaction.values[0];
        const config = loadConfig();

        // Options avec Modal (champ de texte)
        const modalOptions = {
            set_titre: { id: 'modal_titre', titre: 'Modifier le titre', label: 'Nouveau titre', value: config.titre, style: TextInputStyle.Short },
            set_desc: { id: 'modal_desc', titre: 'Modifier la description', label: 'Nouvelle description', value: config.description, style: TextInputStyle.Paragraph },
            set_btn: { id: 'modal_btn', titre: 'Modifier le bouton', label: 'Texte du bouton', value: config.boutonTexte, style: TextInputStyle.Short },
            set_confirm: { id: 'modal_confirm', titre: 'Message de confirmation', label: 'Message après acceptation', value: config.messageConfirmation, style: TextInputStyle.Paragraph },
            set_color: { id: 'modal_color', titre: 'Modifier la couleur', label: 'Couleur (Green, Red, Blue, Yellow, Purple, Orange, #ff00ff...)', value: config.couleur, style: TextInputStyle.Short }
        };

        if (modalOptions[choix]) {
            const opt = modalOptions[choix];
            const modal = new ModalBuilder().setCustomId(opt.id).setTitle(opt.titre);
            const input = new TextInputBuilder()
                .setCustomId('valeur')
                .setLabel(opt.label)
                .setStyle(opt.style)
                .setValue(opt.value || '')
                .setRequired(true);

            if (choix === 'set_color') input.setMaxLength(20);
            if (choix === 'set_titre') input.setMaxLength(100);
            if (choix === 'set_btn') input.setMaxLength(80);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // Options avec salon/catégorie/rôle
        if (choix === 'set_channel') {
            const embed = new EmbedBuilder()
                .setTitle('📢 Salon du règlement')
                .setDescription('Mentionne le salon où poster le règlement (ex: `#règlement`)')
                .setColor('Blue');
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return waitForMention(interaction, 'channel', 'reglementChannel');
        }

        if (choix === 'set_category') {
            const embed = new EmbedBuilder()
                .setTitle('📁 Catégorie à débloquer')
                .setDescription('Mentionne la catégorie (fais `#nom-de-la-categorie` — Discord accepte aussi les catégories avec la mention)')
                .setColor('Blue');
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return waitForMention(interaction, 'category', 'category');
        }

        if (choix === 'set_role') {
            const embed = new EmbedBuilder()
                .setTitle('🎭 Rôle à donner')
                .setDescription('Mentionne le rôle (ex: `@Membre`)')
                .setColor('Blue');
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return waitForMention(interaction, 'role', 'role');
        }

        // Toggle autoriser messages
        if (choix === 'toggle_msgs') {
            config.allowMessages = !config.allowMessages;
            saveConfig(config);
            await interaction.reply({ content: `✅ Envoi de messages dans la catégorie : **${config.allowMessages ? 'Autorisé' : 'Interdit'}**`, ephemeral: true });
            return;
        }

        // Poster le règlement
        if (choix === 'post_regle') {
            await interaction.reply({ content: '📤 Le règlement va être posté...', ephemeral: true });
            await postReglement(interaction.channel, config);
            return;
        }
    }

    // ---- BOUTON ACCEPTER REGLEMENT ----
    if (interaction.isButton() && interaction.customId === 'accept_reglement') {
        await interaction.deferReply({ ephemeral: true });
        const config = loadConfig();

        try {
            const member = interaction.member;
            const guild = interaction.guild;

            if (config.role) await member.roles.add(config.role).catch(e => console.error('role:', e));

            if (config.category) {
                const cat = await guild.channels.fetch(config.category);

                const perms = {
                    ViewChannel: true,
                    ReadMessageHistory: true,
                    SendMessages: config.allowMessages
                };

                await cat.permissionOverwrites.edit(member.id, perms);

                for (const [, ch] of cat.children.cache) {
                    await ch.permissionOverwrites.edit(member.id, perms);
                }
            }

            await interaction.editReply({ content: config.messageConfirmation });
            console.log(`✅ ${member.user.tag} a accepté`);
        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: '❌ Erreur. Contacte un admin.' });
        }
    }

    // ---- MODALS ----
    if (interaction.isModalSubmit()) {
        const config = loadConfig();
        const valeur = interaction.fields.getTextInputValue('valeur');

        if (interaction.customId === 'modal_titre') config.titre = valeur;
        if (interaction.customId === 'modal_desc') config.description = valeur;
        if (interaction.customId === 'modal_btn') config.boutonTexte = valeur;
        if (interaction.customId === 'modal_confirm') config.messageConfirmation = valeur;
        if (interaction.customId === 'modal_color') config.couleur = valeur;

        saveConfig(config);
        await interaction.reply({ content: `✅ Modifié : **${valeur}**`, ephemeral: true });
    }
});

// ================= ATTENDRE UNE MENTION =================
function waitForMention(interaction, type, key) {
    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 30000 });

    collector.on('collect', async (msg) => {
        const config = loadConfig();
        const content = msg.content;

        // Extrait l'ID de la mention
        const match = content.match(/\d{17,20}/);
        if (!match) {
            return interaction.followUp({ content: '❌ Aucune mention valide détectée.', ephemeral: true });
        }

        const id = match[0];

        // Vérifie selon le type
        try {
            if (type === 'channel') {
                const ch = await interaction.guild.channels.fetch(id);
                if (!ch) throw new Error();
                config[key] = id;
                saveConfig(config);
                await interaction.followUp({ content: `✅ Salon défini : <#${id}>`, ephemeral: true });
            } else if (type === 'category') {
                const ch = await interaction.guild.channels.fetch(id);
                if (!ch || ch.type !== ChannelType.GuildCategory) throw new Error('pas une catégorie');
                config[key] = id;
                saveConfig(config);
                await interaction.followUp({ content: `✅ Catégorie définie : <#${id}>`, ephemeral: true });
            } else if (type === 'role') {
                const role = await interaction.guild.roles.fetch(id);
                if (!role) throw new Error();
                config[key] = id;
                saveConfig(config);
                await interaction.followUp({ content: `✅ Rôle défini : <@&${id}>`, ephemeral: true });
            }
        } catch (e) {
            await interaction.followUp({ content: '❌ ID invalide ou élément introuvable.', ephemeral: true });
        }

        msg.delete().catch(() => {});
    });

    collector.on('end', (collected) => {
        if (collected.size === 0) {
            interaction.followUp({ content: '⏱️ Temps écoulé, recommence.', ephemeral: true }).catch(() => {});
        }
    });
}

client.login(TOKEN);
