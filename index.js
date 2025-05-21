const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const userChannels = new Map(); // Map userId => channelId

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const { content, guild, author } = message;

  // ?startchat command
  if (content === '?startchat') {
    if (userChannels.has(author.id)) {
      return message.reply('❗ You already have an active chat channel.');
    }

    const channel = await guild.channels.create({
      name: `chat-${author.username}`,
      type: 0, // GUILD_TEXT
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: author.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
        {
          id: client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        }
      ]
    });

    userChannels.set(author.id, channel.id);
    channel.send(`👋 Hello ${author}, you can now chat with the AI. Type anything!`);
    return message.reply('✅ Private chat started. Check the channel!');
  }

  // ?stopchat command
  if (content === '?stopchat') {
    const channelId = userChannels.get(author.id);
    if (!channelId) {
      return message.reply('❌ You don’t have an active chat to stop.');
    }

    const channel = guild.channels.cache.get(channelId);
    if (channel) await channel.delete();
    userChannels.delete(author.id);
    return message.reply('🗑️ Your private chat has been deleted.');
  }

  // Handle messages in AI channels
  const currentChannelId = userChannels.get(author.id);
  if (message.channel.id === currentChannelId) {
    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: content }],
      });

      const reply = response.data.choices[0].message.content;
      message.channel.send(reply);
    } catch (error) {
      console.error('OpenAI error:', error);
      message.channel.send('⚠️ Error communicating with AI.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
