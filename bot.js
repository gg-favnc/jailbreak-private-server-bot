// bot.js
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const GUILD_ID = '1416744205593743430';
const BUTTON_CHANNEL_ID = '1416754312297709731';
const LIVE_LIST_CHANNEL_ID = '1416754075193704489';
const JAILBREAK_GAME_ID = '606849621';
const MODERATOR_ID = '918945040666091520';
const DATA_FILE = 'data.json';

let liveListMessage = null;
let buttonMessage = null;
let submissions = [];

/* ---------- Persistence ---------- */
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      submissions = JSON.parse(raw) || [];
      // Ensure sequential IDs on load
      reindexIds();
      console.log(`[DATA] Loaded ${submissions.length} submissions`);
    } else {
      submissions = [];
      console.log('[DATA] No data file found, starting fresh');
    }
  } catch (err) {
    console.error('[DATA] Failed to load data:', err);
    submissions = [];
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2), 'utf8');
  } catch (err) {
    console.error('[DATA] Failed to save data:', err);
  }
}

function getNextId() {
  return submissions.length > 0 ? Math.max(...submissions.map(s => s.id)) + 1 : 1;
}

function reindexIds() {
  submissions.sort((a, b) => a.id - b.id);
  submissions.forEach((submission, index) => {
    submission.id = index + 1;
  });
  saveData();
}

/* ---------- Roblox username -> userId ---------- */
async function getRobloxUserId(username) {
  return new Promise((resolve) => {
    try {
      const req = https.get(
        `https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(username)}`,
        (res) => {
          let data = '';
          res.on('data', chunk => (data += chunk));
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              if (response && response.Id) resolve(response.Id);
              else resolve(null);
            } catch {
              resolve(null);
            }
          });
        }
      );
      req.on('error', () => resolve(null));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

/* ---------- Startup ---------- */
loadData();

client.once('ready', async () => {
  console.log(`[READY] Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID) || (await client.guilds.fetch(GUILD_ID).catch(() => null));
  if (!guild) {
    console.error('[STARTUP] Bot is not in the configured guild. Exiting.');
    return;
  }

  // Ensure button exists
  try {
    const buttonChannel = guild.channels.cache.get(BUTTON_CHANNEL_ID) || (await guild.channels.fetch(BUTTON_CHANNEL_ID).catch(() => null));
    if (buttonChannel && buttonChannel.type === ChannelType.GuildText) {
      const existingMessages = await buttonChannel.messages.fetch({ limit: 50 }).catch(() => []);
      const botMessages = existingMessages.filter(msg => msg.author?.id === client.user.id);
      if (botMessages.size === 0) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('submit_server').setLabel('Submit Private Server').setStyle(ButtonStyle.Primary)
        );
        buttonMessage = await buttonChannel.send({
          content: 'Click the button below to submit your Jailbreak private server:',
          components: [row],
        });
        console.log('[STARTUP] Posted button message in button channel');
      } else {
        buttonMessage = botMessages.first();
        console.log('[STARTUP] Found existing button message');
      }
    } else {
      console.warn('[STARTUP] Button channel not accessible or wrong type');
    }
  } catch (err) {
    console.error('[STARTUP] Error ensuring button message:', err);
  }

  // Ensure live list message exists (pinned message)
  try {
    const liveListChannel = guild.channels.cache.get(LIVE_LIST_CHANNEL_ID) || (await guild.channels.fetch(LIVE_LIST_CHANNEL_ID).catch(() => null));
    if (liveListChannel && liveListChannel.type === ChannelType.GuildText) {
      const pinned = await liveListChannel.messages.fetchPinned().catch(() => new Map());
      const botPinned = Array.from(pinned.values()).filter(msg => msg.author?.id === client.user.id);
      if (botPinned.length > 0) {
        liveListMessage = botPinned[0];
        console.log('[STARTUP] Found pinned live list message');
      } else {
        const embed = createListEmbed();
        const m = await liveListChannel.send({ embeds: [embed] });
        await m.pin().catch(() => {});
        liveListMessage = m;
        console.log('[STARTUP] Created and pinned live list message');
      }
      // Initial update
      await updateLiveList();
    } else {
      console.warn('[STARTUP] Live list channel not accessible or wrong type');
    }
  } catch (err) {
    console.error('[STARTUP] Error ensuring live list message:', err);
  }
});

/* ---------- Handle deleted bot messages: recreate button / live list ---------- */
client.on('messageDelete', async (message) => {
  try {
    if (!message) return;
    // recreate button if removed
    if (message.id === buttonMessage?.id) {
      const guild = client.guilds.cache.get(GUILD_ID);
      const buttonChannel = guild && (guild.channels.cache.get(BUTTON_CHANNEL_ID) || (await guild.channels.fetch(BUTTON_CHANNEL_ID).catch(() => null)));
      if (buttonChannel) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('submit_server').setLabel('Submit Private Server').setStyle(ButtonStyle.Primary)
        );
        buttonMessage = await buttonChannel.send({
          content: 'Click the button below to submit your Jailbreak private server:',
          components: [row],
        });
      }
    }

    // recreate live list if pinned message removed
    if (message.id === liveListMessage?.id) {
      const guild = client.guilds.cache.get(GUILD_ID);
      const liveListChannel = guild && (guild.channels.cache.get(LIVE_LIST_CHANNEL_ID) || (await guild.channels.fetch(LIVE_LIST_CHANNEL_ID).catch(() => null)));
      if (liveListChannel) {
        const embed = createListEmbed();
        const m = await liveListChannel.send({ embeds: [embed] });
        await m.pin().catch(() => {});
        liveListMessage = m;
      }
    }
  } catch (err) {
    console.error('[messageDelete] error:', err);
  }
});

/* ---------- Interactions: button and modal ---------- */
client.on('interactionCreate', async (interaction) => {
  try {
    // Restrict to guild
    if (interaction.guildId && interaction.guildId !== GUILD_ID) {
      if (interaction.isRepliable()) {
        const guild = client.guilds.cache.get(GUILD_ID);
        await interaction.reply({ content: `This bot is private to ${guild?.name || 'the specified server'}.`, ephemeral: true });
      }
      return;
    }

    // Button: show modal
    if (interaction.isButton() && interaction.customId === 'submit_server') {
      const modal = new ModalBuilder().setCustomId('server_submission').setTitle('Submit Private Server');

      const linkInput = new TextInputBuilder()
        .setCustomId('server_link')
        .setLabel('Private Server Share Link')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const usernameInput = new TextInputBuilder()
        .setCustomId('roblox_username')
        .setLabel('Roblox Username (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(linkInput), new ActionRowBuilder().addComponents(usernameInput));
      await interaction.showModal(modal);
      return;
    }

    // Modal submit
    if (interaction.isModalSubmit() && interaction.customId === 'server_submission') {
      await interaction.deferReply({ ephemeral: true });

      const rawLink = interaction.fields.getTextInputValue('server_link').trim();
      const robloxUsernameRaw = interaction.fields.getTextInputValue('roblox_username').trim();
      const robloxUsername = robloxUsernameRaw.length > 0 ? robloxUsernameRaw : 'None provided';
      const userId = interaction.user.id;

      const validation = validateLink(rawLink);

      if (!validation.valid) {
        await interaction.editReply({ content: validation.message });
        return;
      }

      const status = await verifyShareLink(validation.code);

      let robloxUserID = null;
      if (robloxUsername !== 'None provided') {
        robloxUserID = await getRobloxUserId(robloxUsername);
      }

      const newSubmission = {
        id: getNextId(),
        userId,
        robloxUsername,
        robloxUserID,
        link: validation.cleanLink,
        status,
        timestamp: new Date().toISOString(),
      };

      submissions.push(newSubmission);
      saveData();
      await updateLiveList();

      await interaction.editReply({
        content: `Thanks — Private server added ✅\nSubmitted by: <@${userId}>\nRoblox Username: ${robloxUsername}\nLink: ${validation.cleanLink}`,
      });
    }
  } catch (err) {
    console.error('[interactionCreate] error:', err);
    try {
      if (interaction && interaction.isRepliable()) {
        await interaction.reply({ content: 'An error occurred while handling your request.', ephemeral: true });
      }
    } catch {}
  }
});

/* ---------- Moderator text commands (no prefix) ---------- */
client.on('messageCreate', async (message) => {
  try {
    if (!message.guildId || message.guildId !== GUILD_ID) return;
    if (message.author.bot) return;
    if (message.author.id !== MODERATOR_ID) return; // only moderator can run these

    const trimmed = message.content.trim();
    // expect: approve {link} OR reject {link} OR delete {link}
    const m = trimmed.match(/^(\w+)\s+(.+)$/s);
    if (!m) return;

    const command = m[1].toLowerCase();
    const link = m[2].trim();

    if (!['approve', 'reject', 'delete'].includes(command)) return;

    const submissionIndex = submissions.findIndex(s => s.link === link);
    if (submissionIndex === -1) {
      await message.reply('Link not found in submissions.');
      return;
    }

    if (command === 'approve') {
      submissions[submissionIndex].status = '✅ Verified Jailbreak private server';
      await message.reply(`Approved submission: ${link}`);
    } else if (command === 'reject') {
      submissions[submissionIndex].status = '❌ Rejected';
      await message.reply(`Rejected submission: ${link}`);
    } else if (command === 'delete') {
      submissions.splice(submissionIndex, 1);
      reindexIds();
      await message.reply(`Deleted submission: ${link}`);
    }

    saveData();
    await updateLiveList();
  } catch (err) {
    console.error('[messageCreate] mod command error:', err);
  }
});

/* ---------- Link validation ---------- */
function validateLink(link) {
  try {
    const url = new URL(link);

    // Acceptable hostnames
    const allowedHosts = ['www.roblox.com', 'ro.blox.com'];
    if (!allowedHosts.includes(url.hostname)) {
      // If hostname looks like a shady roblox impersonation, treat as malicious
      if (/roblox|robux/i.test(url.hostname)) {
        return { valid: false, message: 'Permanent Ban, malicious link!' };
      }
      return { valid: false, message: 'Invalid link. It must be a private server share link from Jailbreak' };
    }

    // Preferred: /share?code=
    if (url.pathname === '/share' && url.searchParams.has('code')) {
      const code = url.searchParams.get('code');
      return { valid: true, code, cleanLink: `https://www.roblox.com/share?code=${code}` };
    }

    // Raw private-server format using privateServerLinkCode
    if (url.pathname.startsWith('/games/') && url.searchParams.has('privateServerLinkCode')) {
      return { valid: false, message: 'No raw private server, it must be the share code. Please resend.' };
    }

    return { valid: false, message: 'Invalid link. It must be a private server share link from Jailbreak' };
  } catch {
    return { valid: false, message: 'Invalid link. It must be a private server share link from Jailbreak' };
  }
}

/* ---------- Verify share link by checking page body ---------- */
async function verifyShareLink(code) {
  return new Promise((resolve) => {
    try {
      const req = https.get(`https://www.roblox.com/share?code=${encodeURIComponent(code)}`, (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            // If page body includes a games path with the jailbreak ID -> verified
            if (data.includes(`/games/${JAILBREAK_GAME_ID}/`)) {
              resolve('✅ Verified Jailbreak private server');
            } else if (/\/games\/\d+\//.test(data)) {
              resolve('❌ Wrong game');
            } else {
              resolve('⏳ Pending Verification');
            }
          } catch {
            resolve('⏳ Pending Verification');
          }
        });
      });

      req.on('error', () => resolve('⏳ Pending Verification'));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve('⏳ Pending Verification');
      });
    } catch {
      resolve('⏳ Pending Verification');
    }
  });
}

/* ---------- Live list embed ---------- */
function createListEmbed() {
  const verifiedCount = submissions.filter(s => s.status === '✅ Verified Jailbreak private server').length;
  const pendingCount = submissions.filter(s => s.status === '⏳ Pending Verification').length;
  const wrongGameCount = submissions.filter(s => s.status === '❌ Wrong game').length;
  const rejectedCount = submissions.filter(s => s.status === '❌ Rejected').length;

  const embed = new EmbedBuilder()
    .setTitle('Jailbreak Private Servers List')
    .setDescription(
      `Total submitted: ${submissions.length} — Verified: ${verifiedCount} — Pending: ${pendingCount} — Wrong game: ${wrongGameCount} — Rejected: ${rejectedCount}`
    )
    .setColor(0x00ae86)
    .setTimestamp();

  if (submissions.length === 0) {
    embed.addFields([{ name: 'No submissions yet', value: 'Be the first to submit a private server!', inline: false }]);
    return embed;
  }

  // Add each submission as a field (watch out for embed field limits if many)
  submissions.forEach((submission) => {
    let usernameDisplay = submission.robloxUsername;
    if (submission.robloxUserID && submission.robloxUsername && submission.robloxUsername !== 'None provided') {
      usernameDisplay = `[${submission.robloxUsername}](https://www.roblox.com/users/${submission.robloxUserID}/profile)`;
    }

    embed.addFields([
      {
        name: `Server #${submission.id} - ${submission.status}`,
        value:
          `Submitted by: <@${submission.userId}>\n` +
          `Roblox Username: ${usernameDisplay}\n` +
          `Link: ${submission.link}\n` +
          `Submitted: <t:${Math.floor(new Date(submission.timestamp).getTime() / 1000)}:R>`,
        inline: false,
      },
    ]);
  });

  return embed;
}

async function updateLiveList() {
  try {
    if (!liveListMessage) return;
    const embed = createListEmbed();
    await liveListMessage.edit({ embeds: [embed] }).catch(async (err) => {
      // If editing failed (message deleted), try to recreate it
      console.error('[updateLiveList] edit failed:', err);
      const guild = client.guilds.cache.get(GUILD_ID) || (await client.guilds.fetch(GUILD_ID).catch(() => null));
      if (!guild) return;
      const liveListChannel = guild.channels.cache.get(LIVE_LIST_CHANNEL_ID) || (await guild.channels.fetch(LIVE_LIST_CHANNEL_ID).catch(() => null));
      if (!liveListChannel) return;
      const m = await liveListChannel.send({ embeds: [embed] }).catch(() => null);
      if (m) {
        await m.pin().catch(() => {});
        liveListMessage = m;
      }
    });
  } catch (err) {
    console.error('[updateLiveList] error:', err);
  }
}

client.login(process.env.TOKEN);
